// src/lib/pricingEngine.js
/**
 * SHARED PRICING ENGINE
 * 
 * Pure, environment-neutral calculation logic used by both browser and server.
 * This module ensures quotes calculated in the browser match those persisted by the server.
 * No Google Maps calls, no async operations, no side effects.
 */

import { addressState } from '../../shared/geo/addressMatch.js';

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
 * Legacy min/max fields are retained for storage compatibility, but quotes use
 * the former minimum as one deterministic rate.
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
  const isMileageMode = pricingMode === 'mileage';
  let minRate = 125;
  let maxRate = 135;
  let standardPricingMode = 'hourly';

  if (useWeightTierPricing && tier) {
    minRate = maxRate = toFinite(isMileageMode ? tier.mileageRate : tier.hourlyRate ?? tier.rate, isMileageMode ? 5 : 100);
    standardPricingMode = isMileageMode ? 'mileage' : 'hourly';
  } else if (isMileageMode) {
    minRate = toFinite(selectedClass?.mileageRate ?? selectedClass?.minMileageRate ?? pricing.mileage_rate ?? pricing.mileage_min, 5);
    maxRate = minRate;
    standardPricingMode = 'mileage';
  } else if (selectedClass) {
    minRate = toFinite(selectedClass.hourlyRate ?? selectedClass.rate ?? selectedClass.minRate ?? pricing.hourly_rate ?? pricing.hourly_min ?? config.hourly_rate ?? config.hourly_min, 125);
    maxRate = minRate;
    standardPricingMode = 'hourly';
  } else if (isHeavy) {
    minRate = toFinite(pricing.heavy_hourly_min ?? config.heavy_hourly_min, 200);
    maxRate = minRate;
    standardPricingMode = 'hourly';
  } else {
    minRate = toFinite(pricing.hourly_rate ?? pricing.hourly_min ?? config.hourly_rate ?? config.hourly_min, 125);
    maxRate = minRate;
    standardPricingMode = 'hourly';
  }

  return { minRate, maxRate, standardPricingMode };
}

/**
 * Calculates adjusted drive time and total work hours from raw route data.
 * @param {Object} options
 * @returns {Object} { rawTotalHours, adjustedDriveMinutes, loadUnloadMinutes, driveTimeBufferPercent }
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
    driveTimeBufferPercent: Number(((driveBuffer - 1) * 100).toFixed(2)),
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
  allowRouteSurcharges = !useWeightTierPricing,
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

  // Flat-rate, maximum and minimum zone rules are applied in calculateFinalQuotes.
  const surchargeZones = (zones) => zones.filter((zone) => zoneRuleMode(zone) === 'surcharge');
  const metroSurcharge = surchargeZones(metroMatches)[0];
  if (allowRouteSurcharges && metroSurcharge && overrides.metro !== false) {
    add(metroSurcharge.charge?.feeType || 'percent', metroSurcharge.charge?.value);
  }

  if (allowRouteSurcharges && overrides.hazard !== false) {
    surchargeZones(hazardMatches).forEach((zone) => {
      add(zone.charge?.feeType || 'percent', zone.charge?.value);
    });
  }

  // Custom geofence surcharges (always applied if matched)
  surchargeZones(customMatches).forEach((zone) => {
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
 * How a matched zone prices: 'surcharge', 'flat_rate', 'max_rate' or 'min_rate'.
 * Matches from older quotes may lack charge.pricingMode; a flat custom zone
 * (one with a drawn shape) was a flat rate then, and a built-in zone a surcharge.
 */
export function zoneRuleMode(zone = {}) {
  return zone.charge?.pricingMode ?? zone.pricingMode
    ?? (zone.charge?.feeType === 'max' ? 'max_rate' : zone.charge?.feeType === 'flat' && Array.isArray(zone.shape) ? 'flat_rate' : 'surcharge');
}

const ruleValues = (zones, mode) => zones
  .filter((zone) => zoneRuleMode(zone) === mode)
  .map((zone) => toFinite(zone.charge?.value ?? zone.price, 0))
  .filter((value) => value > 0);

/** The highest flat rate among matched zones, or 0. */
export function getFlatOverride(zoneMatches = []) {
  return Math.max(0, ...ruleValues(zoneMatches, 'flat_rate'));
}

/** The lowest maximum among matched zones, or 0. */
export function getMaxOverride(zoneMatches = []) {
  const limits = ruleValues(zoneMatches, 'max_rate');
  return limits.length ? Math.min(...limits) : 0;
}

