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
  assert.deepEqual(matches[0].charge, { pricingMode: 'surcharge', feeType: 'flat', value: 50 });
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
  assert.deepEqual(resolveZoneCharge(zone, config), { pricingMode: 'surcharge', feeType: 'percent', value: 10 });
  config.geofences.customZoneRates['metro-test'] = { feeType: 'flat', value: 0 };
  assert.deepEqual(resolveZoneCharge(zone, config), { pricingMode: 'surcharge', feeType: 'flat', value: 0 });
});

const { isBuiltInZoneActive } = await import('../shared/pricing/zoneCharge.js');
const { normalizeConfig, DEFAULT_CONFIG } = await import('../src/lib/configSchema.js');
const { getMinOverride } = await import('../src/lib/pricingEngine.js');
const { validateConfigInput } = await import('../src/lib/configValidator.js');

const BUILT_IN_COUNT = Object.keys({ ...GEOFENCES, ...HAZARD_ZONES }).length;
const dfwConfig = (rule) => ({
  pricing: { hourly_rate: 100, drive_time_buffer: 10, load_unload_base_mins: 30, rounding_interval: 25 },
  client_portal: { escort_rules: [{ minWidth: 144, vehicleCount: 1, surcharge: 400 }],
    weight_tiers: [{ minWeight: 0, maxWeight: 999999, rate: 100, rounding_interval: 25 }] },
  geofences: { builtInZoneMode: 'opt_in', enabledZones: ['dfw'], customZones: [], customZoneRates: rule ? { dfw: rule } : {} },
});
const dfwQuote = (config, { role = 'client', waypoints = ['100 Main St, Dallas, TX', '200 Elm St, Fort Worth, TX'], driveMinutes = 60, equipment = {}, activeOverrides = {} } = {}) =>
  calculateAuthoritativeQuote({ role, config, clientConfig: null,
    input: { waypoints, quoteSource: role === 'client' ? 'client_portal' : 'main_calculator', activeOverrides,
      equipment: { weight: 10000, width: 96, height: 120, ...equipment } },
    route: { totalMeters: 16093.44, rawDriveMinutes: driveMinutes, customerRoutePoints: [], legs: [] } });

test('built-in zones are opt-in for new companies; older configs keep theirs on', () => {
  assert.equal(isBuiltInZoneActive('dfw', {}), false);
  assert.equal(isBuiltInZoneActive('dfw', { builtInZoneMode: 'opt_in', enabledZones: ['dfw'], disabledZones: ['dfw'] }), true);
  assert.equal(isBuiltInZoneActive('dfw', { disabledZones: [] }), true, 'saved before opt-in: on unless switched off');
  assert.equal(isBuiltInZoneActive('dfw', { disabledZones: ['dfw'] }), false);

  assert.deepEqual(normalizeConfig(DEFAULT_CONFIG).geofences.enabledZones, []);
  const converted = normalizeConfig({ geofences: { disabledZones: ['dfw', 'custom-1'] } }).geofences;
  assert.equal(converted.builtInZoneMode, 'opt_in');
  assert.equal(converted.enabledZones.length, BUILT_IN_COUNT - 1);
  assert.ok(converted.enabledZones.includes('houston') && !converted.enabledZones.includes('dfw'));
  assert.deepEqual(converted.disabledZones, ['dfw', 'custom-1'], 'custom zones stay switched off');

  const newCompany = { ...dfwConfig(), geofences: { builtInZoneMode: 'opt_in', enabledZones: [], customZones: [] } };
  assert.equal(dfwQuote(newCompany).appliedSurcharges.metro, false);
});

