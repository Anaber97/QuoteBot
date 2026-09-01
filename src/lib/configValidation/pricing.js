// src/lib/configValidation/pricing.js
/**
 * Validation for config.pricing: field bounds, cross-field rules, and
 * nested custom_surcharges / custom_truck_classes arrays.
 */
import { LIMITS, VALID_PRICING_MODES, VALID_FEE_TYPES, addError, validateNumber, validateEnum } from './shared.js';

const validatePricingField = (value, fieldName) => {
  switch (fieldName) {
    case 'pricing_mode':
      return validateEnum(value, VALID_PRICING_MODES);
    case 'hourly_min':
    case 'hourly_max':
    case 'mileage_min':
    case 'mileage_max':
    case 'rounding_interval':
    case 'drive_time_buffer':
    case 'load_unload_base_mins':
    case 'extra_stop_mins':
    case 'after_hours_multiplier':
    case 'road_club_multiplier':
    case 'metro_multiplier':
    case 'hazard_multiplier':
    case 'base_permit_fee':
    case 'heavy_hourly_min':
    case 'heavy_hourly_max':
      return validateNumber(value, { min: 0, max: LIMITS.MAX_NUMBER });
    default:
      return { valid: true };
  }
};

const validateCustomSurcharge = (surcharge, index) => {
  const path = `pricing.custom_surcharges[${index}]`;
  const errors = [];

  if (!surcharge || typeof surcharge !== 'object') {
    return [{ message: 'Must be an object', path }];
  }

  if (typeof surcharge.name !== 'string' || surcharge.name.trim().length === 0) {
    errors.push({ message: 'name is required and must be a non-empty string', path: `${path}.name` });
  } else if (surcharge.name.length > LIMITS.MAX_STRING_LENGTH) {
    errors.push({ message: `name too long (max ${LIMITS.MAX_STRING_LENGTH})`, path: `${path}.name` });
  }

  const feeTypeValidation = validateEnum(surcharge.feeType, VALID_FEE_TYPES);
  if (!feeTypeValidation.valid) {
    errors.push({ message: feeTypeValidation.error, path: `${path}.feeType` });
  }

  const valueValidation = validateNumber(surcharge.value, { min: 0, max: 1000 });
  if (!valueValidation.valid) {
    errors.push({ message: valueValidation.error, path: `${path}.value` });
  }

  if (typeof surcharge.active !== 'boolean' && surcharge.active !== undefined) {
    errors.push({ message: 'active must be boolean', path: `${path}.active` });
  }

  return errors;
};

const validateCustomTruckClass = (truckClass, index) => {
  const path = `pricing.custom_truck_classes[${index}]`;
  const errors = [];

  if (!truckClass || typeof truckClass !== 'object') {
    return [{ message: 'Must be an object', path }];
  }

  if (typeof truckClass.name !== 'string' || truckClass.name.trim().length === 0) {
    errors.push({ message: 'name is required', path: `${path}.name` });
  } else if (truckClass.name.length > LIMITS.MAX_STRING_LENGTH) {
    errors.push({ message: `name too long (max ${LIMITS.MAX_STRING_LENGTH})`, path: `${path}.name` });
  }

  const minRate = validateNumber(truckClass.minRate, { min: 0, max: 10000 });
  if (!minRate.valid) {
    errors.push({ message: `minRate: ${minRate.error}`, path: `${path}.minRate` });
  }

  const maxRate = validateNumber(truckClass.maxRate, { min: 0, max: 10000 });
  if (!maxRate.valid) {
    errors.push({ message: `maxRate: ${maxRate.error}`, path: `${path}.maxRate` });
  }

  // Cross-field: maxRate >= minRate
  if (minRate.valid && maxRate.valid && maxRate.value < minRate.value) {
    errors.push({ message: 'maxRate must be >= minRate', path: `${path}.maxRate` });
  }

  return errors;
};

/** Validates config.pricing in place, appending any errors to `result`. */
export function validatePricingSection(pricing, result) {
  if (!pricing || typeof pricing !== 'object') return;

  if (pricing.pricing_mode) {
    const modeValidation = validateEnum(pricing.pricing_mode, VALID_PRICING_MODES);
    if (!modeValidation.valid) {
      addError(result, modeValidation.error, 'pricing.pricing_mode');
    }
  }

  Object.entries(pricing).forEach(([key, value]) => {
    if (key === 'custom_surcharges' || key === 'custom_truck_classes' || key === 'surchargeModes') {
      return; // Handled separately below
    }
    if (value !== undefined && value !== null) {
      const fieldValidation = validatePricingField(value, key);
      if (!fieldValidation.valid) {
        addError(result, fieldValidation.error, `pricing.${key}`);
      }
    }
  });

  if (Number.isFinite(pricing.hourly_min) && Number.isFinite(pricing.hourly_max) && pricing.hourly_max < pricing.hourly_min) {
    addError(result, 'hourly_max must be >= hourly_min', 'pricing.hourly_max');
  }

  if (Number.isFinite(pricing.mileage_min) && Number.isFinite(pricing.mileage_max) && pricing.mileage_max < pricing.mileage_min) {
    addError(result, 'mileage_max must be >= mileage_min', 'pricing.mileage_max');
  }

  if (Array.isArray(pricing.custom_surcharges)) {
    if (pricing.custom_surcharges.length > LIMITS.MAX_CUSTOM_SURCHARGES) {
      addError(result, `Too many custom surcharges (max ${LIMITS.MAX_CUSTOM_SURCHARGES})`, 'pricing.custom_surcharges');
    }
    pricing.custom_surcharges.forEach((surcharge, idx) => {
      validateCustomSurcharge(surcharge, idx).forEach((err) => addError(result, err.message, err.path));
    });
  }

  if (Array.isArray(pricing.custom_truck_classes)) {
    if (pricing.custom_truck_classes.length > LIMITS.MAX_TRUCK_CLASSES) {
      addError(result, `Too many truck classes (max ${LIMITS.MAX_TRUCK_CLASSES})`, 'pricing.custom_truck_classes');
    }
    pricing.custom_truck_classes.forEach((truckClass, idx) => {
      validateCustomTruckClass(truckClass, idx).forEach((err) => addError(result, err.message, err.path));
    });
  }
}
