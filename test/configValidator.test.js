import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateConfigInput,
  sanitizeConfig,
  checkRequestSize,
  VALIDATION_LIMITS,
} from '../src/lib/configValidator.js';

/**
 * CONFIG VALIDATOR TESTS
 *
 * Verify that all incoming config is validated before persistence.
 * Ensures:
 * - Type bounds and cross-field rules
 * - Array length limits
 * - String length limits
 * - Enum validation
 * - Geofence coordinate validation
 * - Unknown field removal
 */

// ===== REQUEST SIZE VALIDATION =====

test('checkRequestSize rejects oversized requests', () => {
  const req = {
    headers: { 'content-length': String(VALIDATION_LIMITS.MAX_REQUEST_SIZE_BYTES + 1) },
  };
  const result = checkRequestSize(req);
  assert(!result.valid);
  assert(result.error.includes('too large'));
});

test('checkRequestSize accepts requests under limit', () => {
  const req = {
    headers: { 'content-length': String(VALIDATION_LIMITS.MAX_REQUEST_SIZE_BYTES - 1000) },
  };
  const result = checkRequestSize(req);
  assert(result.valid);
});

// ===== PRICING VALIDATION =====

test('validateConfigInput rejects pricing with hourly_max < hourly_min', () => {
  const config = {
    pricing: { hourly_min: 100, hourly_max: 50 },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('hourly_max must be')));
});

test('validateConfigInput rejects pricing with mileage_max < mileage_min', () => {
  const config = {
    pricing: { mileage_min: 5, mileage_max: 3 },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('mileage_max must be')));
});

test('validateConfigInput accepts valid hourly rates', () => {
  const config = {
    pricing: { hourly_min: 50, hourly_max: 150 },
  };
  const result = validateConfigInput(config);
  assert(result.valid);
});

test('validateConfigInput rejects invalid pricing_mode', () => {
  const config = {
    pricing: { pricing_mode: 'invalid_mode' },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.path === 'pricing.pricing_mode'));
});

test('validateConfigInput accepts valid pricing_mode', () => {
  const config = {
    pricing: { pricing_mode: 'hourly' },
  };
  const result = validateConfigInput(config);
  assert(result.valid);
});

test('validateConfigInput rejects negative pricing values', () => {
  const config = {
    pricing: { hourly_min: -100 },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
});

test('validateConfigInput rejects non-finite pricing values', () => {
  const config = {
    pricing: { hourly_min: 'not a number' },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
});

// ===== CUSTOM SURCHARGES VALIDATION =====

test('validateConfigInput rejects too many custom surcharges', () => {
  const config = {
    pricing: {
      custom_surcharges: Array(VALIDATION_LIMITS.MAX_CUSTOM_SURCHARGES + 1).fill({
        name: 'Fee',
        feeType: 'flat',
        value: 50,
      }),
    },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('Too many custom surcharges')));
});

test('validateConfigInput rejects surcharge with missing name', () => {
  const config = {
    pricing: {
      custom_surcharges: [{ feeType: 'flat', value: 50 }],
    },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.path.includes('name')));
});

test('validateConfigInput rejects surcharge with invalid feeType', () => {
  const config = {
    pricing: {
      custom_surcharges: [{ name: 'Fee', feeType: 'invalid', value: 50 }],
    },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.path.includes('feeType')));
});

test('validateConfigInput rejects surcharge with negative value', () => {
  const config = {
    pricing: {
      custom_surcharges: [{ name: 'Fee', feeType: 'flat', value: -50 }],
    },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
});

test('validateConfigInput accepts valid surcharge', () => {
  const config = {
    pricing: {
      custom_surcharges: [{ name: 'Fee', feeType: 'percent', value: 15 }],
    },
  };
  const result = validateConfigInput(config);
  assert(result.valid);
});

// ===== TRUCK CLASS VALIDATION =====

test('validateConfigInput rejects too many truck classes', () => {
  const config = {
    pricing: {
      custom_truck_classes: Array(VALIDATION_LIMITS.MAX_TRUCK_CLASSES + 1).fill({
        name: 'Class',
        minRate: 100,
        maxRate: 200,
      }),
    },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('Too many truck classes')));
});

