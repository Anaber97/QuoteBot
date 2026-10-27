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

// Buffers are percents (10 = +10%). Older configs stored a multiplier from
// 1 to 1.5 (1.10 = +10%); below 1 can only be a percent, so 0 means no buffer.
const normalizeBuffer = (value) => {
  const number = Math.max(0, toFinite(value, 10));
  return number >= 1 && number <= 1.5 ? number : 1 + number / 100;
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

/**
 * Overnight stays forced by federal hours-of-service limits (49 CFR 395.3):
 * at most 11 hours of driving and a 14-hour on-duty window per day, with a
 * 30-minute break after 8 hours of driving. A permitted load can be held to
 * fewer travel hours a day (for example, daylight-only moves).
 *
 * The driver's days cover the whole round trip, yard to yard, including
 * load/unload time. Each escort counts only its own escorted driving
 * (`escortDriveMinutes`, one entry per escort vehicle). Charges are the
 * company's flat amounts per overnight; blank charges price at $0.
 */
export function calculateOvernights({ driveMinutes = 0, onSiteMinutes = 0, escortDriveMinutes = [], permittedLoad = false, settings = {} } = {}) {
  const hoursSetting = (value, fallback) => value != null && value !== '' && Number(value) > 0 ? Number(value) : fallback;
  const maxDrive = hoursSetting(settings?.maxDriveHours, 11);
  const maxOnDuty = hoursSetting(settings?.maxOnDutyHours, 14);
  const permittedHours = hoursSetting(settings?.permittedLoadHours, null);
  const permittedDay = permittedHours ? Math.min(maxDrive, permittedHours) : maxDrive;
  // Rounded before ceil so 11.0000001 hours stays one day.
  const days = (hours, perDay) => hours > 0 ? Math.ceil(Number((hours / perDay).toFixed(4))) : 0;
  const nights = (dayCount) => Math.max(0, dayCount - 1);

  const driveHours = Math.max(0, toFinite(driveMinutes)) / 60;
  const onDutyHours = driveHours + Math.max(0, toFinite(onSiteMinutes)) / 60 + Math.floor(driveHours / 8) * 0.5;
  const driver = nights(Math.max(days(driveHours, permittedLoad ? permittedDay : maxDrive), days(onDutyHours, maxOnDuty)));
  const escorts = escortDriveMinutes.map((minutes) => nights(days(Math.max(0, toFinite(minutes)) / 60, permittedDay)));
  const escortNights = escorts.reduce((sum, count) => sum + count, 0);
  const charge = driver * Math.max(0, toFinite(settings?.driverCharge)) + escortNights * Math.max(0, toFinite(settings?.escortCharge));
  return {
    driver,
    escorts,
    charge: Math.round(charge * 100) / 100,
    driveHours: Math.round(driveHours * 100) / 100,
    onDutyHours: Math.round(onDutyHours * 100) / 100,
  };
}

/** True when the driver or any escort needs at least one night. */
export const hasOvernights = (overnights) => Boolean(overnights && (overnights.driver > 0 || (overnights.escorts || []).some((count) => count > 0)));

/** Escorted driving minutes for each escort: the customer trip's minutes, prorated by the miles that escort is required. */
export function escortDriveMinutes(escortMiles = [], customerMiles = 0, customerDriveMinutes = 0) {
  return escortMiles.map((miles) => customerMiles > 0
    ? customerDriveMinutes * Math.min(1, Math.max(0, toFinite(miles)) / customerMiles)
    : customerDriveMinutes);
}

/** Straight-line miles along a route's points (great-circle distance between consecutive points). */
export function routeLineMiles(points = []) {
  const radians = (degrees) => degrees * Math.PI / 180;
  let miles = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1];
    const q = points[i];
    if (![p?.lat, p?.lng, q?.lat, q?.lng].every(Number.isFinite)) continue;
    const a = Math.sin(radians(q.lat - p.lat) / 2) ** 2
      + Math.cos(radians(p.lat)) * Math.cos(radians(q.lat)) * Math.sin(radians(q.lng - p.lng) / 2) ** 2;
    miles += 7917.6 * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  return miles;
}

/**
 * Per-mile escort pricing: each escort vehicle costs `perMile` for every mile
 * it is required, and never less than `minimum`. `milesPerVehicle` lists the
 * required miles for escort 1, escort 2, and so on. Returns null when the
 * company has no per-mile rate, so its flat escort prices apply instead.
 */
export function priceEscortMiles(milesPerVehicle = [], pricing = {}) {
  if (pricing?.perMile == null || pricing.perMile === '' || !Number.isFinite(Number(pricing.perMile))) return null;
  const perMile = Math.max(0, Number(pricing.perMile));
  const minimum = Math.max(0, toFinite(pricing.minimum, 0));
  const cost = milesPerVehicle.reduce((sum, miles) => sum + Math.max(perMile * Math.max(0, toFinite(miles)), minimum), 0);
  return Math.round(cost * 100) / 100;
}

/**
 * Resolves the highest escort requirement triggered by width or height. With
 * per-mile escort pricing, every escort runs the whole customer trip (`miles`).
 */
export function resolveEscortRequirement({ width = 0, height = 0, rules = [], miles = 0, pricing = {} } = {}) {
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
  const vehicleCount = toFinite(rule.vehicleCount);
  const perMileCost = priceEscortMiles(Array(vehicleCount).fill(miles), pricing);
  return perMileCost == null
    ? { vehicleCount, surcharge: toFinite(rule.surcharge), triggeredBy }
    : { vehicleCount, surcharge: perMileCost, triggeredBy, miles: Array(vehicleCount).fill(Math.round(toFinite(miles) * 10) / 10) };
}
