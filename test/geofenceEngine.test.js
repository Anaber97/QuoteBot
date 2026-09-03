import test from 'node:test';
import assert from 'node:assert/strict';

import { checkGeofenceZone, evaluateCustomGeofences } from '../src/utils/geofenceEngine.js';

const zone = {
  id: 'test-zone',
  box: { minLat: 40, maxLat: 41, minLng: -75, maxLng: -74 },
  cities: [],
};

test('geofence checks reuse supplied route geometry without Google Maps', async () => {
  const matched = await checkGeofenceZone(
    zone,
    ['Pickup outside zone', 'Dropoff outside zone'],
    [{ lat: 39, lng: -76 }, { lat: 42, lng: -73 }],
    [{ lat: 40.5, lng: -74.5 }]
  );

  assert.equal(matched, true);
});

test('geofence checks return false when points and route miss the zone', async () => {
  const matched = await checkGeofenceZone(
    zone,
    ['Pickup outside zone', 'Dropoff outside zone'],
    [{ lat: 39, lng: -76 }, { lat: 42, lng: -73 }],
    [{ lat: 39.5, lng: -75.5 }]
  );

  assert.equal(matched, false);
});

test('custom municipality zones never use locality metadata without a city-limit polygon', async () => {
  const companyRates = { geofences: { customZones: [{ id: 'henderson', city: 'Henderson', state: 'TX', pricingMode: 'flat_rate', price: 100 }] } };
  const falsePositive = await evaluateCustomGeofences(
    ['100 Henderson Rd, Longview, TX', '200 Henderson Rd, Longview, TX'],
    [{ lat: 32.5, lng: -94.7 }, { lat: 32.6, lng: -94.8 }],
    companyRates,
    [{ city: 'Longview', state: 'TX' }, { city: 'Longview', state: 'TX' }]
  );
  assert.equal(falsePositive.length, 0);

  const localityOnlyMatch = await evaluateCustomGeofences(
    ['Pickup', 'Dropoff'],
    [{ lat: 32.1, lng: -94.8 }, { lat: 32.2, lng: -94.7 }],
    companyRates,
    [{ city: 'Henderson', state: 'TX' }, { city: 'Henderson', state: 'TX' }]
  );
  assert.equal(localityOnlyMatch.length, 0);
});

test('custom municipality pricing requires coordinates inside the saved boundary', async () => {
  const companyRates = { geofences: { customZones: [{
    id: 'henderson', city: 'Henderson', state: 'TX', pricingMode: 'flat_rate', price: 100,
    shape: [{ lat: 32, lng: -95 }, { lat: 32, lng: -94 }, { lat: 33, lng: -94 }, { lat: 33, lng: -95 }],
  }] } };
  const outside = await evaluateCustomGeofences([], [{ lat: 33.1, lng: -94.5 }, { lat: 33.2, lng: -94.5 }], companyRates);
  const inside = await evaluateCustomGeofences([], [{ lat: 32.1, lng: -94.8 }, { lat: 32.2, lng: -94.7 }], companyRates);
  assert.equal(outside.length, 0);
  assert.equal(inside.length, 1);
});

test('custom zone priority keeps only the highest matching tier and stacks ties', async () => {
  const shape = [{ lat: 32, lng: -95 }, { lat: 32, lng: -94 }, { lat: 33, lng: -94 }, { lat: 33, lng: -95 }];
  const companyRates = { geofences: { customZones: [
    { id: 'low', name: 'Low', priority: 1, pricingMode: 'surcharge', price: 5, shape },
    { id: 'high-a', name: 'High A', priority: 10, pricingMode: 'surcharge', price: 10, shape },
    { id: 'high-b', name: 'High B', priority: 10, pricingMode: 'surcharge', price: 15, shape },
  ] } };

  const matches = await evaluateCustomGeofences([], [{ lat: 32.5, lng: -94.5 }], companyRates);
  assert.deepEqual(matches.map((zone) => zone.id), ['high-a', 'high-b']);
});