/** The highest minimum among matched zones, or 0. */
export function getMinOverride(zoneMatches = []) {
  return Math.max(0, ...ruleValues(zoneMatches, 'min_rate'));
}

/**
 * Calculates final quote amounts given base rates and surcharges.
 * @param {Object} options
 * @returns {Object} { minQuote, maxQuote, customQuote }
 */
export function applyQuoteTimeOverrides({ rawTotalHours = 0, loadUnloadMinutes = 0, driveTimeBufferPercent = 0, customLoadUnloadMins, customDriveTimeBufferPercent }) {
  const override = (value, fallback, maximum) => value == null || value === '' || !Number.isFinite(Number(value))
    ? fallback : Math.min(maximum, Math.max(0, Number(value)));
  const buffer = override(customDriveTimeBufferPercent, driveTimeBufferPercent, 1000);
  const load = override(customLoadUnloadMins, loadUnloadMinutes, 10080);
  const originalDrive = Math.max(0, rawTotalHours * 60 - loadUnloadMinutes);
  const adjustedDriveMinutes = buffer === driveTimeBufferPercent ? originalDrive
    : originalDrive / (1 + driveTimeBufferPercent / 100 || 1) * (1 + buffer / 100);
  return { rawTotalHours: (adjustedDriveMinutes + load) / 60, adjustedDriveMinutes, loadUnloadMinutes: load, driveTimeBufferPercent: buffer };
}

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
  maxOverride = 0,
  minOverride = 0,
}) {
  // permitFee carries pass-through costs (permits, escorts). Flat-rate,
  // maximum and minimum zones price the haul only; those costs are always
  // added on top. A minimum wins over a maximum when both match.
  const limit = (haul) => Math.max(maxOverride > 0 ? Math.min(haul, maxOverride) : haul, minOverride);
  const total = (haul) => roundToNearest(limit(haul) + permitFee, rounding);
  if (flatOverride > 0) {
    const overriddenQuote = total(roundToNearest(flatOverride, rounding));
    return { minQuote: overriddenQuote, maxQuote: overriddenQuote, customQuote: overriddenQuote };
  }

  let customQuote = null;
  if (customRate != null && toFinite(customRate) > 0 && customQuantity != null) {
    customQuote = total(toFinite(customQuantity) * toFinite(customRate) * surchargeMultiplier + surchargeFlatSum);
  }

  return {
    minQuote: total(pricingQuantity * minRate * surchargeMultiplier + surchargeFlatSum),
    maxQuote: total(pricingQuantity * maxRate * surchargeMultiplier + surchargeFlatSum),
    customQuote,
  };
}

/** Matches on whole pounds, so 20,000.5 lbs lands in the 20,001+ class instead of between classes. */
export function findWeightTier(tiers = [], weight = 0) {
  const pounds = Math.ceil(toFinite(weight));
  return (Array.isArray(tiers) ? tiers : []).find((tier) =>
    pounds >= toFinite(tier?.minWeight, 0) && pounds <= toFinite(tier?.maxWeight, 999999));
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
  const pickupState = addressState(pickupAddress);
  const dropoffState = addressState(dropoffAddress);
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

/** Resolves the highest escort requirement triggered by width or height. */
export function resolveEscortRequirement({ width = 0, height = 0, rules = [] } = {}) {
  const numericWidth = toFinite(width);
  const numericHeight = toFinite(height);
  const matches = (Array.isArray(rules) ? rules : []).filter((rule) => {
    const minWidth = toFinite(rule?.minWidth);
    const minHeight = toFinite(rule?.minHeight);
    return (minWidth > 0 && numericWidth >= minWidth) || (minHeight > 0 && numericHeight >= minHeight);
  });
  const rule = matches.sort((a, b) => toFinite(b.vehicleCount) - toFinite(a.vehicleCount))[0];
  if (!rule) return { vehicleCount: 0, surcharge: 0, triggeredBy: [] };
  const triggeredBy = [];
  if (toFinite(rule.minWidth) > 0 && numericWidth >= toFinite(rule.minWidth)) triggeredBy.push('width');
  if (toFinite(rule.minHeight) > 0 && numericHeight >= toFinite(rule.minHeight)) triggeredBy.push('height');
  return { vehicleCount: toFinite(rule.vehicleCount), surcharge: toFinite(rule.surcharge), triggeredBy };
}
