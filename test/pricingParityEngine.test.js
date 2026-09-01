import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateAuthoritativeQuote } from '../api/_quoteEngine.js';
import {
  roundToNearest,
  resolveBaseRates,
  calculateTimeMetrics,
  calculateSurcharges,
  calculateFinalQuotes,
  calculatePermitRequirements,
} from '../src/lib/pricingEngine.js';

/**
 * PRICING ENGINE PARITY TESTS
 * 
 * These tests verify that the shared pricingEngine module produces consistent
 * results across all pricing configurations. They exercise:
 * - All pricing modes (hourly, mileage, equipment-weight-tier)
 * - All surcharge types (metro, hazard, custom flat/percent, custom surcharges)
 * - Geofence levels and combinations
 * - Permit requirements and fees
 * - Rounding rules
 * - Overrides and role-based restrictions
 */

// Base test config
const baseConfig = {
  pricing: {
    hourly_min: 125,
    hourly_max: 135,
    mileage_min: 5,
    mileage_max: 6,
    heavy_hourly_min: 200,
    heavy_hourly_max: 250,
    pricing_mode: 'hourly',
    drive_time_buffer: 10,
    load_unload_base_mins: 30,
    extra_stop_mins: 15,
    rounding_interval: 25,
    base_permit_fee: 150,
    custom_truck_classes: [],
    custom_surcharges: [],
  },
  client_portal: {
    approval_threshold: 80000,
    weight_tiers: [],
  },
  geofences: {
    disabledZones: [],
    customZones: [],
  },
};

const baseRoute = {
  totalMeters: 16093.44, // 10 miles
  rawDriveMinutes: 60,
  customerRoutePoints: [],
  localities: [],
  legs: [],
};

// ===== PARITY TESTS FOR SHARED FUNCTIONS =====

test('roundToNearest maintains precision across intervals', () => {
  assert.equal(roundToNearest(123, 25), 125);
  assert.equal(roundToNearest(124, 25), 125);
  assert.equal(roundToNearest(100, 25), 100);
  assert.equal(roundToNearest(112.5, 25), 125); // 112.5/25 = 4.5, rounds to 5, 5*25 = 125
  assert.equal(roundToNearest(153.1, 50), 150);
});

test('resolveBaseRates applies correct rates for hourly mode', () => {
  const result = resolveBaseRates({
    pricingMode: 'hourly',
    useWeightTierPricing: false,
    pricing: baseConfig.pricing,
    config: baseConfig,
  });
  assert.equal(result.minRate, 125);
  assert.equal(result.maxRate, 135);
  assert.equal(result.standardPricingMode, 'hourly');
});

test('resolveBaseRates applies correct rates for mileage mode', () => {
  const result = resolveBaseRates({
    pricingMode: 'mileage',
    useWeightTierPricing: false,
    pricing: baseConfig.pricing,
    config: baseConfig,
  });
  assert.equal(result.minRate, 5);
  assert.equal(result.maxRate, 6);
  assert.equal(result.standardPricingMode, 'mileage');
});

test('resolveBaseRates applies weight tier rates when enabled', () => {
  const tier = { rate: 100, drive_time_buffer: 15, load_unload_base_mins: 20 };
  const result = resolveBaseRates({
    pricingMode: 'hourly',
    useWeightTierPricing: true,
    tier,
    pricing: baseConfig.pricing,
    config: baseConfig,
  });
  assert.equal(result.minRate, 100);
  assert.equal(result.maxRate, 100);
  assert.equal(result.standardPricingMode, 'equipment-weight-tier');
});

test('resolveBaseRates applies heavy rates when flagged', () => {
  const result = resolveBaseRates({
    pricingMode: 'hourly',
    useWeightTierPricing: false,
    isHeavy: true,
    pricing: baseConfig.pricing,
    config: baseConfig,
  });
  assert.equal(result.minRate, 200);
  assert.equal(result.maxRate, 250);
});

test('calculateTimeMetrics applies drive time buffer correctly', () => {
  const result = calculateTimeMetrics({
    rawDriveMinutes: 60,
    baseLoadMinutes: 30,
    extraStopMinutes: 15,
    extraStopCount: 1, // One extra stop
    driveTimeBuffer: 10,
    useWeightTierPricing: false,
  });
  // 60 min * 1.1 (10% buffer) = 66 + 30 load + 15 extra = 111 total, 1.85 hours
  assert.equal(result.adjustedDriveMinutes, 66);
  assert.equal(result.loadUnloadMinutes, 45);
  assert.equal(result.rawTotalHours, 1.85);
});

test('calculateTimeMetrics applies weight tier buffer', () => {
  const tier = { drive_time_buffer: 20, load_unload_base_mins: 45 };
  const result = calculateTimeMetrics({
    rawDriveMinutes: 60,
    extraStopMinutes: 15,
    extraStopCount: 0,
    useWeightTierPricing: true,
    tier,
  });
  // 60 min * 1.2 (20% buffer) + 45 load = 1.75 hours
  assert.equal(result.adjustedDriveMinutes, 72);
  assert.equal(result.loadUnloadMinutes, 45);
  assert.equal(result.rawTotalHours, 1.95);
});

