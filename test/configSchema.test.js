import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_CONFIG,
  DEFAULT_PRICING,
  DEFAULT_CLIENT_PORTAL,
  normalizeConfig,
  normalizeDriveTimeBuffer,
  normalizeClientPortalTier,
  normalizeCustomSurcharge,
  normalizeCustomTruckClass,
} from '../src/lib/configSchema.js';

/**
 * CONFIG SCHEMA TESTS
 *
 * Verify that the centralized config schema normalizes data consistently
 * across all five locations that previously duplicated this logic.
 */

// ===== UTILITY FUNCTION TESTS =====

test('normalizeDriveTimeBuffer handles percentage format', () => {
  assert.equal(normalizeDriveTimeBuffer(10), 10);
  assert.equal(normalizeDriveTimeBuffer(25), 25);
  assert.equal(normalizeDriveTimeBuffer(50), 50);
});

test('normalizeDriveTimeBuffer converts decimal format to percentage', () => {
  assert.equal(Math.round(normalizeDriveTimeBuffer(1.1)), 10);
  assert.equal(Math.round(normalizeDriveTimeBuffer(1.2)), 20);
  assert.equal(Math.round(normalizeDriveTimeBuffer(1.25)), 25);
});

test('normalizeDriveTimeBuffer applies defaults for invalid input', () => {
  assert.equal(normalizeDriveTimeBuffer(null), 10);
  assert.equal(normalizeDriveTimeBuffer(undefined), 10);
  assert.equal(normalizeDriveTimeBuffer('invalid'), 10);
  assert.equal(normalizeDriveTimeBuffer(-5), 10);
});

test('normalizeClientPortalTier provides all required fields', () => {
  const tier = { minWeight: 0, maxWeight: 10000, rate: 100 };
  const result = normalizeClientPortalTier(tier, 0);
  assert(result.id);
  assert(result.label);
  assert.equal(result.minWeight, 0);
  assert.equal(result.maxWeight, 10000);
  assert.equal(result.rate, 100);
  assert(result.rounding_interval);
  assert(result.drive_time_buffer);
  assert(result.load_unload_base_mins);
});

test('normalizeClientPortalTier accepts legacy field names', () => {
  const tier = { min: 0, max: 10000, hourly_rate: 150 };
  const result = normalizeClientPortalTier(tier, 0);
  assert.equal(result.minWeight, 0);
  assert.equal(result.maxWeight, 10000);
  assert.equal(result.rate, 150);
});

test('normalizeCustomSurcharge normalizes all fields', () => {
  const surcharge = { name: 'Test Fee', feeType: 'flat', value: 50 };
  const result = normalizeCustomSurcharge(surcharge, 0);
  assert(result.id);
  assert.equal(result.name, 'Test Fee');
  assert.equal(result.feeType, 'flat');
  assert.equal(result.value, 50);
  assert.equal(result.active, true);
});

test('normalizeCustomTruckClass includes mileage rates', () => {
  const truckClass = { name: 'Rotator', minRate: 350, maxRate: 450 };
  const result = normalizeCustomTruckClass(truckClass, 0);
  assert.equal(result.name, 'Rotator');
  assert.equal(result.minRate, 350);
  assert.equal(result.maxRate, 350);
  assert(result.minMileageRate);
  assert(result.maxMileageRate);
  assert(result.drive_time_buffer);
  assert(result.load_unload_base_mins);
});

// ===== DEFAULT CONFIG TESTS =====

test('DEFAULT_CONFIG has all required top-level fields', () => {
  assert(DEFAULT_CONFIG.company_id);
  assert(DEFAULT_CONFIG.pricing);
  assert(DEFAULT_CONFIG.surcharges);
  assert(DEFAULT_CONFIG.geofences);
  assert(Array.isArray(DEFAULT_CONFIG.bases));
  assert(Array.isArray(DEFAULT_CONFIG.users));
  assert(DEFAULT_CONFIG.client_portal);
});