test('validateConfigInput rejects truck class with maxRate < minRate', () => {
  const config = {
    pricing: {
      custom_truck_classes: [{ name: 'Class', minRate: 300, maxRate: 100 }],
    },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('maxRate must be')));
});

test('validateConfigInput accepts valid truck class', () => {
  const config = {
    pricing: {
      custom_truck_classes: [{ name: 'Rotator', minRate: 200, maxRate: 400 }],
    },
  };
  const result = validateConfigInput(config);
  assert(result.valid);
});

// ===== WEIGHT TIER VALIDATION =====

test('validateConfigInput rejects too many weight tiers', () => {
  const config = {
    client_portal: {
      weight_tiers: Array(VALIDATION_LIMITS.MAX_WEIGHT_TIERS + 1).fill({
        minWeight: 0,
        maxWeight: 1000,
        rate: 100,
      }),
    },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('Too many weight tiers')));
});

test('validateConfigInput rejects weight tier with maxWeight < minWeight', () => {
  const config = {
    client_portal: {
      weight_tiers: [{ minWeight: 5000, maxWeight: 1000, rate: 100 }],
    },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('maxWeight must be')));
});

test('validateConfigInput accepts valid weight tier', () => {
  const config = {
    client_portal: {
      weight_tiers: [{ minWeight: 0, maxWeight: 10000, rate: 100 }],
    },
  };
  const result = validateConfigInput(config);
  assert(result.valid);
});

// ===== GEOFENCE VALIDATION =====

test('validateConfigInput rejects too many custom zones', () => {
  const config = {
    geofences: {
      customZones: Array(VALIDATION_LIMITS.MAX_CUSTOM_ZONES + 1).fill({
        name: 'Zone',
        shape: [{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 1, lng: 1 }],
      }),
    },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('Too many custom zones')));
});

test('validateConfigInput rejects polygon with < 3 points', () => {
  const config = {
    geofences: {
      customZones: [
        {
          name: 'Zone',
          shape: [{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }],
        },
      ],
    },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('at least 3 points')));
});

test('validateConfigInput rejects polygon with too many points', () => {
  const config = {
    geofences: {
      customZones: [
        {
          name: 'Zone',
          shape: Array(VALIDATION_LIMITS.MAX_GEOFENCE_POLYGON_POINTS + 1)
            .fill(null)
            .map((_, i) => ({
              lat: Math.sin((i / 360) * Math.PI * 2) * 10,
              lng: Math.cos((i / 360) * Math.PI * 2) * 10,
            })),
        },
      ],
    },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('Too many points')));
});

test('validateConfigInput rejects invalid latitude', () => {
  const config = {
    geofences: {
      customZones: [
        {
          name: 'Zone',
          shape: [
            { lat: 95, lng: 0 },
            { lat: 0, lng: 0 },
            { lat: 0, lng: 1 },
          ],
        },
      ],
    },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('latitude')));
});

test('validateConfigInput rejects invalid longitude', () => {
  const config = {
    geofences: {
      customZones: [
        {
          name: 'Zone',
          shape: [
            { lat: 0, lng: -200 },
            { lat: 0, lng: 0 },
            { lat: 0, lng: 1 },
          ],
        },
      ],
    },
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('longitude')));
});

test('validateConfigInput accepts valid geofence zone', () => {
  const config = {
    geofences: {
      customZones: [
        {
          name: 'Downtown',
          shape: [
            { lat: 40.7128, lng: -74.006 },
            { lat: 40.7138, lng: -74.006 },
            { lat: 40.7128, lng: -74.005 },
          ],
        },
      ],
    },
  };
  const result = validateConfigInput(config);
  assert(result.valid);
});

// ===== BASES VALIDATION =====

test('validateConfigInput rejects too many bases', () => {
  const config = {
    bases: Array(VALIDATION_LIMITS.MAX_BASES + 1).fill({
      id: '1',
      name: 'Base',
      address: 'Addr',
    }),
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('Too many bases')));
});

