// Address matching shared by browser and server quoting so both price the same way.

const STATE_NAMES = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california', CO: 'colorado',
  CT: 'connecticut', DE: 'delaware', DC: 'district of columbia', FL: 'florida', GA: 'georgia',
  HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa', KS: 'kansas',
  KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland', MA: 'massachusetts',
  MI: 'michigan', MN: 'minnesota', MS: 'mississippi', MO: 'missouri', MT: 'montana',
  NE: 'nebraska', NV: 'nevada', NH: 'new hampshire', NJ: 'new jersey', NM: 'new mexico',
  NY: 'new york', NC: 'north carolina', ND: 'north dakota', OH: 'ohio', OK: 'oklahoma',
  OR: 'oregon', PA: 'pennsylvania', RI: 'rhode island', SC: 'south carolina', SD: 'south dakota',
  TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont', VA: 'virginia', WA: 'washington',
  WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming',
};
const CODE_BY_NAME = Object.fromEntries(Object.entries(STATE_NAMES).map(([code, name]) => [name, code]));

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * The state of a US address, read only from its "City, ST 12345[, USA]" tail.
 * Road names such as "FM 1960", "US-287" or "NE 5th St" are never mistaken for a state.
 * Returns '' when the address does not end with a recognisable state.
 */
export function addressState(address) {
  const tail = String(address || '').trim()
    .replace(/,?\s*(USA|U\.S\.A\.|United States(?: of America)?)\.?$/i, '')
    .replace(/\s+\d{5}(?:-\d{4})?$/, '')
    .trim();
  const afterComma = tail.match(/,\s*([A-Za-z][A-Za-z .]*?)\.?$/)?.[1]?.trim();
  if (afterComma) {
    const code = afterComma.length === 2 ? afterComma.toUpperCase() : CODE_BY_NAME[normalize(afterComma)];
    if (code && STATE_NAMES[code]) return code;
  }
  // "Kilgore TX" without a comma: accept only an upper-case code at the very end.
  const bare = tail.match(/\s([A-Z]{2})$/)?.[1];
  return bare && STATE_NAMES[bare] ? bare : '';
}

/** State codes a built-in zone covers, from names like "…, NY-NJ-PA" or "… (CA/NV)". */
export function zoneStates(zone) {
  const name = String(zone?.name || '');
  const listed = name.match(/,\s*([A-Z]{2}(?:-[A-Z]{2})*)\s*$/)?.[1] || name.match(/\(([A-Z]{2}(?:\/[A-Z]{2})*)\)\s*$/)?.[1] || '';
  return listed ? listed.split(/[-/]/).filter((code) => STATE_NAMES[code]) : [];
}

/**
 * True when an address names one of the zone's cities as whole words, in one of the zone's states.
 * "Frisco, TX" does not match the Colorado I-70 zone's "frisco", and "Vailsburg" does not match "vail".
 */
export function addressNamesZoneCity(address, zone) {
  const cities = (zone?.cities || []).map(normalize).filter(Boolean);
  if (cities.length === 0) return false;
  const states = zoneStates(zone);
  if (states.length > 0 && !states.includes(addressState(address))) return false;
  const text = ` ${normalize(address)} `;
  return cities.some((city) => text.includes(` ${city} `));
}
