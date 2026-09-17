// Shared browser/server OSOW estimate. Null source thresholds remain unknown.
const known = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const number = (value) => known(value) ? Number(value) : 0;

const FLAG_PRIORITY = [
  { label: '2 escorts', matches: (row) => Number(row.vehicleCount) >= 2 },
  { label: '1 escort', matches: (row) => Number(row.vehicleCount) === 1 },
  { label: 'Overheight', matches: (row) => row.reasons?.includes('Overheight') },
  { label: 'Overwidth', matches: (row) => row.reasons?.includes('Overwidth') },
  { label: 'Overweight', matches: (row) => row.reasons?.includes('Overweight') },
];

// Keep the customer-facing breakdown to one concise, highest-severity flag.
// This deliberately relies only on structured thresholds, never workbook notes.
export function summarizeHighestOsowFlag(states = []) {
  const rows = Array.isArray(states) ? states : [];
  for (const flag of FLAG_PRIORITY) {
    const affectedStates = [...new Set(rows.filter(flag.matches).map((row) => row.state).filter(Boolean))];
    if (affectedStates.length) return { label: flag.label, states: affectedStates };
  }
  return null;
}

export function evaluateOsow({ weight, width, height, tier = {}, states = [], limits = [], pricing = {}, routeKnown = true }) {
  const flags = [];
  const reviewReasons = [];
  const loadedHeight = number(height) + number(tier.averageClearanceIn);
  const grossWeight = number(weight) + number(tier.averageVehicleWeightLbs);
  if (!known(tier.averageClearanceIn)) reviewReasons.push('Average Clearance is not configured; loaded height is incomplete.');
  if (!known(tier.averageVehicleWeightLbs)) reviewReasons.push('Average Vehicle Weight is not configured; GVW is incomplete.');
  if (!(number(width) > 0) || !(number(height) > 0) || !(number(weight) > 0)) reviewReasons.push('Equipment dimensions or weight are incomplete.');
  if (!routeKnown || !states.length) reviewReasons.push('Route states are incomplete; permit pricing needs review.');
  const byState = new Map(limits.map((row) => [row.state_code, row]));
  const results = [...new Set(states)].map((state) => {
    const rule = byState.get(state);
    if (!rule) {
      reviewReasons.push(`${state}: no state limits are available.`);
      return { state, needsPermit: false, vehicleCount: 0, unknown: true };
    }
    const reasons = [];
    if (number(width) > number(rule.legal_width_in)) reasons.push('Overwidth');
    if (loadedHeight > number(rule.legal_height_in)) reasons.push('Overheight');
    if (grossWeight > number(rule.legal_weight_lbs)) reasons.push('Overweight');
    let vehicleCount = 0;
    for (const [count, prefix] of [[1, 'one'], [2, 'two']]) {
      if ((known(rule[`${prefix}_escort_width_in`]) && number(width) >= number(rule[`${prefix}_escort_width_in`])) ||
          (known(rule[`${prefix}_escort_height_in`]) && loadedHeight >= number(rule[`${prefix}_escort_height_in`]))) vehicleCount = count;
    }
    // Explicit exception supplied in the workbook; do not parse free-text notes as code.
    if (state === 'IN' && grossWeight > 200000) vehicleCount = 2;
    const needsPermit = reasons.length > 0 || vehicleCount > 0;
    if (needsPermit) {
      if (['one_escort_height_in','one_escort_width_in','two_escort_height_in','two_escort_width_in'].some((key) => !known(rule[key]))) {
        reviewReasons.push(`${state}: some escort thresholds are unspecified; confirm applicable requirements.`);
      }
      flags.push(`${state}: ${reasons.join(', ') || 'Escort threshold'}${vehicleCount ? `; ${vehicleCount} escort${vehicleCount === 1 ? '' : 's'}` : ''}`);
    }
    return { state, needsPermit, vehicleCount, reasons, sourceUrl: rule.source_url, retrievedAt: rule.retrieved_at };
  });
  const permitStates = results.filter((row) => row.needsPermit);
  const vehicleCount = Math.max(0, ...results.map((row) => row.vehicleCount));
  const general = known(pricing.generalPermit) ? number(pricing.generalPermit) : number(tier.permitCost);
  const escortRate = vehicleCount ? pricing[vehicleCount === 2 ? 'twoEscort' : 'oneEscort'] : 0;
  if (permitStates.length && !known(pricing.generalPermit) && !known(tier.permitCost)) reviewReasons.push('General OSOW price is not configured.');
  if (vehicleCount && !known(escortRate)) reviewReasons.push(`${vehicleCount}-escort price is not configured.`);
  const permitFee = general * permitStates.length;
  return { needsPermit: permitStates.length > 0, isInterstate: results.length > 1, flags,
    permitFee, states: results, loadedHeight, grossWeight,
    escort: { vehicleCount, surcharge: number(escortRate) },
    reviewRequired: reviewReasons.length > 0, reviewReasons: [...new Set(reviewReasons)] };
}
