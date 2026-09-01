// src/lib/configValidator.js
/**
 * SERVER-SIDE CONFIG VALIDATION (public entry point)
 *
 * Thin orchestrator over src/lib/configValidation/*: validates incoming
 * configuration data before persistence (bounds, cross-field rules, array
 * limits, enums, geofence coordinates), sanitizes out unknown fields, and
 * checks request size. See src/lib/configValidation/ for the per-section
 * validators (pricing, geofences, client portal, bases, sanitize).
 */
import { LIMITS, createResult, addError } from './configValidation/shared.js';
import { validatePricingSection } from './configValidation/pricing.js';
import { validateGeofencesSection } from './configValidation/geofences.js';
import { validateClientPortalSection } from './configValidation/clientPortal.js';
import { validateBase } from './configValidation/bases.js';

export { sanitizeConfig } from './configValidation/sanitize.js';

export function validateConfigInput(config) {
  const result = createResult();

  if (!config || typeof config !== 'object') {
    addError(result, 'Config must be an object');
    return result;
  }

  validatePricingSection(config.pricing, result);
  validateGeofencesSection(config.geofences, result);
  validateClientPortalSection(config.client_portal, result);

  if (Array.isArray(config.bases)) {
    if (config.bases.length > LIMITS.MAX_BASES) {
      addError(result, `Too many bases (max ${LIMITS.MAX_BASES})`, 'bases');
    }
    config.bases.forEach((base, idx) => {
      validateBase(base, idx).forEach((err) => addError(result, err.message, err.path));
    });
  }

  if (Array.isArray(config.users) && config.users.length > LIMITS.MAX_USERS) {
    addError(result, `Too many users (max ${LIMITS.MAX_USERS})`, 'users');
  }

  return result;
}

/**
 * Checks request size and returns an error if too large. Trusts
 * Content-Length only — real DoS protection must also be enforced at the
 * hosting/runtime layer (e.g. a platform-level body size limit), since this
 * header can be absent or spoofed and some hosts parse the body before the
 * handler runs.
 */
export function checkRequestSize(req) {
  const contentLength = req.headers?.['content-length'];
  if (contentLength) {
    const bytes = parseInt(contentLength, 10);
    if (bytes > LIMITS.MAX_REQUEST_SIZE_BYTES) {
      return {
        valid: false,
        error: `Request too large (${bytes} bytes, max ${LIMITS.MAX_REQUEST_SIZE_BYTES} bytes)`,
      };
    }
  }
  return { valid: true };
}

export const VALIDATION_LIMITS = LIMITS;
