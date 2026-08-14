// src/services/quoteCalculator.js
// @ts-check
import { RATES } from '../config/rates';
import { METRO_CODE_BY_ZONE_ID } from '../config/geofences';
import { evaluateMetroGeofences, evaluateHazardGeofences, evaluateCustomGeofences } from '../utils/geofenceEngine';
import { loadGoogleMaps } from '../lib/googleMaps';

/**
 * Ensures Google Maps JS API is fully initialized.
 */
async function verifyGoogleMapsLoaded() {
  await loadGoogleMaps();
  if (typeof window === 'undefined' || !window.google?.maps?.DistanceMatrixService) {
    throw new Error('Google Maps API is disconnected or not loaded yet. Check VITE_GOOGLE_MAPS_API_KEY in .env.');
  }
}

export const roundToNearest = (val, interval = 25) => {
  const step = Number(interval) || 25;
  return Math.round(val / step) * step;
};

/**
 * Geocodes an array of address strings to Lat/Lng coordinates.
 */
export const geocodeAll = async (addresses) => {
  try {
    await verifyGoogleMapsLoaded();
    const validAddresses = (addresses || []).filter((addr) => typeof addr === 'string' && addr.trim().length > 0);
    
    if (validAddresses.length === 0) return [];

    const geocoder = new window.google.maps.Geocoder();
    return await Promise.all(
      validAddresses.map(
        (addr) =>
          new Promise((resolve) => {
            geocoder.geocode({ address: addr }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                const loc = results[0].geometry.location;
                resolve({ lat: loc.lat(), lng: loc.lng() });
              } else {
                resolve(null);
              }
            });
          })
      )
    );
  } catch (err) {
    console.warn('Geocoding skipped or failed:', err);
    return [];
  }
};

/**
 * Fetches Distance Matrix leg durations and calculates total job hours & base quotes.
 */
