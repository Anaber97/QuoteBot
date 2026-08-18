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

test('polyline decoder returns route coordinates for server geofencing', () => {
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [
    { lat: 38.5, lng: -120.2 },
    { lat: 40.7, lng: -120.95 },
    { lat: 43.252, lng: -126.453 },
  ]);
});

test('server routing reuses only pickup-to-dropoff geometry for geofences', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, request) => {
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
  } finally {
    globalThis.fetch = originalFetch;
  }
});