test('a metro minimum lifts short jobs, leaves bigger ones alone, and applies to clients and staff alike', () => {
  const minimum = dfwConfig({ pricingMode: 'min_rate', value: 900 });
  const none = { ...dfwConfig(), geofences: { builtInZoneMode: 'opt_in', enabledZones: [], customZones: [] } };
  assert.equal(dfwQuote(none).minQuote, 150);
  assert.equal(dfwQuote(minimum).minQuote, 900);
  assert.equal(dfwQuote(minimum, { role: 'dispatch' }).minQuote, 900);
  assert.equal(dfwQuote(minimum, { driveMinutes: 600 }).minQuote, dfwQuote(none, { driveMinutes: 600 }).minQuote);

  assert.equal(dfwQuote(minimum, { role: 'dispatch', activeOverrides: { metro: false } }).minQuote, 150, 'staff can switch it off per quote');
  assert.equal(dfwQuote(minimum, { activeOverrides: { metro: false } }).minQuote, 900, 'clients cannot');

  const wide = dfwQuote(minimum, { equipment: { width: 150 } });
  assert.equal(wide.minQuote, 900 + 400 + wide.quoteDetails.permitFee, 'permit and escort are added on top');
});

test('metro maximum and flat-rate rules need the pickup and dropoff inside the metro', () => {
  const outbound = { waypoints: ['100 Main St, Dallas, TX', '1 Austin Ave, Waco, TX'], driveMinutes: 600 };
  for (const [pricingMode, value] of [['max_rate', 300], ['flat_rate', 300]]) {
    const config = dfwConfig({ pricingMode, value });
    assert.equal(dfwQuote(config, { driveMinutes: 600 }).minQuote, 300, pricingMode);
    const leaving = dfwQuote(config, outbound);
    assert.equal(leaving.minQuote, 1150, `${pricingMode} does not apply to a job leaving the metro`);
    assert.equal(leaving.appliedSurcharges.metro, false);
  }
  assert.equal(dfwQuote(dfwConfig({ pricingMode: 'surcharge', feeType: 'flat', value: 100 }), outbound).minQuote, 1250, 'a surcharge still applies on touch');
});

test('custom zones and the browser share the minimum rule', async () => {
  const shape = [{ lat: 32, lng: -95 }, { lat: 32, lng: -94 }, { lat: 33, lng: -94 }, { lat: 33, lng: -95 }];
  const config = { ...dfwConfig(), geofences: { builtInZoneMode: 'opt_in', enabledZones: [], customZoneRates: {},
    customZones: [{ id: 'town', name: 'Town', pricingMode: 'min_rate', price: 500, shape }] } };
  const quote = calculateAuthoritativeQuote({ role: 'client', config, clientConfig: null,
    input: { waypoints: ['A, TX', 'B, TX'], equipment: { weight: 10000, width: 96, height: 120 } },
    route: { totalMeters: 16093.44, rawDriveMinutes: 60, customerRoutePoints: [{ lat: 32.5, lng: -94.5 }, { lat: 34, lng: -94.5 }], legs: [] } });
  assert.equal(quote.minQuote, 500);

  const matches = await evaluateMetroGeofences(['100 Main St, Dallas, TX', '200 Elm St, Fort Worth, TX'], [], dfwConfig({ pricingMode: 'min_rate', value: 900 }));
  assert.deepEqual(matches.map((zone) => zone.charge), [{ pricingMode: 'min_rate', feeType: 'flat', value: 900 }]);
  assert.equal(getMinOverride(matches), 900);
  assert.equal(formatZoneCharge(matches[0].charge), 'min $900');
});

test('zone rules must be a known type with a non-negative amount', () => {
  const errors = (customZoneRates) => validateConfigInput({ geofences: { customZoneRates } }).errors.map((error) => error.path);
  assert.deepEqual(errors({ dfw: { pricingMode: 'min_rate', value: 900 } }), []);
  assert.deepEqual(errors({ dfw: { pricingMode: 'floor', value: 900 } }), ['geofences.customZoneRates.dfw.pricingMode']);
  assert.deepEqual(errors({ dfw: { pricingMode: 'min_rate', value: -5 } }), ['geofences.customZoneRates.dfw.value']);
});