test('calculateSurcharges applies percent surcharges correctly', () => {
  const metroZone = { charge: { feeType: 'percent', value: 28.57 } };
  const result = calculateSurcharges({
    metroMatches: [metroZone],
    overrides: { metro: true },
  });
  // 1 * (1 + 28.57/100) = 1.2857
  assert(Math.abs(result.multiplier - 1.2857) < 0.001);
  assert.equal(result.flatSum, 0);
});

test('calculateSurcharges applies flat surcharges correctly', () => {
  const customZone = { charge: { feeType: 'flat', value: 50 } };
  const result = calculateSurcharges({
    customMatches: [customZone],
  });
  assert.equal(result.multiplier, 1);
  assert.equal(result.flatSum, 50);
});

test('calculateSurcharges combines multiple surcharges', () => {
  const metroZone = { charge: { feeType: 'percent', value: 20 } };
  const customZone = { charge: { feeType: 'flat', value: 25 } };
  const result = calculateSurcharges({
    metroMatches: [metroZone],
    customMatches: [customZone],
    overrides: { metro: true },
  });
  assert.equal(result.multiplier, 1.2);
  assert.equal(result.flatSum, 25);
});

test('calculateSurcharges respects weight tier overrides', () => {
  const metroZone = { charge: { feeType: 'percent', value: 25 } };
  const result = calculateSurcharges({
    metroMatches: [metroZone],
    useWeightTierPricing: true,
    overrides: { metro: true },
  });
  // Metro surcharge ignored when using weight tier pricing
  assert.equal(result.multiplier, 1);
  assert.equal(result.flatSum, 0);
});

test('calculateFinalQuotes applies surcharges to base rates', () => {
  const result = calculateFinalQuotes({
    pricingQuantity: 2, // hours
    minRate: 125,
    maxRate: 135,
    surchargeMultiplier: 1.2,
    surchargeFlatSum: 0,
    permitFee: 0,
    rounding: 25,
  });
  // min: 2 * 125 * 1.2 = 300
  // max: 2 * 135 * 1.2 = 324
  assert.equal(result.minQuote, 300);
  assert.equal(result.maxQuote, 325);
});

test('calculateFinalQuotes adds permit fee to all quotes', () => {
  const result = calculateFinalQuotes({
    pricingQuantity: 2,
    minRate: 125,
    maxRate: 135,
    surchargeMultiplier: 1,
    surchargeFlatSum: 0,
    permitFee: 100,
    rounding: 25,
  });
  // min: 2 * 125 + 100 = 350
  // max: 2 * 135 + 100 = 370
  assert.equal(result.minQuote, 350);
  assert.equal(result.maxQuote, 375);
});

test('calculateFinalQuotes applies flat zone override', () => {
  const result = calculateFinalQuotes({
    pricingQuantity: 2,
    minRate: 125,
    maxRate: 135,
    surchargeMultiplier: 1.5,
    surchargeFlatSum: 200,
    permitFee: 0,
    rounding: 25,
    flatOverride: 400,
  });
  // Flat override replaces calculated quote
  assert.equal(result.minQuote, 400);
  assert.equal(result.maxQuote, 400);
  assert.equal(result.customQuote, 400);
});

test('calculateFinalQuotes calculates custom quotes', () => {
  const result = calculateFinalQuotes({
    pricingQuantity: 2,
    minRate: 125,
    maxRate: 135,
    surchargeMultiplier: 1.1,
    surchargeFlatSum: 10,
    permitFee: 0,
    rounding: 25,
    customRate: 140,
    customQuantity: 2,
  });
  // custom: 2 * 140 * 1.1 + 10 = 318
  assert.equal(result.customQuote, 325);
});

test('calculatePermitRequirements detects overweight permits', () => {
  const result = calculatePermitRequirements({
    weight: 50000,
    width: 90,
    height: 150,
    pickupAddress: '100 Main St, Dallas, TX',
    dropoffAddress: '200 Main St, Dallas, TX',
    baseFee: 150,
  });
  assert.equal(result.needsPermit, true);
  assert.equal(result.permitFee, 150);
  assert(result.flags.some(f => f.includes('Overweight')));
});

test('calculatePermitRequirements detects interstate permits', () => {
  const result = calculatePermitRequirements({
    weight: 50000,
    width: 90,
    height: 150,
    pickupAddress: '100 Main St, Dallas, TX',
    dropoffAddress: '200 Main St, Oklahoma City, OK',
    baseFee: 150,
  });
  assert.equal(result.needsPermit, true);
  assert.equal(result.permitFee, 225); // 150 * 1.5 for interstate
  assert(result.flags.some(f => f.includes('Interstate')));
});

test('calculatePermitRequirements no permit for normal shipments', () => {
  const result = calculatePermitRequirements({
    weight: 10000,
    width: 90,
    height: 150,
    pickupAddress: '100 Main St, Dallas, TX',
    dropoffAddress: '200 Main St, Dallas, TX',
    baseFee: 150,
  });
  assert.equal(result.needsPermit, false);
  assert.equal(result.permitFee, 0);
});

