import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateAuthoritativeQuote, decodePolyline } from '../api/_quoteEngine.js';
import { computeServerRoute } from '../api/_routes.js';
import { normalizeQuoteInput } from '../api/createQuote.js';

const route = {
  totalMeters: 16093.44,
  rawDriveMinutes: 60,
  customerRoutePoints: [],
  legs: [{ durationMinutes: 20, distanceMeters: 5000 }],
};

const config = {
  pricing: {
    hourly_min: 125,
    hourly_max: 135,
    drive_time_buffer: 10,
    load_unload_base_mins: 30,
    rounding_interval: 25,
    after_hours_multiplier: 25,
    weight_tiers: [],
  },
  client_portal: {
    approval_threshold: 80000,
    weight_tiers: [{ minWeight: 0, maxWeight: 999999, rate: 100, drive_time_buffer: 10, load_unload_base_mins: 30, rounding_interval: 25 }],
  },
  geofences: { disabledZones: Object.keys((await import('../src/config/geofences.js')).GEOFENCES).concat(Object.keys((await import('../src/config/geofences.js')).HAZARD_ZONES)), customZones: [] },
};

test('client-supplied totals and privileged pricing controls are ignored', () => {
  const result = calculateAuthoritativeQuote({
    role: 'client', config, clientConfig: null, route,
    input: {
      waypoints: ['100 Main St, Dallas, TX', '200 Main St, Dallas, TX'],
      quoteSource: 'client_portal', selectedTruckClassId: '', equipment: { weight: 10000, width: 90, height: 120 },
      minQuote: 1, maxQuote: 1, customRate: 1, isAfterHours: true,
      activeOverrides: { afterHours: true, customSurcharges: { attacker: true } },
    },
  });
  assert.equal(result.minQuote, 150);
  assert.equal(result.maxQuote, 150);
  assert.equal(result.customQuote, null);
  assert.equal(result.appliedSurcharges.afterHours, false);
});

test('authoritative endpoint contract discards forged stored values', () => {
  const normalized = normalizeQuoteInput({
    baseId: 'base-1', waypoints: ['Pickup', 'Dropoff'], min_quote: 1, max_quote: 1, total_miles: 1,
    customRate: 1, isAfterHours: true, activeOverrides: { afterHours: true },
  }, { role: 'client' });
  assert.equal('min_quote' in normalized, false);
  assert.equal('max_quote' in normalized, false);
  assert.equal('total_miles' in normalized, false);
  assert.equal(normalized.customRate, null);
  assert.equal(normalized.isAfterHours, false);
});

test('authoritative endpoint validation rejects missing route inputs', () => {
  assert.throws(
    () => normalizeQuoteInput({ waypoints: ['Pickup only'] }, { role: 'dispatch' }),
    (error) => error.status === 400 && /pickup and dropoff/i.test(error.message)
  );
});

test('polyline decoder returns route coordinates for server geofencing', () => {
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [
    { lat: 38.5, lng: -120.2 },
    { lat: 40.7, lng: -120.95 },
    { lat: 43.252, lng: -126.453 },
  ]);
});