test('validateConfigInput rejects base with missing name', () => {
  const config = {
    bases: [{ id: '1', address: 'Addr' }],
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('name')));
});

test('validateConfigInput rejects base with missing address', () => {
  const config = {
    bases: [{ id: '1', name: 'Base' }],
  };
  const result = validateConfigInput(config);
  assert(!result.valid);
  assert(result.errors.some((e) => e.message.includes('address')));
});

test('validateConfigInput accepts valid base', () => {
  const config = {
    bases: [{ id: 'base-1', name: 'Main Yard', address: '123 Main St' }],
  };
  const result = validateConfigInput(config);
  assert(result.valid);
});

// ===== SANITIZATION =====

test('sanitizeConfig removes unknown fields', () => {
  const config = {
    pricing: { hourly_min: 100, unknownField: 'should-be-removed' },
    unknownTopLevel: 'should-be-removed',
  };
  const sanitized = sanitizeConfig(config);
  assert(!('unknownField' in sanitized.pricing));
  assert(!('unknownTopLevel' in sanitized));
});

test('sanitizeConfig preserves recognized fields', () => {
  const config = {
    company_id: 'test-123',
    pricing: { hourly_min: 100, hourly_max: 150 },
    bases: [{ id: '1', name: 'Base', address: 'Addr' }],
  };
  const sanitized = sanitizeConfig(config);
  assert.equal(sanitized.company_id, 'test-123');
  assert.equal(sanitized.pricing.hourly_min, 100);
  assert.equal(sanitized.bases.length, 1);
});

test('sanitizeConfig truncates arrays at limits', () => {
  const config = {
    bases: Array(VALIDATION_LIMITS.MAX_BASES + 10).fill({ id: '1', name: 'Base', address: 'Addr' }),
  };
  const sanitized = sanitizeConfig(config);
  assert.equal(sanitized.bases.length, VALIDATION_LIMITS.MAX_BASES);
});

test('sanitizeConfig initializes empty arrays', () => {
  const config = {};
  const sanitized = sanitizeConfig(config);
  assert(Array.isArray(sanitized.bases));
  assert(Array.isArray(sanitized.users));
  assert.equal(sanitized.bases.length, 0);
});

test('sanitizeConfig preserves all pricing fields', () => {
  const config = {
    pricing: {
      pricing_mode: 'hourly',
      hourly_min: 100,
      hourly_max: 150,
      mileage_min: 2,
      mileage_max: 4,
      rounding_interval: 25,
      drive_time_buffer: 10,
      load_unload_base_mins: 15,
      extra_stop_mins: 5,
      after_hours_multiplier: 1.3,
      road_club_multiplier: 1.2,
      metro_multiplier: 1.15,
      hazard_multiplier: 1.5,
    },
  };
  const sanitized = sanitizeConfig(config);
  assert.equal(sanitized.pricing.pricing_mode, 'hourly');
  assert.equal(sanitized.pricing.hourly_min, 100);
  assert.equal(sanitized.pricing.metro_multiplier, 1.15);
});

// ===== VALIDATION WITH SANITIZATION =====

test('validation and sanitization work together', () => {
  const config = {
    company_id: 'test-123',
    pricing: {
      hourly_min: 100,
      hourly_max: 150,
      unknownPricingField: 'removed',
    },
    geofences: {
      customZones: [
        {
          name: 'Zone',
          shape: [
            { lat: 0, lng: 0 },
            { lat: 1, lng: 0 },
            { lat: 1, lng: 1 },
          ],
        },
      ],
    },
    unknownTopField: 'removed',
  };

  // First validate
  const validation = validateConfigInput(config);
  assert(validation.valid);

  // Then sanitize
  const sanitized = sanitizeConfig(config);
  assert(!('unknownPricingField' in sanitized.pricing));
  assert(!('unknownTopField' in sanitized));
  assert(sanitized.geofences.customZones.length === 1);
});
