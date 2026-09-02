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

  if (Array.isArray(portal.escort_rules)) {
    portal.escort_rules.slice(0, 2).forEach((rule, index) => {
      ['minWidth', 'minHeight', 'surcharge'].forEach((field) => {
        const validation = validateNumber(rule?.[field], { min: 0, max: field === 'surcharge' ? 100000 : 1000 });
        if (!validation.valid) addError(result, `${field}: ${validation.error}`, `client_portal.escort_rules[${index}].${field}`);
      });
    });
    const oneEscort = portal.escort_rules.find((rule) => Number(rule?.vehicleCount) === 1);
    const twoEscorts = portal.escort_rules.find((rule) => Number(rule?.vehicleCount) === 2);
    const widthOrderInvalid = Number(twoEscorts?.minWidth) > 0 && Number(oneEscort?.minWidth) > 0 && Number(twoEscorts.minWidth) < Number(oneEscort.minWidth);
    const heightOrderInvalid = Number(twoEscorts?.minHeight) > 0 && Number(oneEscort?.minHeight) > 0 && Number(twoEscorts.minHeight) < Number(oneEscort.minHeight);
    if (oneEscort && twoEscorts && (widthOrderInvalid || heightOrderInvalid)) {
      addError(result, 'Two-escort thresholds must be at least as high as one-escort thresholds', 'client_portal.escort_rules');
    }
  }
}