test('server routing reuses only pickup-to-dropoff geometry for geofences', async () => {
  const originalFetch = globalThis.fetch;
  let routeRequests = 0;
  globalThis.fetch = async (_url, request) => {
    routeRequests += 1;
    const submitted = JSON.parse(request.body);
    assert.equal(submitted.intermediates.length, 2);
    return new Response(JSON.stringify({ routes: [{ distanceMeters: 3000, duration: '1800s', legs: [
      { distanceMeters: 1000, duration: '600s', polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' } },
      { distanceMeters: 1000, duration: '600s', polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' } },
      { distanceMeters: 1000, duration: '600s', polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' } },
    ] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const computed = await computeServerRoute(['Base', 'Pickup', 'Dropoff', 'Base'], { apiKey: 'test-key' });
    assert.equal(computed.customerRoutePoints.length, 3);
    assert.equal(computed.rawDriveMinutes, 30);
    assert.equal(routeRequests, 1, 'one quote must make exactly one route request');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const quote = (overrides = {}) => calculateAuthoritativeQuote({
  role: overrides.role || 'dispatch',
  config: overrides.config || config,
  clientConfig: overrides.clientConfig || null,
  route: overrides.route || route,
  input: {
    waypoints: ['Pickup, KS', 'Dropoff, KS'],
    quoteSource: 'main_calculator',
    selectedTruckClassId: '',
    equipment: { weight: 10000, width: 90, height: 120 },
    activeOverrides: {},
    ...(overrides.input || {}),
  },
});

test('weight-tier boundaries are inclusive and select the next tier correctly', () => {
  const tierConfig = structuredClone(config);
  tierConfig.client_portal.weight_tiers = [
    { minWeight: 0, maxWeight: 10000, rate: 100, drive_time_buffer: 10, load_unload_base_mins: 30, rounding_interval: 25 },
    { minWeight: 10001, maxWeight: 20000, rate: 200, drive_time_buffer: 10, load_unload_base_mins: 30, rounding_interval: 25 },
  ];
  assert.equal(quote({ role: 'client', config: tierConfig, input: { equipment: { weight: 10000 } } }).minQuote, 150);
  assert.equal(quote({ role: 'client', config: tierConfig, input: { equipment: { weight: 10001 } } }).minQuote, 325);
});

test('extra stops add configured on-site time', () => {
  const extraStopConfig = structuredClone(config);
  extraStopConfig.pricing.extra_stop_mins = 30;
  const result = quote({ config: extraStopConfig, input: { waypoints: ['Pickup, KS', 'Stop, KS', 'Dropoff, KS'] } });
  assert.equal(result.totalHours, 2.1);
});

test('flat and percentage surcharges apply in the documented order before rounding', () => {
  const surchargeConfig = structuredClone(config);
  surchargeConfig.pricing.custom_surcharges = [
    { id: 'after-hours', name: 'After Hours', feeType: 'percent', value: 20, active: true },
    { id: 'road-club', name: 'Road Club', feeType: 'flat', value: 30, active: true },
  ];
  const result = quote({ config: surchargeConfig, input: { activeOverrides: { customSurcharges: { 'after-hours': true, 'road-club': true } } } });
  assert.equal(result.minQuote, 275);
});

test('metro and hazard route matches apply configured charges', () => {
  const zoneConfig = structuredClone(config);
  zoneConfig.geofences.disabledZones = [];
  const result = quote({
    config: zoneConfig,
    input: { waypoints: ['Dallas, TX', 'Truckee, CA'], activeOverrides: { metro: true, hazard: true } },
  });
  assert.equal(result.appliedSurcharges.metro, true);
  assert.equal(result.appliedSurcharges.hazard, true);
  assert.deepEqual(result.metroCodes, ['DFW']);
  assert.ok(result.minQuote > 200);
});

test('permit fees cover oversize and interstate equipment', () => {
  const permitConfig = structuredClone(config);
  permitConfig.pricing.base_permit_fee = 200;
  const result = quote({ config: permitConfig, input: { waypoints: ['Pickup, KS', 'Dropoff, MO'], equipment: { weight: 46000, width: 103, height: 163 } } });
  assert.equal(result.permit.needsPermit, true);
  assert.equal(result.permit.isInterstate, true);
  assert.equal(result.permit.permitFee, 300);
  assert.equal(result.permit.flags.length, 4);
});

test('attachment weight participates in tier selection and approval', () => {
  const tierConfig = structuredClone(config);
  tierConfig.client_portal.approval_threshold = 15000;
  tierConfig.client_portal.weight_tiers = [
    { minWeight: 0, maxWeight: 14999, rate: 100 },
    { minWeight: 15000, maxWeight: 999999, rate: 200 },
  ];
  const result = quote({ role: 'client', config: tierConfig, input: { equipment: { weight: 10000, attachmentWeight: 5000 } } });
  assert.equal(result.minQuote, 325);
  assert.equal(result.approvalRequired, true);
});

test('rounding uses the configured increment', () => {
  const roundingConfig = structuredClone(config);
  roundingConfig.pricing.rounding_interval = 50;
  const result = quote({ config: roundingConfig });
  assert.equal(result.minQuote % 50, 0);
  assert.equal(result.maxQuote % 50, 0);
});

test('client-specific pricing overrides company tiers and timing', () => {
  const clientConfig = {
    pricing: { use_custom_pricing: true, weight_tiers: [{ minWeight: 0, maxWeight: 999999, rate: 175, drive_time_buffer: 0, load_unload_base_mins: 60, rounding_interval: 25 }] },
  };
  const result = quote({ role: 'client', clientConfig });
  assert.equal(result.totalHours, 1);
  assert.equal(result.minQuote, 175);
});

test('mileage mode prices the full routed mileage and preserves surcharge rounding', () => {
  const mileageConfig = structuredClone(config);
  mileageConfig.pricing.pricing_mode = 'mileage';
  mileageConfig.pricing.mileage_min = 5;
  mileageConfig.pricing.mileage_max = 6;
  mileageConfig.pricing.rounding_interval = 25;
  const result = quote({ config: mileageConfig, role: 'dispatcher' });
  assert.equal(result.pricingMode, 'mileage');
  assert.equal(Math.round(result.totalMiles), 10);
  assert.equal(result.minQuote, 50);
  assert.equal(result.maxQuote, 50);
});

test('hourly mode remains the default when no pricing mode is saved', () => {
  const result = quote({ role: 'dispatcher' });
  assert.equal(result.pricingMode, 'hourly');
  assert.equal(result.minQuote, 200);
});

test('equipment pricing ignores municipality rates but keeps selected custom surcharges', () => {
  const equipmentConfig = structuredClone(config);
  equipmentConfig.geofences.customZones = [{ id: 'henderson', city: 'Henderson', state: 'TX', pricingMode: 'flat_rate', price: 100 }];
  equipmentConfig.pricing.custom_surcharges = [{ id: 'lift', name: 'Special lift', feeType: 'flat', value: 50, active: true }];
  const result = quote({
    config: equipmentConfig,
    route: { ...route, localities: [{ city: 'Henderson', state: 'TX' }, { city: 'Henderson', state: 'TX' }] },
    input: { quoteSource: 'equipment_calculator', activeOverrides: { customSurcharges: { lift: true } } },
  });
  assert.equal(result.minQuote, 200);
  assert.equal(result.maxQuote, 200);
});
