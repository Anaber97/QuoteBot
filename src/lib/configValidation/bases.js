// src/lib/configValidation/bases.js
/**
 * Validation for the top-level config.bases array (dispatch yard locations).
 */
import { LIMITS } from './shared.js';

export const validateBase = (base, index) => {
  const path = `bases[${index}]`;
  const errors = [];

  if (!base || typeof base !== 'object') {
    return [{ message: 'Must be an object', path }];
  }

  if (!base.id || typeof base.id !== 'string') {
    errors.push({ message: 'id is required', path: `${path}.id` });
  }

  if (!base.name || typeof base.name !== 'string' || base.name.trim().length === 0) {
    errors.push({ message: 'name is required', path: `${path}.name` });
  } else if (base.name.length > LIMITS.MAX_STRING_LENGTH) {
    errors.push({ message: 'name too long', path: `${path}.name` });
  }

  if (!base.address || typeof base.address !== 'string' || base.address.trim().length === 0) {
    errors.push({ message: 'address is required', path: `${path}.address` });
  } else if (base.address.length > LIMITS.MAX_STRING_LENGTH) {
    errors.push({ message: 'address too long', path: `${path}.address` });
  }

  return errors;
};
