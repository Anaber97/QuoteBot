const sections = ['pricing', 'surcharges', 'geofences', 'client_portal', 'branding'];
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

/** Compatibility boundary for stored configuration. Structured columns win. */
export function readStoredConfig(row = {}) {
  const legacy = object(row.config);
  const result = { ...legacy, ...row };
  for (const section of sections) {
    result[section] = { ...object(legacy[section]), ...object(row[section]) };
  }
  delete result.config;
  return result;
}
