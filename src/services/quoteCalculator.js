// src/services/quoteCalculator.js
// @ts-check
import { METRO_CODE_BY_ZONE_ID } from '../config/geofences';
import { evaluateMetroGeofences, evaluateHazardGeofences, evaluateCustomGeofences } from '../utils/geofenceEngine';
import { loadGoogleMaps } from '../lib/googleMaps';
import {
  roundToNearest,
  resolveBaseRates,
  calculateTimeMetrics,
  calculateSurcharges,
  getFlatOverride,
  calculateFinalQuotes as calculateFinalQuotesPure,
} from '../lib/pricingEngine';

export { roundToNearest }; // Re-export for backward compatibility

/**
 * Ensures Google Maps JS API is fully initialized.
 */
async function verifyGoogleMapsLoaded() {
  await loadGoogleMaps({ requireDistanceMatrix: false });
  if (typeof window === 'undefined' || !window.google?.maps?.DirectionsService) {
    throw new Error('Google Maps API is disconnected or not loaded yet. Check VITE_GOOGLE_MAPS_API_KEY in .env.');
  }
}

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
  const driveTimeBuffer = clientPricing.drive_time_buffer ?? pricing.drive_time_buffer ?? companyRates.drive_time_buffer ?? 10;
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

  const customClasses = pricing.custom_truck_classes || [];
  const selectedClass = customClasses.find((item) => item.id === selectedTruckClassId);
  const extraStopsCount = Math.max(0, cleanWaypoints.length - 2);
  const clientLoadMins = clientConfig?.pricing?.load_unload_base_mins ?? null;
  const clientExtraStopMins = clientConfig?.pricing?.extra_stop_mins ?? null;

  // Shared with the server (api/_quoteEngine.js) so browser and server never
  // independently re-derive the buffered drive time / on-site time math.
  const { rawTotalHours, adjustedDriveMinutes: bufferedDriveMins, loadUnloadMinutes: totalOnSiteMins } = calculateTimeMetrics({
    rawDriveMinutes: rawTotalMins,
    baseLoadMinutes: clientLoadMins ?? baseLoadMins,
    extraStopMinutes: clientExtraStopMins ?? extraStopMins,
    extraStopCount: extraStopsCount,
    driveTimeBuffer,
    useWeightTierPricing,
    tier: matchingTier,
    selectedClass,
  });
  const totalMiles = totalMeters * 0.000621371;

  // Shared with the server so rate resolution can't silently drift.
  const { minRate: baseMinRate, maxRate: baseMaxRate, standardPricingMode } = resolveBaseRates({
    pricingMode: pricing.pricing_mode,
    useWeightTierPricing,
    tier: matchingTier,
    selectedClass,
    isHeavy,
    pricing,
    config: companyRates,
  });

  const legsDetails = routeLegs.map((leg, index) => {
    const durationMinutes = Number(((leg.duration?.value || 0) / 60).toFixed(1));
    const startLabel = index === 0 ? 'Base' : (cleanWaypoints[index - 1] || `Stop ${index}`);
    const endLabel = index === routeLegs.length - 1 ? 'Base' : (cleanWaypoints[index] || `Stop ${index + 1}`);
    return { label: `${startLabel} → ${endLabel}`, minutes: durationMinutes };
  });

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
    fixedHourlyRate: useWeightTierPricing ? Number(matchingTier.hourlyRate ?? matchingTier.rate) : null,
    fixedRate: useWeightTierPricing ? Number(standardPricingMode === 'mileage' ? matchingTier.mileageRate : matchingTier.hourlyRate ?? matchingTier.rate) : null,
    pricingRateMode: standardPricingMode,
    roundingInterval: useWeightTierPricing
      ? Number(matchingTier.rounding_interval ?? clientPricing.rounding_interval ?? pricing.rounding_interval ?? 25) || 25
      : null,
    pricingMode: useWeightTierPricing ? 'equipment-weight-tier' : standardPricingMode,
    weightTierLabel: useWeightTierPricing ? matchingTier.label : null,
    driveTimeBufferPercent: useWeightTierPricing ? Number(matchingTier?.drive_time_buffer ?? 10) || 10 : null,
  };
}

/**
 * Calculates effective multiplier and final min/max/custom pricing.
 * Uses shared pricingEngine to ensure parity with server calculations.
 */
export function calculateFinalQuotes(quoteData, activeOverrides, customRate, companyRates = {}, customLoadUnloadMins = null) {
  if (!quoteData) {
    return { currentMinQuote: 0, currentMaxQuote: 0, customCalculatedQuote: null, effectiveMultiplier: 1.0 };
  }

  const pricing = companyRates?.pricing || {};
  const roundingInterval = Number(pricing.rounding_interval || companyRates.rounding_interval) || 25;
  const isMileageMode = (quoteData.pricingRateMode || quoteData.pricingMode) === 'mileage';

  // Resolve base rates using shared logic
  const { minRate, maxRate } = resolveBaseRates({
    pricingMode: quoteData.pricingRateMode || quoteData.pricingMode,
    useWeightTierPricing: quoteData.pricingMode === 'equipment-weight-tier',
    tier: quoteData.fixedRate != null ? { rate: quoteData.fixedRate, hourlyRate: quoteData.fixedRate, mileageRate: quoteData.fixedRate } : null,
    selectedClass: pricing.custom_truck_classes?.find((c) => c.id === quoteData.selectedTruckClassId),
    isHeavy: quoteData.isHeavy,
    pricing,
    config: companyRates,
  });

  // Calculate surcharges using shared logic
  const { multiplier, flatSum } = calculateSurcharges({
    metroMatches: quoteData.hasMetroZone ? quoteData.metroMatches : [],
    hazardMatches: quoteData.hasHazardZone ? quoteData.hazardMatches : [],
    customMatches: quoteData.customMatches || [],
    customSurcharges: pricing.custom_surcharges || [],
    useWeightTierPricing: quoteData.pricingMode === 'equipment-weight-tier',
    overrides: activeOverrides,
  });

  // Check for flat override
  const flatOverride = getFlatOverride(quoteData.customMatches || []);

  // Determine pricing quantity
  const pricingQuantity = isMileageMode ? Number(quoteData.totalMiles || 0) : quoteData.rawTotalHours;

  // Calculate custom quantity if custom load time is provided
  let customQuantity = pricingQuantity;
  if (customLoadUnloadMins !== null && customLoadUnloadMins !== '') {
    const customHours = Math.max(0, quoteData.rawTotalHours + (Number(customLoadUnloadMins) - Number(quoteData.loadUnloadTime || 0)) / 60);
    customQuantity = isMileageMode ? Number(quoteData.totalMiles || 0) : customHours;
  }

  // Use shared final quote calculation
  const result = calculateFinalQuotesPure({
    pricingQuantity,
    minRate,
    maxRate,
    surchargeMultiplier: multiplier,
    surchargeFlatSum: flatSum,
    permitFee: 0, // Browser doesn't calculate permit fees
    rounding: roundingInterval,
    customRate: customRate != null ? customRate : null,
    customQuantity: customLoadUnloadMins !== null && customLoadUnloadMins !== '' ? customQuantity : null,
    flatOverride,
  });

  return {
    currentMinQuote: result.minQuote,
    currentMaxQuote: result.maxQuote,
    customCalculatedQuote: result.customQuote,
    effectiveMultiplier: multiplier,
  };
}