export async function calculateQuoteData({
  currentBase,
  waypoints = [],
  selectedTruckClassId = '',
  isHeavy = false,
  isAfterHours = false,
  isRoadClub = false,
  isMetro = false,
  isHazard = false,
  companyRates = {},
  clientWeight = 0,
  clientConfig = null,
}) {
  await verifyGoogleMapsLoaded();

  if (!currentBase || !currentBase.address) {
    throw new Error('Base shop location address is invalid or not selected.');
  }

  // Filter out empty waypoints
  const cleanWaypoints = waypoints
    .map((w) => (typeof w === 'string' ? w.trim() : ''))
    .filter((w) => w.length > 0);

  if (cleanWaypoints.length < 2) {
    throw new Error('Please enter both a valid Pick-up and Drop-off location.');
  }

  // Fallback parameters from app_config or rates config
  const pricing = companyRates?.pricing || {};
  const clientPricing = clientConfig?.pricing?.use_custom_pricing ? clientConfig.pricing : {};
  const normalizeBuffer = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 1.1;
    return num > 1.5 ? 1 + num / 100 : num;
  };
  const driveBuffer = normalizeBuffer(clientPricing.drive_time_buffer ?? pricing.drive_time_buffer ?? companyRates.drive_time_buffer ?? 10);
  const baseLoadMins = Number(clientPricing.load_unload_base_mins ?? pricing.load_unload_base_mins ?? companyRates.load_unload_base_mins) || 30;
  const extraStopMins = Number(clientPricing.extra_stop_mins ?? pricing.extra_stop_mins ?? companyRates.extra_stop_mins) || 15;

  // Build the full route once and request one batched Distance Matrix for all route legs.
  // This keeps billing lower than issuing one matrix call per leg as the route grows.
  const fullRouteAddresses = [currentBase.address, ...cleanWaypoints, currentBase.address];
  const service = new window.google.maps.DistanceMatrixService();

  const origins = fullRouteAddresses.slice(0, -1);
  const destinations = fullRouteAddresses.slice(1);
  const routeLegCount = Math.min(origins.length, destinations.length);

  const matrixResponse = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Google Distance Matrix request timed out. Check network or address validity.'));
    }, 12000);

    service.getDistanceMatrix(
      {
        origins,
        destinations,
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.IMPERIAL,
      },
      (response, status) => {
        clearTimeout(timeout);
        if (status === 'OK' && response) {
          resolve(response);
        } else {
          reject(new Error(`Google Distance Matrix API failed with status: ${status}.`));
        }
      }
    );
  });

  let rawTotalMins = 0;
  let totalMeters = 0;

  for (let i = 0; i < routeLegCount; i++) {
    const element = matrixResponse.rows[i]?.elements[i];
    if (element && element.status === 'OK') {
      rawTotalMins += element.duration.value / 60;
      totalMeters += element.distance.value;
    } else {
      throw new Error(`Unable to calculate route from "${origins[i]}" to "${destinations[i]}". Status: ${element?.status || 'UNKNOWN'}`);
    }
  }

  let baseMinRate = Number(pricing.hourly_min || companyRates.hourly_min) || 125;
  let baseMaxRate = Number(pricing.hourly_max || companyRates.hourly_max) || 135;

  const clientWeightTiers = companyRates?.client_portal?.weight_tiers || [];
  const matchingTier = clientWeightTiers.find((tier) => {
    const min = Number(tier.minWeight ?? 0) || 0;
    const max = Number(tier.maxWeight ?? 999999) || 999999;
    return clientWeight >= min && clientWeight <= max;
  });

  if (matchingTier) {
    baseMinRate = Number(matchingTier.rate) || baseMinRate;
    baseMaxRate = Number(matchingTier.rate) || baseMaxRate;
  }

  const tierDriveBuffer = matchingTier?.drive_time_buffer;
  const tierLoadMins = matchingTier?.load_unload_base_mins;
  const customClasses = pricing.custom_truck_classes || [];
  const selectedClass = customClasses.find((item) => item.id === selectedTruckClassId);
  const selectedClassDriveBuffer = selectedClass?.drive_time_buffer;
  const selectedClassLoadMins = selectedClass?.load_unload_base_mins;

  const bufferedDriveMins = rawTotalMins * (Number.isFinite(Number(selectedClassDriveBuffer))
    ? normalizeBuffer(selectedClassDriveBuffer)
    : Number.isFinite(Number(tierDriveBuffer)) ? normalizeBuffer(tierDriveBuffer) : driveBuffer);
  const extraStopsCount = Math.max(0, cleanWaypoints.length - 2);
  const clientLoadMins = clientConfig?.pricing?.load_unload_base_mins ?? null;
  const clientExtraStopMins = clientConfig?.pricing?.extra_stop_mins ?? null;
  const totalOnSiteMins = (Number.isFinite(Number(selectedClassLoadMins))
    ? Number(selectedClassLoadMins)
    : Number.isFinite(Number(tierLoadMins)) ? Number(tierLoadMins) : (clientLoadMins ?? baseLoadMins)) + extraStopsCount * (clientExtraStopMins ?? extraStopMins);
  const rawTotalHours = (bufferedDriveMins + totalOnSiteMins) / 60;
  const totalMiles = totalMeters * 0.000621371;

  const legsDetails = origins.map((_, index) => {
    const durationMinutes = Number(((matrixResponse.rows[index]?.elements[index]?.duration?.value || 0) / 60).toFixed(1));
    const startLabel = index === 0 ? 'Base' : (cleanWaypoints[index - 1] || `Stop ${index}`);
    const endLabel = index === origins.length - 1 ? 'Base' : (cleanWaypoints[index] || `Stop ${index + 1}`);
    return { label: `${startLabel} → ${endLabel}`, minutes: durationMinutes };
  });

  if (selectedClass) {
    baseMinRate = Number(selectedClass.minRate) || baseMinRate;
    baseMaxRate = Number(selectedClass.maxRate) || baseMaxRate;
  } else if (isHeavy) {
    baseMinRate = Number(companyRates.heavy_hourly_min || pricing.heavy_hourly_min) || 200;
    baseMaxRate = Number(companyRates.heavy_hourly_max || pricing.heavy_hourly_max) || 250;
  }

  const roundingInterval = Number(clientPricing.rounding_interval ?? pricing.rounding_interval ?? companyRates.rounding_interval) || 25;
  const baseMinQuote = roundToNearest(rawTotalHours * baseMinRate, roundingInterval);
  const baseMaxQuote = roundToNearest(rawTotalHours * baseMaxRate, roundingInterval);

  // Geofence evaluations
  const coordsList = await geocodeAll(cleanWaypoints);
  const metroMatches = await evaluateMetroGeofences(cleanWaypoints, coordsList, companyRates);
  const hazardMatches = await evaluateHazardGeofences(cleanWaypoints, coordsList, companyRates);
  const customMatches = await evaluateCustomGeofences(cleanWaypoints, coordsList, companyRates);
  const hitMetroZone = metroMatches.length > 0;
  const hitHazardZone = hazardMatches.length > 0;
  const hitCustomZone = customMatches.length > 0;
  const metroCodes = Array.from(
    new Set(
      metroMatches
        .map((zone) => Object.entries(METRO_CODE_BY_ZONE_ID).find(([zoneId]) => zoneId === String(zone.id))?.[1])
        .filter(Boolean)
    )
  );

  return {
    rawTotalHours,
    totalMiles,
    selectedTruckClassId,
    isHeavy,
    approvalRequired: clientWeight >= Number(clientConfig?.approval_threshold ?? companyRates?.client_portal?.approval_threshold ?? 80000),
    hasAfterHours: isAfterHours,
    hasRoadClub: isRoadClub,
    hasMetroZone: hitMetroZone || isMetro,
    hasHazardZone: hitHazardZone || isHazard,
    hasCustomZone: hitCustomZone,
    metroMatches,
    hazardMatches,
    customMatches,
    metroCodes,
    baseAddress: currentBase?.address || '',
    cleanWaypoints,
    routeAddresses: fullRouteAddresses,
    legsDetails,
    adjustedDriveMin: Math.round(bufferedDriveMins),
    loadUnloadTime: Math.round(totalOnSiteMins),
    baseMinQuote,
    baseMaxQuote,
    totalHours: Number(rawTotalHours.toFixed(2)),
  };
}

