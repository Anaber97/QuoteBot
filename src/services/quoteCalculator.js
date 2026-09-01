// src/services/quoteCalculator.js
// @ts-check
import { METRO_CODE_BY_ZONE_ID } from '../config/geofences';
import { evaluateMetroGeofences, evaluateHazardGeofences, evaluateCustomGeofences } from '../utils/geofenceEngine';
import { loadGoogleMaps } from '../lib/googleMaps';

/**
 * Ensures Google Maps JS API is fully initialized.
 */
async function verifyGoogleMapsLoaded() {
  await loadGoogleMaps({ requireDistanceMatrix: false });
  if (typeof window === 'undefined' || !window.google?.maps?.DirectionsService) {
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
                const components = results[0].address_components || [];
                const component = (...types) => components.find((item) => types.some((type) => item.types?.includes(type)));
                const city = component('locality', 'postal_town', 'administrative_area_level_3', 'sublocality')?.long_name || '';
                const state = component('administrative_area_level_1')?.short_name || '';
                resolve({ lat: loc.lat(), lng: loc.lng(), city, state, formattedAddress: results[0].formatted_address || addr });
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
  useWeightTierPricing = false,
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

  // Request the route once and reuse its legs and geometry for quote math and all
  // geofence checks. A previous implementation made a separate Directions call
  // for every configured zone and requested an N x N matrix for N route legs.
  const fullRouteAddresses = [currentBase.address, ...cleanWaypoints, currentBase.address];
  const directionsService = new window.google.maps.DirectionsService();
  const directionsResult = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Google route request timed out. Check network or address validity.'));
    }, 12000);

    directionsService.route(
      {
        origin: fullRouteAddresses[0],
        destination: fullRouteAddresses[fullRouteAddresses.length - 1],
        waypoints: fullRouteAddresses.slice(1, -1).map((address) => ({
          location: address,
          stopover: true,
        })),
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        clearTimeout(timeout);
        if (status === 'OK' && result?.routes?.[0]) {
          resolve(result);
        } else {
          reject(new Error(`Google Directions API failed with status: ${status}.`));
        }
      }
    );
  });

  const routeLegs = directionsResult.routes[0].legs || [];
  if (routeLegs.length !== fullRouteAddresses.length - 1) {
    throw new Error('Google returned an incomplete route. Please verify all addresses and try again.');
  }
  const rawTotalMins = routeLegs.reduce((total, leg) => total + Number(leg.duration?.value || 0) / 60, 0);
  const totalMeters = routeLegs.reduce((total, leg) => total + Number(leg.distance?.value || 0), 0);

  let baseMinRate = Number(pricing.hourly_min || companyRates.hourly_min) || 125;
  let baseMaxRate = Number(pricing.hourly_max || companyRates.hourly_max) || 135;

  const clientWeightTiers = clientConfig?.pricing?.use_custom_pricing && Array.isArray(clientConfig?.pricing?.weight_tiers)
    ? clientConfig.pricing.weight_tiers
    : companyRates?.client_portal?.weight_tiers || [];
  const matchingTier = clientWeightTiers.find((tier) => {
    const min = Number(tier.minWeight ?? 0) || 0;
    const max = Number(tier.maxWeight ?? 999999) || 999999;
    return clientWeight >= min && clientWeight <= max;
  });

  if (useWeightTierPricing && !matchingTier) {
    throw new Error(`No equipment weight class is configured for ${Number(clientWeight || 0).toLocaleString()} lbs.`);
  }

  if (useWeightTierPricing && matchingTier) {
    baseMinRate = Number(matchingTier.rate) || baseMinRate;
    baseMaxRate = Number(matchingTier.rate) || baseMaxRate;
  }

  const tierDriveBuffer = useWeightTierPricing ? matchingTier?.drive_time_buffer : undefined;
  const tierLoadMins = useWeightTierPricing ? matchingTier?.load_unload_base_mins : undefined;
  const customClasses = pricing.custom_truck_classes || [];
  const selectedClass = customClasses.find((item) => item.id === selectedTruckClassId);
  const selectedClassDriveBuffer = selectedClass?.drive_time_buffer;
  const selectedClassLoadMins = selectedClass?.load_unload_base_mins;

  const bufferedDriveMins = useWeightTierPricing
    ? rawTotalMins * normalizeBuffer(tierDriveBuffer ?? 10)
    : rawTotalMins * (Number.isFinite(Number(selectedClassDriveBuffer))
      ? normalizeBuffer(selectedClassDriveBuffer)
      : Number.isFinite(Number(tierDriveBuffer)) ? normalizeBuffer(tierDriveBuffer) : driveBuffer);
  const extraStopsCount = Math.max(0, cleanWaypoints.length - 2);
  const clientLoadMins = clientConfig?.pricing?.load_unload_base_mins ?? null;
  const clientExtraStopMins = clientConfig?.pricing?.extra_stop_mins ?? null;
  const totalOnSiteMins = useWeightTierPricing
    ? (Number(tierLoadMins ?? 30) || 30) + extraStopsCount * (clientExtraStopMins ?? extraStopMins)
    : (Number.isFinite(Number(selectedClassLoadMins))
      ? Number(selectedClassLoadMins)
      : Number.isFinite(Number(tierLoadMins)) ? Number(tierLoadMins) : (clientLoadMins ?? baseLoadMins)) + extraStopsCount * (clientExtraStopMins ?? extraStopMins);
  const rawTotalHours = (bufferedDriveMins + totalOnSiteMins) / 60;
  const totalMiles = totalMeters * 0.000621371;
  const standardPricingMode = pricing.pricing_mode === 'mileage' && !useWeightTierPricing ? 'mileage' : 'hourly';

  const legsDetails = routeLegs.map((leg, index) => {
    const durationMinutes = Number(((leg.duration?.value || 0) / 60).toFixed(1));
    const startLabel = index === 0 ? 'Base' : (cleanWaypoints[index - 1] || `Stop ${index}`);
    const endLabel = index === routeLegs.length - 1 ? 'Base' : (cleanWaypoints[index] || `Stop ${index + 1}`);
    return { label: `${startLabel} → ${endLabel}`, minutes: durationMinutes };
  });

  if (useWeightTierPricing) {
    baseMinRate = Number(matchingTier.rate);
    baseMaxRate = Number(matchingTier.rate);
  } else if (selectedClass) {
    baseMinRate = Number(standardPricingMode === 'mileage' ? selectedClass.minMileageRate : selectedClass.minRate) || baseMinRate;
    baseMaxRate = Number(standardPricingMode === 'mileage' ? selectedClass.maxMileageRate : selectedClass.maxRate) || baseMaxRate;
  } else if (isHeavy) {
    baseMinRate = Number(companyRates.heavy_hourly_min || pricing.heavy_hourly_min) || 200;
    baseMaxRate = Number(companyRates.heavy_hourly_max || pricing.heavy_hourly_max) || 250;
  }

  // Keep breakdown pricing dollar-accurate even when displayed totals use a
  // larger configured quote interval.
  if (standardPricingMode === 'mileage') {
    baseMinRate = Number(selectedClass?.minMileageRate ?? pricing.mileage_min) || 5;
    baseMaxRate = Number(selectedClass?.maxMileageRate ?? pricing.mileage_max) || 6;
  }
  const pricingQuantity = standardPricingMode === 'mileage' ? totalMiles : rawTotalHours;
  const baseMinQuote = Math.round(pricingQuantity * baseMinRate);
  const baseMaxQuote = Math.round(pricingQuantity * baseMaxRate);

  // Geofence evaluations
  const toPoint = (location) => location && typeof location.lat === 'function'
    ? { lat: location.lat(), lng: location.lng() }
    : null;
  // Each outbound leg ends at the corresponding customer waypoint.
  const coordsList = routeLegs.slice(0, cleanWaypoints.length).map((leg) => toPoint(leg.end_location));
  // Exclude the base-to-pickup and dropoff-to-base legs: surcharges apply to
  // the customer-requested journey, matching the prior geofence behavior.
  const customerRoutePoints = routeLegs.slice(1, cleanWaypoints.length).flatMap((leg) =>
    (leg.steps || []).flatMap((step) => (step.path || []).map(toPoint).filter(Boolean))
  );
  const metroMatches = await evaluateMetroGeofences(cleanWaypoints, coordsList, companyRates, customerRoutePoints);
  const hazardMatches = await evaluateHazardGeofences(cleanWaypoints, coordsList, companyRates, customerRoutePoints);
  const resolvedLocations = (companyRates?.geofences?.customZones || []).length > 0 ? await geocodeAll(cleanWaypoints) : [];
  const customMatches = await evaluateCustomGeofences(cleanWaypoints, coordsList, companyRates, resolvedLocations);
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
    fixedHourlyRate: useWeightTierPricing ? Number(matchingTier.rate) : null,
    roundingInterval: useWeightTierPricing
      ? Number(matchingTier.rounding_interval ?? clientPricing.rounding_interval ?? pricing.rounding_interval ?? 25) || 25
      : null,
    pricingMode: useWeightTierPricing ? 'equipment-weight-tier' : standardPricingMode,
    weightTierLabel: useWeightTierPricing ? matchingTier.label : null,
    driveTimeBufferPercent: useWeightTierPricing ? Number(tierDriveBuffer ?? 10) || 10 : null,
  };
}

