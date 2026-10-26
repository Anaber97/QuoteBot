import test from 'node:test';
import assert from 'node:assert/strict';

import { addressNamesZoneCity, addressState, zoneStates } from '../shared/geo/addressMatch.js';
import { calculatePermitRequirements } from '../src/lib/pricingEngine.js';
import { checkGeofenceZone } from '../src/utils/geofenceEngine.js';
import { calculateAuthoritativeQuote } from '../api/_quoteEngine.js';
import { GEOFENCES, HAZARD_ZONES } from '../src/config/geofences.js';

test('addressState reads the state from the end of an address, not from road names', () => {
  assert.equal(addressState('1200 FM 2276, Kilgore, TX'), 'TX');
  assert.equal(addressState('812 CR 3214, Jacksonville, TX 75766, USA'), 'TX');
  assert.equal(addressState('1200 US-287, Mansfield, TX 76063'), 'TX');
  assert.equal(addressState('400 SH 31 E, Tyler, TX'), 'TX');
  assert.equal(addressState('100 NE 5th St, Miami, FL 33132, USA'), 'FL');
  assert.equal(addressState('Shreveport, Louisiana'), 'LA');
  assert.equal(addressState('kilgore, tx'), 'TX');
  assert.equal(addressState('Kilgore TX'), 'TX');
  assert.equal(addressState('1200 US-287'), '');
  assert.equal(addressState('500 Main St, Dr'), '');
  assert.equal(addressState(''), '');
});

test('zoneStates comes from the built-in zone names', () => {
  assert.deepEqual(zoneStates(HAZARD_ZONES.vail_pass), ['CO']);
  assert.deepEqual(zoneStates(HAZARD_ZONES.donner_pass), ['CA', 'NV']);
  assert.deepEqual(zoneStates(GEOFENCES.dfw), ['TX']);
});

test('zone city names match whole words in the zone state only', () => {
  assert.equal(addressNamesZoneCity('6100 Main St, Frisco, TX 75034', HAZARD_ZONES.vail_pass), false);
  assert.equal(addressNamesZoneCity('6100 Main St, Frisco, TX 75034', GEOFENCES.dfw), true);
  assert.equal(addressNamesZoneCity('720 Main St, Frisco, CO 80443', HAZARD_ZONES.vail_pass), true);
  assert.equal(addressNamesZoneCity('2000 Forest Ridge Dr, Bedford, TX 76021', HAZARD_ZONES.allegheny_pass), false);
  assert.equal(addressNamesZoneCity('100 Vailsburg Ave, Newark, NJ', HAZARD_ZONES.vail_pass), false);
  assert.equal(addressNamesZoneCity('Frisco', HAZARD_ZONES.vail_pass), false);
});

test('Texas farm-to-market and county-road addresses are not interstate permits', () => {
  const result = calculatePermitRequirements({
    weight: 50000, width: 90, height: 120,
    pickupAddress: '1200 FM 2276, Kilgore, TX', dropoffAddress: '812 CR 3214, Jacksonville, TX',
    baseFee: 150,
  });
  assert.equal(result.isInterstate, false);
  assert.equal(result.permitFee, 150);
  assert.equal(result.flags.some((flag) => flag.includes('Interstate')), false);
});

test('browser keyword check no longer puts DFW suburbs in mountain hazard zones', async () => {
  for (const address of ['6100 Main St, Frisco, TX 75034', '2000 Forest Ridge Dr, Bedford, TX 76021', '100 Main St, Somerset, TX 78069']) {
    for (const zone of Object.values(HAZARD_ZONES)) {
      assert.equal(await checkGeofenceZone(zone, [address, 'Dallas, TX'], [], []), false, `${address} matched ${zone.id}`);
    }
  }
});

test('server quotes for DFW suburbs carry no hazard surcharge', () => {
  const result = calculateAuthoritativeQuote({
    role: 'dispatch', clientConfig: null,
    route: { totalMeters: 40000, rawDriveMinutes: 60, customerRoutePoints: [], legs: [] },
    config: { pricing: { hourly_min: 125, hourly_max: 125, rounding_interval: 25 }, geofences: { disabledZones: [], customZones: [] } },
    input: { waypoints: ['6100 Main St, Frisco, TX 75034', '2000 Forest Ridge Dr, Bedford, TX 76021'], equipment: {}, activeOverrides: {} },
  });
  assert.equal(result.appliedSurcharges.hazard, false);
  assert.equal(result.appliedSurcharges.metro, true);
});
