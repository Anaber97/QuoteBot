const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const ZONE_RULE_MODES = ['surcharge', 'flat_rate', 'max_rate', 'min_rate'];

/**
 * Built-in metro and hazard zones are opt-in: only ids in enabledZones apply.
 * Configs saved before that (disabledZones only, no builtInZoneMode) keep
 * every built-in zone on except the ones they switched off.
 */
export function isBuiltInZoneActive(zoneId, geofences = {}) {
  const id = String(zoneId);
  const legacyOptOut = geofences?.builtInZoneMode !== 'opt_in' && Array.isArray(geofences?.disabledZones);
  return legacyOptOut
    ? !geofences.disabledZones.map(String).includes(id)
    : (Array.isArray(geofences?.enabledZones) ? geofences.enabledZones : []).map(String).includes(id);
}

/** Flat-rate and maximum rules price a job wholly inside the zone; surcharges and minimums apply when the route touches it. */
export function zoneRuleApplies(charge = {}, { containsPickup = false, containsDropoff = false } = {}) {
  return !['flat_rate', 'max_rate'].includes(charge.pricingMode) || (containsPickup && containsDropoff);
}

/** Per-zone overrides win, then company settings, then the built-in catalog. */
export function resolveZoneCharge(zone, config = {}, field = 'metro_multiplier') {
  const override = config.geofences?.customZoneRates?.[zone.id] || {};
  const pricingMode = ZONE_RULE_MODES.includes(override.pricingMode) ? override.pricingMode : 'surcharge';
  if (pricingMode !== 'surcharge') {
    return { pricingMode, feeType: 'flat', value: Math.max(0, number(override.value ?? override.price, 0)) };
  }
  const catalogType = zone.feeType || 'percent';
  const catalogValue = catalogType === 'flat'
    ? number(zone.price ?? zone.value, 0)
    : Math.max(0, (number(zone.multiplier, 1) - 1) * 100);
  const companyType = config.pricing?.surchargeModes?.[field] ?? config.surcharges?.surchargeModes?.[field] ?? catalogType;
  const companyValue = number(config.pricing?.[field] ?? config.surcharges?.[field] ?? catalogValue, catalogValue);
  return {
    pricingMode,
    feeType: override.feeType ?? (override.multiplier != null ? 'percent' : companyType),
    value: number(override.value ?? override.price ?? override.multiplier ?? companyValue, companyValue),
  };
}

export function formatZoneCharge(charge) {
  const dollars = (value) => '$' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (charge.pricingMode === 'flat_rate') return 'flat ' + dollars(charge.value);
  if (charge.pricingMode === 'max_rate') return 'max ' + dollars(charge.value);
  if (charge.pricingMode === 'min_rate') return 'min ' + dollars(charge.value);
  return charge.feeType === 'flat' ? '+' + dollars(charge.value) : '+' + Number(charge.value).toFixed(2).replace(/\.?0+$/, '') + '%';
}