test('DEFAULT_PRICING has all rate fields', () => {
  assert.equal(typeof DEFAULT_PRICING.pricing_mode, 'string');
  assert(Number.isFinite(DEFAULT_PRICING.hourly_min));
  assert(Number.isFinite(DEFAULT_PRICING.hourly_max));
  assert(Number.isFinite(DEFAULT_PRICING.mileage_min));
  assert(Number.isFinite(DEFAULT_PRICING.mileage_max));
  assert(Number.isFinite(DEFAULT_PRICING.drive_time_buffer));
  assert(Number.isFinite(DEFAULT_PRICING.rounding_interval));
});

test('DEFAULT_PRICING has surcharge multipliers', () => {
  assert(Number.isFinite(DEFAULT_PRICING.after_hours_multiplier));
  assert(Number.isFinite(DEFAULT_PRICING.road_club_multiplier));
  assert(Number.isFinite(DEFAULT_PRICING.metro_multiplier));
  assert(Number.isFinite(DEFAULT_PRICING.hazard_multiplier));
});

test('DEFAULT_PRICING includes custom truck classes', () => {
  assert(Array.isArray(DEFAULT_PRICING.custom_truck_classes));
  assert(DEFAULT_PRICING.custom_truck_classes.length > 0);
  assert(DEFAULT_PRICING.custom_truck_classes.every((tc) => tc.id && tc.minRate && tc.maxRate));
});

test('DEFAULT_CLIENT_PORTAL includes weight tiers', () => {
  assert(Array.isArray(DEFAULT_CLIENT_PORTAL.weight_tiers));
  assert(DEFAULT_CLIENT_PORTAL.weight_tiers.length > 0);
  assert(DEFAULT_CLIENT_PORTAL.weight_tiers.every((tier) => tier.minWeight !== undefined && tier.maxWeight !== undefined && tier.rate !== undefined));
});

// ===== NORMALIZATION TESTS =====

test('normalizeConfig merges legacy and new config formats', () => {
  const legacy = {
    config: {
      pricing: { hourly_min: 100 },
      bases: [{ id: '1', name: 'Base 1', address: 'Addr 1' }],
    },
    hourly_max: 140,
  };
  const result = normalizeConfig(legacy);
  assert.equal(result.pricing.hourly_min, 100);
  assert.equal(result.pricing.hourly_max, 100);
  assert.equal(result.bases.length, 1);
});

test('normalizeConfig promotes canonical single rates and preserves mileage mode', () => {
  const result = normalizeConfig({
    pricing: {
      pricing_mode: 'mileage',
      hourly_rate: 175,
      mileage_rate: 7.5,
      hourly_min: 100,
      hourly_max: 300,
      mileage_min: 4,
      mileage_max: 9,
    },
  });

  assert.equal(result.pricing.pricing_mode, 'mileage');
  assert.equal(result.pricing.hourly_rate, 175);
  assert.equal(result.pricing.hourly_min, 175);
  assert.equal(result.pricing.hourly_max, 175);
  assert.equal(result.pricing.mileage_rate, 7.5);
  assert.equal(result.pricing.mileage_min, 7.5);
  assert.equal(result.pricing.mileage_max, 7.5);
});

test('normalizeConfig provides defaults for missing fields', () => {
  const minimal = { company_id: 'test-123', pricing: {} };
  const result = normalizeConfig(minimal);
  assert.equal(result.company_id, 'test-123');
  assert.equal(result.pricing.hourly_min, DEFAULT_PRICING.hourly_min);
  assert.equal(result.pricing.hourly_max, DEFAULT_PRICING.hourly_max);
  assert(Array.isArray(result.pricing.custom_truck_classes));
  assert(Array.isArray(result.pricing.custom_surcharges));
});

