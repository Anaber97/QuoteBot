import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveZoneCharge, formatZoneCharge } from '../shared/pricing/zoneCharge.js';
import { evaluateMetroGeofences } from '../src/utils/geofenceEngine.js';
import { calculateSurcharges } from '../src/lib/pricingEngine.js';
import { calculateAuthoritativeQuote } from '../api/_quoteEngine.js';
import { GEOFENCES, HAZARD_ZONES } from '../src/config/geofences.js';

test('metro flat amount is added once in browser and saved quote calculations', async () => {
  const zone = Object.values(GEOFENCES)[0];
  const addresses = [zone.cities[0], zone.cities[0]];
  const config = {
    pricing: { hourly_rate: 200, drive_time_buffer: 0, load_unload_base_mins: 0, rounding_interval: 1, metro_multiplier: 50, surchargeModes: { metro_multiplier: 'flat' } },
    geofences: { disabledZones: Object.values(HAZARD_ZONES).map((item) => item.id), customZones: [] },
  };
  const matches = await evaluateMetroGeofences(addresses, [], config);
  assert.ok(matches.length > 0);
  assert.deepEqual(matches[0].charge, { feeType: 'flat', value: 50 });
  assert.deepEqual(calculateSurcharges({ metroMatches: matches }), { multiplier: 1, flatSum: 50 });
  const args = { role: 'dispatch', config, clientConfig: null,
    input: { waypoints: addresses, equipment: {}, activeOverrides: {} },
    route: { totalMeters: 16093.44, rawDriveMinutes: 60, customerRoutePoints: [], legs: [] } };
  const baseline = calculateAuthoritativeQuote({ ...args, input: { ...args.input, activeOverrides: { metro: false } } });
  assert.equal(calculateAuthoritativeQuote(args).minQuote - baseline.minQuote, 50);
  config.pricing.surchargeModes.metro_multiplier = 'percent';
  assert.equal(calculateAuthoritativeQuote(args).minQuote, baseline.minQuote * 1.5);
});

test('zone overrides and zero amounts retain precedence, with accurate flat labels', () => {
  const zone = { id: 'metro-test', multiplier: 1.2857 };
  const config = { pricing: { metro_multiplier: 50, surchargeModes: { metro_multiplier: 'flat' } } };
  assert.equal(formatZoneCharge(resolveZoneCharge(zone, config)), '+$50');
  config.geofences = { customZoneRates: { 'metro-test': { feeType: 'percent', value: 10 } } };
  assert.deepEqual(resolveZoneCharge(zone, config), { feeType: 'percent', value: 10 });
  config.geofences.customZoneRates['metro-test'] = { feeType: 'flat', value: 0 };
  assert.deepEqual(resolveZoneCharge(zone, config), { feeType: 'flat', value: 0 });
});
