// src/services/quoteCalculator.js
// @ts-check
import { RATES } from '../config/rates';
import { evaluateMetroGeofences, evaluateHazardGeofences } from '../utils/geofenceEngine';
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
  const driveBuffer = Number(pricing.drive_time_buffer || companyRates.drive_time_buffer) || 1.10;
  const baseLoadMins = Number(pricing.load_unload_base_mins || companyRates.load_unload_base_mins) || 30;
  const extraStopMins = Number(pricing.extra_stop_mins || companyRates.extra_stop_mins) || 15;

  // Build full route array: Base -> Pick-up -> [Waypoints...] -> Drop-off -> Base
  const fullRouteAddresses = [currentBase.address, ...cleanWaypoints, currentBase.address];
  const service = new window.google.maps.DistanceMatrixService();

  const origins = fullRouteAddresses.slice(0, -1);
  const destinations = fullRouteAddresses.slice(1);

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

  for (let i = 0; i < origins.length; i++) {
    const element = matrixResponse.rows[i]?.elements[i];
    if (element && element.status === 'OK') {
      rawTotalMins += element.duration.value / 60;
      totalMeters += element.distance.value;
    } else {
      throw new Error(`Unable to calculate route from "${origins[i]}" to "${destinations[i]}". Status: ${element?.status || 'UNKNOWN'}`);
    }
  }

  const bufferedDriveMins = rawTotalMins * driveBuffer;
  const extraStopsCount = Math.max(0, cleanWaypoints.length - 2);
  const totalOnSiteMins = baseLoadMins + extraStopsCount * extraStopMins;
  const rawTotalHours = (bufferedDriveMins + totalOnSiteMins) / 60;
  const totalMiles = totalMeters * 0.000621371;

  let baseMinRate = Number(pricing.hourly_min || companyRates.hourly_min) || 125;
  let baseMaxRate = Number(pricing.hourly_max || companyRates.hourly_max) || 135;

  const customClasses = pricing.custom_truck_classes || [];
  const selectedClass = customClasses.find((c) => c.id === selectedTruckClassId);

  if (selectedClass) {
    baseMinRate = Number(selectedClass.minRate) || baseMinRate;
    baseMaxRate = Number(selectedClass.maxRate) || baseMaxRate;
  } else if (isHeavy) {
    baseMinRate = Number(companyRates.heavy_hourly_min || pricing.heavy_hourly_min) || 200;
    baseMaxRate = Number(companyRates.heavy_hourly_max || pricing.heavy_hourly_max) || 250;
  }

  const roundingInterval = Number(pricing.rounding_interval || companyRates.rounding_interval) || 25;
  const baseMinQuote = roundToNearest(rawTotalHours * baseMinRate, roundingInterval);
  const baseMaxQuote = roundToNearest(rawTotalHours * baseMaxRate, roundingInterval);

  const legsDetails = origins.map((_, index) => {
    const durationMinutes = Number(((matrixResponse.rows[index]?.elements[index]?.duration?.value || 0) / 60).toFixed(1));
    const startLabel = index === 0 ? 'Base' : (cleanWaypoints[index - 1] || `Stop ${index}`);
    const endLabel = index === origins.length - 1 ? 'Base' : (cleanWaypoints[index] || `Stop ${index + 1}`);
    return { label: `${startLabel} → ${endLabel}`, minutes: durationMinutes };
  });

  // Geofence evaluations
  const coordsList = await geocodeAll(cleanWaypoints);
  const hitMetroZone = await evaluateMetroGeofences(cleanWaypoints, coordsList, companyRates);
  const hitHazardZone = await evaluateHazardGeofences(cleanWaypoints, coordsList, companyRates);

  return {
    rawTotalHours,
    totalMiles,
    selectedTruckClassId,
    isHeavy,
    hasAfterHours: isAfterHours,
    hasRoadClub: isRoadClub,
    hasMetroZone: hitMetroZone || isMetro,
    hasHazardZone: hitHazardZone || isHazard,
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
export function calculateFinalQuotes(quoteData, activeOverrides, customRate, companyRates = {}) {
  if (!quoteData) {
    return { currentMinQuote: 0, currentMaxQuote: 0, customCalculatedQuote: null, effectiveMultiplier: 1.0 };
  }

  const pricing = companyRates?.pricing || {};
  const surcharges = companyRates?.surcharges || {};

  const getMultiplier = (val, defaultPct) => {
    const num = Number(val ?? defaultPct);
    return num > 5 ? 1 + num / 100 : num;
  };

  const afterHoursMult = getMultiplier(surcharges.after_hours_multiplier, 25);
  const roadClubMult   = getMultiplier(surcharges.road_club_multiplier, 15);
  const metroMult      = getMultiplier(surcharges.metro_multiplier, 28.57);
  const hazardMult     = getMultiplier(surcharges.hazard_multiplier, 40);

  let effectiveMultiplier = 1.0;
  if (quoteData.hasAfterHours && activeOverrides?.afterHours) effectiveMultiplier *= afterHoursMult;
  if (quoteData.hasRoadClub   && activeOverrides?.roadClub)   effectiveMultiplier *= roadClubMult;
  if (quoteData.hasMetroZone  && activeOverrides?.metro)      effectiveMultiplier *= metroMult;
  if (quoteData.hasHazardZone && activeOverrides?.hazard)     effectiveMultiplier *= hazardMult;

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

  const currentMinQuote = roundToNearest(quoteData.rawTotalHours * baseMinRate * effectiveMultiplier, roundingInterval);
  const currentMaxQuote = roundToNearest(quoteData.rawTotalHours * baseMaxRate * effectiveMultiplier, roundingInterval);

  const parsedCustomRate = Number(customRate);
  const customCalculatedQuote = parsedCustomRate > 0
    ? roundToNearest(quoteData.rawTotalHours * parsedCustomRate * effectiveMultiplier, roundingInterval)
    : null;

  return {
    currentMinQuote,
    currentMaxQuote,
    customCalculatedQuote,
    effectiveMultiplier,
  };
}