/**
 * Calculates effective multiplier and final min/max/custom pricing.
 */
export function calculateFinalQuotes(quoteData, activeOverrides, customRate, companyRates = {}, customLoadUnloadMins = null) {
  if (!quoteData) {
    return { currentMinQuote: 0, currentMaxQuote: 0, customCalculatedQuote: null, effectiveMultiplier: 1.0 };
  }

  const pricing = companyRates?.pricing || {};
  const surcharges = companyRates?.surcharges || {};
  const surchargeModes = pricing.surchargeModes || surcharges.surchargeModes || {};
  const flatCustomOverride = (Array.isArray(quoteData.customMatches) ? quoteData.customMatches : [])
    .filter((zone) => zone?.charge?.feeType === 'flat')
    .reduce((maxValue, zone) => Math.max(maxValue, Number(zone?.charge?.value) || 0), 0);

  const getChargeType = (key, fallback = 'percent') => (surchargeModes[key] === 'flat' ? 'flat' : fallback);

  const getChargeValue = (val, defaultValue) => {
    const num = Number(val ?? defaultValue);
    return Number.isFinite(num) ? num : Number(defaultValue) || 0;
  };

  const chargeTotals = { multiplier: 1, flat: 0 };

  const addCharge = (feeType, value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 0) return;
    if (feeType === 'flat') {
      chargeTotals.flat += numeric;
    } else {
      chargeTotals.multiplier *= 1 + numeric / 100;
    }
  };

  if (quoteData.hasAfterHours && activeOverrides?.afterHours) {
    addCharge(getChargeType('after_hours_multiplier'), getChargeValue(pricing.after_hours_multiplier ?? surcharges.after_hours_multiplier, 25));
  }
  if (quoteData.hasRoadClub && activeOverrides?.roadClub) {
    addCharge(getChargeType('road_club_multiplier'), getChargeValue(pricing.road_club_multiplier ?? surcharges.road_club_multiplier, 15));
  }
  if (quoteData.hasMetroZone && activeOverrides?.metro) {
      const metroMatch = Array.isArray(quoteData.metroMatches) ? quoteData.metroMatches[0] : null;
      const charge = metroMatch?.charge || {};
      addCharge(charge.feeType || getChargeType('metro_multiplier'), charge.value ?? getChargeValue(pricing.metro_multiplier ?? surcharges.metro_multiplier, 28.57));
  }
  if (quoteData.hasHazardZone && activeOverrides?.hazard) {
    (Array.isArray(quoteData.hazardMatches) ? quoteData.hazardMatches : []).forEach((zone) => {
      const charge = zone?.charge || {};
      addCharge(charge.feeType || getChargeType('hazard_multiplier'), charge.value ?? getChargeValue(pricing.hazard_multiplier ?? surcharges.hazard_multiplier, 40));
    });
  }
  if (quoteData.hasCustomZone) {
    (Array.isArray(quoteData.customMatches) ? quoteData.customMatches : []).forEach((zone) => {
      const charge = zone?.charge || {};
      addCharge(charge.feeType || 'percent', charge.value ?? 0);
    });
  }
  (pricing.custom_surcharges || []).filter((item) => item.active !== false && activeOverrides?.customSurcharges?.[item.id] === true).forEach((item) => {
    addCharge(item.feeType || 'flat', item.value || 0);
  });

  let baseMinRate = Number(pricing.hourly_min || companyRates.hourly_min) || 125;
  let baseMaxRate = Number(pricing.hourly_max || companyRates.hourly_max) || 135;

  const customClasses = pricing.custom_truck_classes || [];
  const selectedClass = customClasses.find((c) => c.id === quoteData.selectedTruckClassId);

  if (selectedClass) {
    baseMinRate = Number(selectedClass.minRate) || baseMinRate;
    baseMaxRate = Number(selectedClass.maxRate) || baseMaxRate;
  } else if (quoteData.isHeavy) {
    baseMinRate = Number(companyRates.heavy_hourly_min || pricing.heavy_hourly_min) || 200;
    baseMaxRate = Number(companyRates.heavy_hourly_max || pricing.heavy_hourly_max) || 250;
  }

  const roundingInterval = Number(pricing.rounding_interval || companyRates.rounding_interval) || 25;

  if (flatCustomOverride > 0) {
    const overriddenQuote = roundToNearest(flatCustomOverride, roundingInterval);
    return {
      currentMinQuote: overriddenQuote,
      currentMaxQuote: overriddenQuote,
      customCalculatedQuote: overriddenQuote,
      effectiveMultiplier: 1,
    };
  }

  const currentMinQuote = roundToNearest((quoteData.rawTotalHours * baseMinRate * chargeTotals.multiplier) + chargeTotals.flat, roundingInterval);
  const currentMaxQuote = roundToNearest((quoteData.rawTotalHours * baseMaxRate * chargeTotals.multiplier) + chargeTotals.flat, roundingInterval);

  const parsedCustomRate = Number(customRate);
  const customHours = customLoadUnloadMins === null || customLoadUnloadMins === ''
    ? quoteData.rawTotalHours
    : Math.max(0, quoteData.rawTotalHours + (Number(customLoadUnloadMins) - Number(quoteData.loadUnloadTime || 0)) / 60);
  const customCalculatedQuote = parsedCustomRate > 0
    ? roundToNearest((customHours * parsedCustomRate * chargeTotals.multiplier) + chargeTotals.flat, roundingInterval)
    : null;

  return {
    currentMinQuote,
    currentMaxQuote,
    customCalculatedQuote,
    effectiveMultiplier: chargeTotals.multiplier,
  };
}