/**
 * Calculates effective multiplier and final min/max/custom pricing.
 */
export function calculateFinalQuotes(quoteData, activeOverrides, customRate, companyRates = {}, customLoadUnloadMins = null) {
  if (!quoteData) {
    return { currentMinQuote: 0, currentMaxQuote: 0, customCalculatedQuote: null, effectiveMultiplier: 1.0 };
  }

  if (quoteData.pricingMode === 'equipment-weight-tier' && Number.isFinite(Number(quoteData.fixedHourlyRate))) {
    const customSurchargeTotal = (companyRates?.pricing?.custom_surcharges || [])
      .filter((item) => item.active !== false && activeOverrides?.customSurcharges?.[item.id] === true)
      .reduce((totals, item) => {
        const value = Number(item.value) || 0;
        return item.feeType === 'percent'
          ? { ...totals, multiplier: totals.multiplier * (1 + value / 100) }
          : { ...totals, flat: totals.flat + value };
      }, { multiplier: 1, flat: 0 });
    const fixedQuote = roundToNearest(
      (Number(quoteData.rawTotalHours || 0) * Number(quoteData.fixedHourlyRate) * customSurchargeTotal.multiplier) + customSurchargeTotal.flat,
      Number(quoteData.roundingInterval || 25)
    );
    return {
      currentMinQuote: fixedQuote,
      currentMaxQuote: fixedQuote,
      customCalculatedQuote: null,
      effectiveMultiplier: customSurchargeTotal.multiplier,
    };
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

  const isMileageMode = quoteData.pricingMode === 'mileage';
  let baseMinRate = isMileageMode ? (Number(pricing.mileage_min) || 5) : (Number(pricing.hourly_min || companyRates.hourly_min) || 125);
  let baseMaxRate = isMileageMode ? (Number(pricing.mileage_max) || 6) : (Number(pricing.hourly_max || companyRates.hourly_max) || 135);

  const customClasses = pricing.custom_truck_classes || [];
  const selectedClass = customClasses.find((c) => c.id === quoteData.selectedTruckClassId);

  if (selectedClass) {
    baseMinRate = Number(isMileageMode ? selectedClass.minMileageRate : selectedClass.minRate) || baseMinRate;
    baseMaxRate = Number(isMileageMode ? selectedClass.maxMileageRate : selectedClass.maxRate) || baseMaxRate;
  } else if (quoteData.isHeavy && !isMileageMode) {
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

  const pricingQuantity = isMileageMode ? Number(quoteData.totalMiles || 0) : quoteData.rawTotalHours;
  const currentMinQuote = roundToNearest((pricingQuantity * baseMinRate * chargeTotals.multiplier) + chargeTotals.flat, roundingInterval);
  const currentMaxQuote = roundToNearest((pricingQuantity * baseMaxRate * chargeTotals.multiplier) + chargeTotals.flat, roundingInterval);

  const parsedCustomRate = Number(customRate);
  const customHours = customLoadUnloadMins === null || customLoadUnloadMins === ''
    ? quoteData.rawTotalHours
    : Math.max(0, quoteData.rawTotalHours + (Number(customLoadUnloadMins) - Number(quoteData.loadUnloadTime || 0)) / 60);
  const customQuantity = isMileageMode ? Number(quoteData.totalMiles || 0) : customHours;
  const customCalculatedQuote = parsedCustomRate > 0
    ? roundToNearest((customQuantity * parsedCustomRate * chargeTotals.multiplier) + chargeTotals.flat, roundingInterval)
    : null;

  return {
    currentMinQuote,
    currentMaxQuote,
    customCalculatedQuote,
    effectiveMultiplier: chargeTotals.multiplier,
  };
}
