// src/services/equipmentSpecs.js
import { supabase } from '../lib/supabase';

// Standard legal limits for non-permitted flatbed/stepdeck transport
export const LEGAL_LIMITS = {
  MAX_WEIGHT_LBS: 45000,
  MAX_WIDTH_IN: 102,
  MAX_HEIGHT_IN: 162,
};

function normalizeDimensionResults(results) {
  if (!Array.isArray(results)) {
    return [];
  }

  return results.map((item) => {
    const widthIn = item?.width_in ?? item?.width_inches ?? (item?.width_ft != null ? Number(item.width_ft) * 12 : null);
    const heightIn = item?.height_in ?? item?.height_inches ?? (item?.height_ft != null ? Number(item.height_ft) * 12 : null);

    return {
      ...item,
      width_in: widthIn != null ? Number(widthIn) : null,
      height_in: heightIn != null ? Number(heightIn) : null,
      width_ft: widthIn != null ? Number((widthIn / 12).toFixed(1)) : null,
      height_ft: heightIn != null ? Number((heightIn / 12).toFixed(1)) : null,
    };
  });
}

/**
 * Searches the 'equipment_specs' table in Supabase by Make, Model, or Serial Number.
 * Falls back to a direct Supabase query if the API endpoint is unavailable.
 */
export async function searchEquipmentSpecs(query) {
  if (!query || query.trim().length < 2) return { results: [], source: '' };

  const cleanQuery = query.trim();

  try {
    const { data, error: supabaseError } = await supabase
      .from('equipment_specs')
      .select('*')
      .or(`make.ilike.%${cleanQuery.toLowerCase()}%,model.ilike.%${cleanQuery.toLowerCase()}%,serial_number.ilike.%${cleanQuery.toLowerCase()}%`)
      .limit(8);

    if (!supabaseError && Array.isArray(data) && data.length > 0) {
      return { results: normalizeDimensionResults(data).slice(0, 8), source: 'supabase' };
    }
  } catch (error) {
    console.warn('Direct Supabase lookup failed:', error);
  }

  try {
    const response = await fetch(`/api/searchEquipment?query=${encodeURIComponent(cleanQuery)}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) throw new Error('Search API unavailable');

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Search API returned ${contentType || 'an unknown content type'}`);
    }

    const payload = await response.json();
    const results = Array.isArray(payload) ? payload : payload.results || [];
    return {
      results: normalizeDimensionResults(results).slice(0, 8),
      source: payload?.source || (results.length > 0 ? 'gemini' : ''),
      error: payload?.error || '',
    };
  } catch (error) {
    console.warn('Search API unavailable, falling back to an empty result set:', error);
    return { results: [], source: '' };
  }
}

/**
 * Extract US State code (e.g. "TX", "OK") from address strings
 */
export function extractStateFromAddress(address = '') {
  if (!address) return '';
  const match = address.match(/\b([A-Z]{2})\b/);
  return match ? match[1] : '';
}

/**
 * Evaluates transport dimensions & weight against interstate and state legal limits
 */
export function calculatePermitRequirements({ weight, width, height, pickupAddr, dropoffAddr, companyRates }) {
  const pickupState = extractStateFromAddress(pickupAddr);
  const dropoffState = extractStateFromAddress(dropoffAddr);

  const isInterstate = Boolean(pickupState && dropoffState && pickupState !== dropoffState);

  const numWeight = Number(weight) || 0;
  const numWidth = Number(width) || 0;
  const numHeight = Number(height) || 0;

  const isOverweight = numWeight > LEGAL_LIMITS.MAX_WEIGHT_LBS;
  const isOverwidth = numWidth > LEGAL_LIMITS.MAX_WIDTH_IN;
  const isOverheight = numHeight > LEGAL_LIMITS.MAX_HEIGHT_IN;

  const needsPermit = isOverweight || isOverwidth || isOverheight;

  const flags = [];
  if (isOverweight) flags.push(`Overweight (${numWeight.toLocaleString()} lbs > ${LEGAL_LIMITS.MAX_WEIGHT_LBS.toLocaleString()} lbs limit)`);
  if (isOverwidth) flags.push(`Oversize Width (${numWidth} in > ${LEGAL_LIMITS.MAX_WIDTH_IN} in limit)`);
  if (isOverheight) flags.push(`Oversize Height (${numHeight} in > ${LEGAL_LIMITS.MAX_HEIGHT_IN} in limit)`);
  if (isInterstate) flags.push(`Interstate Crossing (${pickupState} → ${dropoffState})`);

  // Base permit calculation logic
  let permitFee = 0;
  if (needsPermit) {
    const basePermitFee = companyRates?.pricing?.base_permit_fee || 150;
    // Apply state crossing surcharge multiplier if interstate
    const interstateMultiplier = isInterstate ? 1.5 : 1.0;
    permitFee = basePermitFee * interstateMultiplier;
  }

  return {
    needsPermit,
    isInterstate,
    pickupState,
    dropoffState,
    permitFee,
    flags,
  };
}