// ===== INTEGRATION TEST: SERVER ENDPOINT PARITY =====

test('calculateAuthoritativeQuote returns consistent quotes', () => {
  const input = {
    waypoints: ['100 Main St, Dallas, TX', '200 Main St, Dallas, TX'],
    selectedTruckClassId: '',
    equipment: { weight: 10000, width: 90, height: 120, attachmentWeight: 0 },
    activeOverrides: { metro: false, hazard: false, roadClub: false, customSurcharges: {} },
    quoteSource: 'web_form',
    isHeavy: false,
  };

  const result = calculateAuthoritativeQuote({
    input,
    config: baseConfig,
    clientConfig: null,
    route: baseRoute,
    role: 'staff',
  });

  // 60 min * 1.1 + 30 load = 96 mins = 1.6 hours
  // 10 miles (16093.44m * 0.000621371)
  // min: 1.6 * 125 = 200 -> rounds to 200
  // max: 1.6 * 135 = 216 -> rounds to 225
  assert(result.minQuote > 0);
  assert(result.maxQuote > 0);
  assert(result.minQuote <= result.maxQuote);
  assert.equal(result.pricingMode, 'hourly');
});

test('calculateAuthoritativeQuote respects weight tier pricing', () => {
  const input = {
    waypoints: ['100 Main St, Dallas, TX', '200 Main St, Dallas, TX'],
    selectedTruckClassId: '',
    equipment: { weight: 5000, width: 90, height: 120, attachmentWeight: 0 },
    activeOverrides: { metro: false, hazard: false, roadClub: false, customSurcharges: {} },
    quoteSource: 'equipment_calculator',
    isHeavy: false,
  };

  const configWithTiers = {
    ...baseConfig,
    client_portal: {
      approval_threshold: 80000,
      weight_tiers: [{ minWeight: 0, maxWeight: 10000, rate: 100, drive_time_buffer: 10, load_unload_base_mins: 30, rounding_interval: 25 }],
    },
  };

  const result = calculateAuthoritativeQuote({
    input,
    config: configWithTiers,
    clientConfig: null,
    route: baseRoute,
    role: 'client',
  });

  assert.equal(result.pricingMode, 'equipment-weight-tier');
  // 60 min * 1.1 + 30 load = 1.6 hours
  // rate: 100 * 1.6 = 160 -> rounds to 150
  assert(result.minQuote > 0);
  assert.equal(result.minQuote, result.maxQuote); // Fixed rate
});

test('calculateAuthoritativeQuote enforces client restrictions', () => {
  const input = {
    waypoints: ['100 Main St, Dallas, TX', '200 Main St, Dallas, TX'],
    selectedTruckClassId: '',
    equipment: { weight: 10000, width: 90, height: 120, attachmentWeight: 0 },
    activeOverrides: {
      metro: true, // Should be ignored
      hazard: true, // Should be ignored
      roadClub: true, // Should be ignored
      customSurcharges: { attacker: true }, // Should be ignored
    },
    customRate: 500, // Should be ignored
    minQuote: 1, // Should be ignored
    maxQuote: 1, // Should be ignored
    quoteSource: 'client_portal',
    isHeavy: true, // Should be ignored
  };

  const configWithTiers = {
    ...baseConfig,
    client_portal: {
      approval_threshold: 80000,
      weight_tiers: [{ minWeight: 0, maxWeight: 20000, rate: 100, drive_time_buffer: 10, load_unload_base_mins: 30, rounding_interval: 25 }],
    },
  };

  const result = calculateAuthoritativeQuote({
    input,
    config: configWithTiers,
    clientConfig: null,
    route: baseRoute,
    role: 'client',
  });

  // Client should only get weight-tier rates, no overrides
  assert.equal(result.pricingMode, 'equipment-weight-tier');
  assert.equal(result.appliedSurcharges.metro, false);
  assert.equal(result.appliedSurcharges.hazard, false);
  assert.equal(result.customQuote, null); // Custom quotes not allowed for clients
});

test('calculateAuthoritativeQuote calculates mileage mode', () => {
  const input = {
    waypoints: ['100 Main St, Dallas, TX', '200 Main St, Dallas, TX'],
    selectedTruckClassId: '',
    equipment: { weight: 10000, width: 90, height: 120, attachmentWeight: 0 },
    activeOverrides: { metro: false, hazard: false, roadClub: false, customSurcharges: {} },
    quoteSource: 'web_form',
    isHeavy: false,
  };

  const mileageConfig = {
    ...baseConfig,
    pricing: { ...baseConfig.pricing, pricing_mode: 'mileage' },
  };

  const result = calculateAuthoritativeQuote({
    input,
    config: mileageConfig,
    clientConfig: null,
    route: baseRoute,
    role: 'staff',
  });

  assert.equal(result.pricingMode, 'mileage');
  // 10 miles * $5 = $50, 10 miles * $6 = $60
  assert(result.minQuote <= result.maxQuote);
  assert(result.totalMiles > 9 && result.totalMiles < 11); // Around 10 miles
});