test('normalizeConfig normalizes custom surcharges', () => {
  const config = {
    pricing: {
      configurable_business_surcharges: true, // Mark as migrated to avoid adding after-hours/road-club
      custom_surcharges: [
        { name: 'Fee 1', feeType: 'flat', value: 50 },
        { name: 'Fee 2', feeType: 'percent', value: 10 },
      ],
    },
  };
  const result = normalizeConfig(config);
  assert.equal(result.pricing.custom_surcharges.length, 2);
  assert(result.pricing.custom_surcharges.every((s) => s.id && s.name && s.feeType !== undefined && s.value !== undefined && s.active !== undefined));
});

test('normalizeConfig normalizes weight tiers', () => {
  const config = {
    client_portal: {
      weight_tiers: [
        { min: 0, max: 10000, hourly_rate: 100 },
        { min: 10001, max: 20000, hourly_rate: 150 },
      ],
    },
  };
  const result = normalizeConfig(config);
  assert.equal(result.client_portal.weight_tiers.length, 2);
  assert.equal(result.client_portal.weight_tiers[0].minWeight, 0);
  assert.equal(result.client_portal.weight_tiers[0].rate, 100);
  assert(result.client_portal.weight_tiers.every((tier) => tier.id && tier.drive_time_buffer && tier.load_unload_base_mins));
});

test('normalizeConfig preserves geofence configuration', () => {
  const config = {
    geofences: {
      disabledZones: ['zone-1', 'zone-2'],
      customZoneRates: { 'zone-1': { feeType: 'percent', value: 25 } },
      customZones: [{ id: 'custom-1', name: 'Custom Zone' }],
    },
  };
  const result = normalizeConfig(config);
  assert.equal(result.geofences.disabledZones.length, 2);
  assert(result.geofences.customZoneRates['zone-1']);
  assert.equal(result.geofences.customZones.length, 1);
});

test('normalizeConfig handles after-hours/road-club surcharge migration', () => {
  // Old format stores these as multipliers
  const oldConfig = {
    pricing: {
      after_hours_multiplier: 30,
      road_club_multiplier: 20,
    },
  };
  const result = normalizeConfig(oldConfig);
  // Should migrate to custom_surcharges
  const afterHours = result.pricing.custom_surcharges.find((s) => s.id === 'after-hours');
  const roadClub = result.pricing.custom_surcharges.find((s) => s.id === 'road-club');
  assert(afterHours);
  assert(roadClub);
  assert.equal(afterHours.value, 30);
  assert.equal(roadClub.value, 20);
});

test('normalizeConfig converts percentage-style drive_time_buffer', () => {
  const config = {
    pricing: { drive_time_buffer: 1.15 }, // decimal format
  };
  const result = normalizeConfig(config);
  assert.equal(Math.round(result.pricing.drive_time_buffer), 15); // converted to percentage (with rounding)
});

test('normalizeConfig ensures arrays are always arrays', () => {
  const config = {
    bases: null,
    users: undefined,
    geofences: { disabledZones: 'should-be-array' },
  };
  const result = normalizeConfig(config);
  assert(Array.isArray(result.bases));
  assert(Array.isArray(result.users));
  assert(Array.isArray(result.geofences.disabledZones));
});

test('normalizeConfig creates consistent output structure', () => {
  const result1 = normalizeConfig({ company_id: 'test1', pricing: { hourly_min: 100 } });
  const result2 = normalizeConfig({ company_id: 'test2', pricing: { hourly_min: 100 } });
  // Both should have the same structure
  assert.deepEqual(Object.keys(result1).sort(), Object.keys(result2).sort());
  assert.deepEqual(Object.keys(result1.pricing).sort(), Object.keys(result2.pricing).sort());
  assert.deepEqual(Object.keys(result1.surcharges).sort(), Object.keys(result2.surcharges).sort());
});

test('normalizeConfig is idempotent', () => {
  const config = {
    company_id: 'test',
    pricing: {
      hourly_min: 125,
      hourly_max: 135,
      custom_surcharges: [{ id: '1', name: 'Fee', feeType: 'flat', value: 50 }],
    },
  };
  const result1 = normalizeConfig(config);
  const result2 = normalizeConfig(result1);
  assert.deepEqual(result1, result2);
});
