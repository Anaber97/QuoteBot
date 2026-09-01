// src/lib/pricingEngine.js
/**
 * SHARED PRICING ENGINE
 * 
 * Pure, environment-neutral calculation logic used by both browser and server.
 * This module ensures quotes calculated in the browser match those persisted by the server.
 * No Google Maps calls, no async operations, no side effects.
 */

const toFinite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const roundToNearest = (value, interval = 25) => {
  const normInterval = toFinite(interval, 25) || 25;
  return Math.round(value / normInterval) * normInterval;
};

const normalizeBuffer = (value) => {
  const number = toFinite(value, 10);
  return number > 1.5 ? 1 + number / 100 : number;
};

/**
 * Resolves base hourly or mileage rates based on pricing mode, tier, or truck class.
 * @param {Object} options
 * @returns {Object} { minRate, maxRate, standardPricingMode }
 */
export function resolveBaseRates({
  pricingMode = 'hourly',
  useWeightTierPricing = false,
  tier = null,
  selectedClass = null,
  isHeavy = false,
  pricing = {},
  config = {},
}) {
  const isMileageMode = pricingMode === 'mileage' && !useWeightTierPricing;
  let minRate = 125;
  let maxRate = 135;
  let standardPricingMode = 'hourly';

  if (isMileageMode) {
    minRate = toFinite(selectedClass?.minMileageRate ?? pricing.mileage_min, 5);
    maxRate = toFinite(selectedClass?.maxMileageRate ?? pricing.mileage_max, 6);
    standardPricingMode = 'mileage';
  } else if (useWeightTierPricing && tier) {
    minRate = maxRate = toFinite(tier.rate, 100);
    standardPricingMode = 'equipment-weight-tier';
  } else if (selectedClass) {
    minRate = toFinite(selectedClass.minRate ?? pricing.hourly_min ?? config.hourly_min, 125);
    maxRate = toFinite(selectedClass.maxRate ?? pricing.hourly_max ?? config.hourly_max, 135);
    standardPricingMode = 'hourly';
  } else if (isHeavy) {
    minRate = toFinite(pricing.heavy_hourly_min ?? config.heavy_hourly_min, 200);
    maxRate = toFinite(pricing.heavy_hourly_max ?? config.heavy_hourly_max, 250);
    standardPricingMode = 'hourly';
  } else {
    minRate = toFinite(pricing.hourly_min ?? config.hourly_min, 125);
    maxRate = toFinite(pricing.hourly_max ?? config.hourly_max, 135);
    standardPricingMode = 'hourly';
  }

  return { minRate, maxRate, standardPricingMode };
}

/**
 * Calculates adjusted drive time and total work hours from raw route data.
 * @param {Object} options
 * @returns {Object} { rawTotalHours, adjustedDriveMinutes, loadUnloadMinutes }
 */
export function calculateTimeMetrics({
  rawDriveMinutes = 0,
  baseLoadMinutes = 30,
  extraStopMinutes = 15,
  extraStopCount = 0,
  driveTimeBuffer = 10,
  useWeightTierPricing = false,
  tier = null,
  selectedClass = null,
}) {
  const driveBuffer = normalizeBuffer(
    useWeightTierPricing
      ? tier?.drive_time_buffer ?? 10
      : selectedClass?.drive_time_buffer ?? driveTimeBuffer
  );

  const adjustedDriveMinutes = rawDriveMinutes * driveBuffer;
  
  const baseLoad = useWeightTierPricing
    ? toFinite(tier?.load_unload_base_mins, 30)
    : toFinite(selectedClass?.load_unload_base_mins ?? baseLoadMinutes, 30);

  const loadUnloadMinutes = baseLoad + extraStopCount * toFinite(extraStopMinutes, 15);
  const rawTotalHours = (adjustedDriveMinutes + loadUnloadMinutes) / 60;

  return {
    rawTotalHours,
    adjustedDriveMinutes: Math.round(adjustedDriveMinutes),
    loadUnloadMinutes: Math.round(loadUnloadMinutes),
  };
}

/**
 * Applies surcharges and determines effective pricing multiplier.
 * @param {Object} options
 * @returns {Object} { multiplier, flatSum }
 */
