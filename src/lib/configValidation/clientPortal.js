// src/lib/configValidation/clientPortal.js
/**
 * Validation for config.client_portal: contact fields, approval threshold,
 * and weight-tier bounds.
 */
import { LIMITS, addError, validateString, validateNumber } from './shared.js';

const validateWeightTier = (tier, index) => {
  const path = `client_portal.weight_tiers[${index}]`;
  const errors = [];

  if (!tier || typeof tier !== 'object') {
    return [{ message: 'Must be an object', path }];
  }

  const minWeight = validateNumber(tier.minWeight, { min: 0, max: LIMITS.MAX_NUMBER });
  if (!minWeight.valid) {
    errors.push({ message: `minWeight: ${minWeight.error}`, path: `${path}.minWeight` });
  }

  const maxWeight = validateNumber(tier.maxWeight, { min: 0, max: LIMITS.MAX_NUMBER });
  if (!maxWeight.valid) {
    errors.push({ message: `maxWeight: ${maxWeight.error}`, path: `${path}.maxWeight` });
  }

  if (minWeight.valid && maxWeight.valid && maxWeight.value < minWeight.value) {
    errors.push({ message: 'maxWeight must be >= minWeight', path: `${path}.maxWeight` });
  }

  const rate = validateNumber(tier.rate, { min: 0, max: 10000 });
  if (!rate.valid) {
    errors.push({ message: `rate: ${rate.error}`, path: `${path}.rate` });
  }

  const permitCost = validateNumber(tier.permitCost ?? 150, { min: 0, max: 100000 });
  if (!permitCost.valid) {
    errors.push({ message: `permitCost: ${permitCost.error}`, path: `${path}.permitCost` });
  }

  return errors;
};

/** Validates config.client_portal in place, appending any errors to `result`. */
export function validateClientPortalSection(portal, result) {
  if (!portal || typeof portal !== 'object') return;

  if (portal.contact_email) {
    const emailValidation = validateString(portal.contact_email, { maxLength: LIMITS.MAX_STRING_LENGTH });
    if (!emailValidation.valid) {
      addError(result, emailValidation.error, 'client_portal.contact_email');
    }
  }

  if (portal.contact_phone) {
    const phoneValidation = validateString(portal.contact_phone, { maxLength: 20 });
    if (!phoneValidation.valid) {
      addError(result, phoneValidation.error, 'client_portal.contact_phone');
    }
  }

  if (portal.approval_threshold !== undefined) {
    const thresholdValidation = validateNumber(portal.approval_threshold, { min: 0, max: LIMITS.MAX_NUMBER });
    if (!thresholdValidation.valid) {
      addError(result, thresholdValidation.error, 'client_portal.approval_threshold');
    }
  }

  if (Array.isArray(portal.weight_tiers)) {
    if (portal.weight_tiers.length > LIMITS.MAX_WEIGHT_TIERS) {
      addError(result, `Too many weight tiers (max ${LIMITS.MAX_WEIGHT_TIERS})`, 'client_portal.weight_tiers');
    }
    portal.weight_tiers.forEach((tier, idx) => {
      validateWeightTier(tier, idx).forEach((err) => addError(result, err.message, err.path));
    });
  }
}
