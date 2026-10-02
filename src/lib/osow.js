// Shared browser/server OSOW estimate. Null source thresholds remain unknown.
const known = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const number = (value) => known(value) ? Number(value) : 0;

const FLAG_PRIORITY = [
  { label: '2 escorts', matches: (row) => Number(row.vehicleCount) >= 2 },
  { label: '1 escort', matches: (row) => Number(row.vehicleCount) === 1 },
  { label: 'Overheight', matches: (row) => row.reasons?.includes('Overheight') },
  { label: 'Overwidth', matches: (row) => row.reasons?.includes('Overwidth') },
  { label: 'Overweight', matches: (row) => row.reasons?.includes('Overweight') },
  { label: 'Overlength', matches: (row) => row.reasons?.includes('Overlength') },
  { label: 'Overhang', matches: (row) => row.reasons?.includes('Overhang') },
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

function evaluateRegulations(rule, measurements, reviewReasons) {
  const { state_code: state } = rule;
  const reasons = [];
  const triggers = [];
  const legal = [['width', 'legal_width_in', 'Overwidth'], ['height', 'legal_height_in', 'Overheight'],
    ['weight', 'legal_weight_lb', 'Overweight'], ['lengthFt', 'legal_length_ft', 'Overlength'],
    ['overhangFt', 'legal_overhang_ft', 'Overhang']];
  for (const [measurement, key, flag] of legal) {
    if (!known(measurements[measurement]) || !known(rule[key])) {
      reviewReasons.push(`${state}: ${flag} screening is incomplete.`);
    } else if (number(measurements[measurement]) > number(rule[key])) reasons.push(flag);
  }
  let vehicleCount = 0;
  // Preserve the pricing convention: reaching a numeric escort trigger activates it.
  for (const [measurement, key, count, label] of [
    ['width', 'escort_1_trigger_width_in', 1, '1 escort — width'],
    ['width', 'escort_2_trigger_width_in', 2, '2 escorts — width'],
    ['height', 'escort_height_pole_trigger_in', 1, 'Height-pole escort'],
    ['lengthFt', 'escort_length_trigger_ft', 1, '1 escort — length'],
    ['overhangFt', 'escort_overhang_trigger_ft', 1, '1 escort — overhang'],
  ]) {
    if (known(measurements[measurement]) && known(rule[key]) && number(measurements[measurement]) >= number(rule[key])) {
      vehicleCount = Math.max(vehicleCount, count);
      triggers.push(label);
    }
  }
  const needsPermit = reasons.length > 0 || vehicleCount > 0;
  const notes = needsPermit ? [rule.roadway_condition_notes,
    rule.police_escort_threshold ? `Police escort guidance: ${rule.police_escort_threshold}` : null].filter(Boolean) : [];
  if (notes.length) reviewReasons.push(`${state}: review roadway and police guidance for the flagged load.`);
  return { state, needsPermit, reasons, vehicleCount, triggers, notes,
    sourceUrl: /^https?:\/\//i.test(rule.source_url || '') ? rule.source_url : null,
    sourceAgency: rule.source_agency, retrievedAt: rule.retrieved_on };
}

export function evaluateOsow({ weight, width, height, lengthFt, overhangFt, tier = {}, states = [], limits = [], pricing = {}, routeKnown = true }) {
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
    if (rule.regulations_v2) {
      const result = evaluateRegulations({ ...rule.regulations_v2, state_code: state }, {
        width: known(width) && number(width) > 0 ? width : null,
        height: known(height) && number(height) > 0 && known(tier.averageClearanceIn) ? loadedHeight : null,
        weight: known(weight) && number(weight) > 0 && known(tier.averageVehicleWeightLbs) ? grossWeight : null,
        lengthFt: known(lengthFt) && number(lengthFt) > 0 ? lengthFt : null,
        overhangFt: known(overhangFt) && number(overhangFt) >= 0 ? overhangFt : null,
      }, reviewReasons);
      if (result.needsPermit) flags.push(`${state}: ${[...result.reasons, ...result.triggers].join(', ')}`);
      return result;
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
