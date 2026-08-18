import test from 'node:test';
import assert from 'node:assert/strict';

import { checkGeofenceZone } from '../src/utils/geofenceEngine.js';

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
