// src/lib/configValidation/shared.js
/**
 * Shared primitives used by every config-validation submodule: size limits,
 * enums, and generic type/bounds validators.
 */

export const LIMITS = {
  MAX_STRING_LENGTH: 500,
  MAX_LONG_STRING_LENGTH: 2000,
  MAX_ARRAY_LENGTH: 100,
  MAX_CUSTOM_ZONES: 50,
  MAX_CUSTOM_SURCHARGES: 20,
  MAX_TRUCK_CLASSES: 10,
  MAX_WEIGHT_TIERS: 10,
  MAX_USERS: 500,
  MAX_BASES: 50,
  MAX_CLIENTS: 1000,
  MAX_GEOFENCE_POLYGON_POINTS: 500,
  MAX_REQUEST_SIZE_BYTES: 1024 * 1024, // 1MB
  MAX_NUMBER: 999999999,
  MIN_NUMBER: -999999999,
};

export const VALID_PRICING_MODES = ['hourly', 'mileage'];
export const VALID_FEE_TYPES = ['flat', 'percent'];

export const createResult = () => ({
  valid: true,
  errors: [],
  warnings: [],
});

export const addError = (result, message, path = '') => {
  result.valid = false;
  result.errors.push({ message, path });
};

export const validateString = (value, { minLength = 0, maxLength = LIMITS.MAX_STRING_LENGTH } = {}) => {
  if (typeof value !== 'string') {
    return { valid: false, error: `Expected string, got ${typeof value}` };
  }
  if (value.length < minLength) {
    return { valid: false, error: `String too short (min ${minLength} characters)` };
  }
  if (value.length > maxLength) {
    return { valid: false, error: `String too long (max ${maxLength} characters)` };
  }
  return { valid: true };
};

export const validateNumber = (value, { min = LIMITS.MIN_NUMBER, max = LIMITS.MAX_NUMBER } = {}) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return { valid: false, error: `Expected finite number, got ${typeof value}` };
  }
  if (num < min) {
    return { valid: false, error: `Number too small (min ${min})` };
  }
  if (num > max) {
    return { valid: false, error: `Number too large (max ${max})` };
  }
  return { valid: true, value: num };
};

export const validateEnum = (value, validValues) => {
  if (!validValues.includes(value)) {
    return { valid: false, error: `Invalid value. Must be one of: ${validValues.join(', ')}` };
  }
  return { valid: true };
};

export const validateLatitude = (lat) => {
  const num = Number(lat);
  if (!Number.isFinite(num) || num < -90 || num > 90) {
    return { valid: false, error: 'Invalid latitude (must be between -90 and 90)' };
  }
  return { valid: true, value: num };
};

export const validateLongitude = (lng) => {
  const num = Number(lng);
  if (!Number.isFinite(num) || num < -180 || num > 180) {
    return { valid: false, error: 'Invalid longitude (must be between -180 and 180)' };
  }
  return { valid: true, value: num };
};
