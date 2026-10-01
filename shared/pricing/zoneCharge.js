const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

/** Per-zone overrides win, then company settings, then the built-in catalog. */
export function resolveZoneCharge(zone, config = {}, field = 'metro_multiplier') {
  const override = config.geofences?.customZoneRates?.[zone.id] || {};
  const catalogType = zone.feeType || 'percent';
  const catalogValue = catalogType === 'flat'
    ? number(zone.price ?? zone.value, 0)
    : Math.max(0, (number(zone.multiplier, 1) - 1) * 100);
  const companyType = config.pricing?.surchargeModes?.[field] ?? config.surcharges?.surchargeModes?.[field] ?? catalogType;
  const companyValue = number(config.pricing?.[field] ?? config.surcharges?.[field] ?? catalogValue, catalogValue);
  return {
    feeType: override.feeType ?? (override.multiplier != null ? 'percent' : companyType),
    value: number(override.value ?? override.price ?? override.multiplier ?? companyValue, companyValue),
  };
}

export function formatZoneCharge(charge) {
  return charge.feeType === 'flat' ? '+$' + Number(charge.value).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '+' + Number(charge.value).toFixed(2).replace(/\.?0+$/, '') + '%';
}
