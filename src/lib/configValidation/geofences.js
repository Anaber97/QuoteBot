// src/lib/configValidation/geofences.js
/**
 * Validation for config.geofences: disabled-zone limits and custom polygon
 * zones (coordinate bounds, point counts, fee type).
 */
import { LIMITS, VALID_FEE_TYPES, addError, validateNumber, validateLatitude, validateLongitude } from './shared.js';
import { ZONE_RULE_MODES } from '../../../shared/pricing/zoneCharge.js';

const validateGeofenceShape = (shape, zoneId) => {
  const path = `geofences.customZones[${zoneId}].shape`;
  const errors = [];

  if (!Array.isArray(shape)) {
    return [{ message: 'Shape must be an array of coordinates', path }];
  }

  if (shape.length < 3) {
    errors.push({ message: 'Polygon must have at least 3 points', path });
  }

  if (shape.length > LIMITS.MAX_GEOFENCE_POLYGON_POINTS) {
    errors.push({ message: `Too many points (max ${LIMITS.MAX_GEOFENCE_POLYGON_POINTS})`, path });
  }

  shape.forEach((point, idx) => {
    if (!point || typeof point !== 'object') {
      errors.push({ message: `Point ${idx}: must be an object with lat/lng`, path: `${path}[${idx}]` });
      return;
    }

    const latValidation = validateLatitude(point.lat);
    if (!latValidation.valid) {
      errors.push({ message: `Point ${idx}: ${latValidation.error}`, path: `${path}[${idx}].lat` });
    }

    const lngValidation = validateLongitude(point.lng);
    if (!lngValidation.valid) {
      errors.push({ message: `Point ${idx}: ${lngValidation.error}`, path: `${path}[${idx}].lng` });
    }
  });

  return errors;
};

const validateCustomZone = (zone, index) => {
  const path = `geofences.customZones[${index}]`;
  const errors = [];

  if (!zone || typeof zone !== 'object') {
    return [{ message: 'Must be an object', path }];
  }

  if (typeof zone.name !== 'string' || zone.name.trim().length === 0) {
    errors.push({ message: 'name is required', path: `${path}.name` });
  } else if (zone.name.length > LIMITS.MAX_STRING_LENGTH) {
    errors.push({ message: `name too long (max ${LIMITS.MAX_STRING_LENGTH})`, path: `${path}.name` });
  }

  if (Array.isArray(zone.shape) && zone.shape.length > 0) {
    errors.push(...validateGeofenceShape(zone.shape, index));
  }

  if (zone.price !== undefined && zone.price !== null) {
    const priceValidation = validateNumber(zone.price, { min: 0, max: 10000 });
    if (!priceValidation.valid) {
      errors.push({ message: `price: ${priceValidation.error}`, path: `${path}.price` });
    }
  }

  if (zone.priority !== undefined && zone.priority !== null) {
    const priorityValidation = validateNumber(zone.priority, { min: 0, max: 999 });
    if (!priorityValidation.valid) {
      errors.push({ message: `priority: ${priorityValidation.error}`, path: `${path}.priority` });
    }
  }

  if (zone.pricingMode && !ZONE_RULE_MODES.includes(zone.pricingMode)) {
    errors.push({ message: `Invalid pricingMode. Must be one of: ${ZONE_RULE_MODES.join(', ')}`, path: `${path}.pricingMode` });
  }

  if (zone.feeType && !VALID_FEE_TYPES.includes(zone.feeType)) {
    errors.push({ message: `Invalid feeType. Must be one of: ${VALID_FEE_TYPES.join(', ')}`, path: `${path}.feeType` });
  }

  return errors;
};

/** Validates config.geofences in place, appending any errors to `result`. */
export function validateGeofencesSection(geofences, result) {
  if (!geofences || typeof geofences !== 'object') return;

  for (const field of ['disabledZones', 'enabledZones']) {
    if (Array.isArray(geofences[field]) && geofences[field].length > LIMITS.MAX_ARRAY_LENGTH) {
      addError(result, `Too many ${field === 'enabledZones' ? 'enabled' : 'disabled'} zones (max ${LIMITS.MAX_ARRAY_LENGTH})`, `geofences.${field}`);
    }
  }

  Object.entries(geofences.customZoneRates && typeof geofences.customZoneRates === 'object' ? geofences.customZoneRates : {}).forEach(([zoneId, rule]) => {
    const path = `geofences.customZoneRates.${zoneId}`;
    if (rule?.pricingMode != null && !ZONE_RULE_MODES.includes(rule.pricingMode)) {
      addError(result, `Invalid pricingMode. Must be one of: ${ZONE_RULE_MODES.join(', ')}`, `${path}.pricingMode`);
    }
    if (rule?.value != null && rule.value !== '') {
      const check = validateNumber(rule.value, { min: 0, max: 100000 });
      if (!check.valid) addError(result, check.error, `${path}.value`);
    }
  });

  if (Array.isArray(geofences.customZones)) {
    if (geofences.customZones.length > LIMITS.MAX_CUSTOM_ZONES) {
      addError(result, `Too many custom zones (max ${LIMITS.MAX_CUSTOM_ZONES})`, 'geofences.customZones');
    }
    geofences.customZones.forEach((zone, idx) => {
      validateCustomZone(zone, idx).forEach((err) => addError(result, err.message, err.path));
    });
  }
}