export function calculateSurcharges({
  metroMatches = [],
  hazardMatches = [],
  customMatches = [],
  customSurcharges = [],
  useWeightTierPricing = false,
  overrides = {},
}) {
  const charge = { multiplier: 1, flat: 0 };
  
  const add = (feeType, value) => {
    const val = toFinite(value, 0);
    if (val === 0) return;
    if (feeType === 'flat') {
      charge.flat += val;
    } else {
      charge.multiplier *= 1 + val / 100;
    }
  };

  // Metro surcharge (only if not using weight tier)
  if (!useWeightTierPricing && metroMatches.length > 0 && overrides.metro !== false) {
    add(metroMatches[0].charge?.feeType || 'percent', metroMatches[0].charge?.value);
  }

  // Hazard surcharges (only if not using weight tier)
  if (!useWeightTierPricing && hazardMatches.length > 0 && overrides.hazard !== false) {
    hazardMatches.forEach((zone) => {
      add(zone.charge?.feeType || 'percent', zone.charge?.value);
    });
  }

  // Custom geofence surcharges (always applied if matched)
  customMatches.forEach((zone) => {
    add(zone.charge?.feeType || 'percent', zone.charge?.value);
  });

  // Custom surcharges (from config)
  customSurcharges
    .filter((item) => item.active !== false && overrides.customSurcharges?.[item.id] === true)
    .forEach((item) => {
      add(item.feeType || 'percent', item.value);
    });

  return { multiplier: charge.multiplier, flatSum: charge.flat };
}

/**
 * Determines if flat custom geofence zones override the calculated quote.
 * @returns {number} Maximum flat rate from custom zones, or 0
 */
export function getFlatOverride(customMatches = []) {
  return customMatches
    .filter((zone) => zone.charge?.feeType === 'flat')
    .reduce((max, zone) => Math.max(max, toFinite(zone.charge?.value, 0)), 0);
}

/**
 * Calculates final quote amounts given base rates and surcharges.
 * @param {Object} options
 * @returns {Object} { minQuote, maxQuote, customQuote }
 */
export function calculateFinalQuotes({
  pricingQuantity = 0, // hours or miles
  minRate = 125,
  maxRate = 135,
  surchargeMultiplier = 1,
  surchargeFlatSum = 0,
  permitFee = 0,
  rounding = 25,
  customRate = null,
  customQuantity = null,
  flatOverride = 0,
}) {
  if (flatOverride > 0) {
    const overriddenQuote = roundToNearest(flatOverride, rounding) + permitFee;
    return {
      minQuote: overriddenQuote,
      maxQuote: overriddenQuote,
      customQuote: overriddenQuote,
    };
  }

  const minQuote = roundToNearest(
    pricingQuantity * minRate * surchargeMultiplier + surchargeFlatSum + permitFee,
    rounding
  );

  const maxQuote = roundToNearest(
    pricingQuantity * maxRate * surchargeMultiplier + surchargeFlatSum + permitFee,
    rounding
  );

  let customQuote = null;
  if (customRate != null && toFinite(customRate) > 0 && customQuantity != null) {
    customQuote = roundToNearest(
      toFinite(customQuantity) * toFinite(customRate) * surchargeMultiplier + surchargeFlatSum + permitFee,
      rounding
    );
  }

  return { minQuote, maxQuote, customQuote };
}

/**
 * Calculates permit requirements and fees.
 * @param {Object} options
 * @returns {Object} { needsPermit, isInterstate, flags, permitFee }
 */
export function calculatePermitRequirements({
  weight = 0,
  width = 0,
  height = 0,
  pickupAddress = '',
  dropoffAddress = '',
  baseFee = 150,
}) {
  const state = (address) => String(address || '').match(/\b([A-Z]{2})\b/)?.[1] || '';
  const pickupState = state(pickupAddress);
  const dropoffState = state(dropoffAddress);
  const isInterstate = Boolean(pickupState && dropoffState && pickupState !== dropoffState);
  
  const flags = [];
  if (weight > 45000) flags.push(`Overweight (${weight.toLocaleString()} lbs > 45,000 lbs limit)`);
  if (width > 102) flags.push(`Oversize Width (${width} in > 102 in limit)`);
  if (height > 162) flags.push(`Oversize Height (${height} in > 162 in limit)`);
  if (isInterstate) flags.push(`Interstate Crossing (${pickupState} → ${dropoffState})`);
  
  const needsPermit = weight > 45000 || width > 102 || height > 162;
  const permitFee = needsPermit ? toFinite(baseFee, 150) * (isInterstate ? 1.5 : 1) : 0;

  return { needsPermit, isInterstate, flags, permitFee };
}
