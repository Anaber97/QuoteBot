import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRadiusPolygon } from '../src/utils/geofenceGeometry.js';

const haversineMiles = (from, to) => {
  const radians = (degrees) => degrees * Math.PI / 180;
  const deltaLat = radians(to.lat - from.lat);
  const deltaLng = radians(to.lng - from.lng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

test('radius generator creates a 64-point polygon at the requested distance', () => {
  const center = { lat: 32.1532, lng: -94.7994 };
  const shape = buildRadiusPolygon(center, 15);
  assert.equal(shape.length, 64);
  shape.forEach((point) => assert.ok(Math.abs(haversineMiles(center, point) - 15) < 0.001));
});

test('radius generator rejects invalid centers and distances', () => {
  assert.deepEqual(buildRadiusPolygon(null, 10), []);
  assert.deepEqual(buildRadiusPolygon({ lat: 32, lng: -95 }, 0), []);
});
