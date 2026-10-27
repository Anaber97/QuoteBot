import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateOvernights, escortDriveMinutes } from '../src/lib/pricingEngine.js';
import { calculateAuthoritativeQuote } from '../api/_quoteEngine.js';
import { normalizeConfig, DEFAULT_CONFIG } from '../src/lib/configSchema.js';
import { validateConfigInput } from '../src/lib/configValidator.js';

const hours = (value) => value * 60;

test('the driver gets a night once a trip passes 11 driving hours or a 14-hour on-duty day', () => {
  assert.equal(calculateOvernights({ driveMinutes: hours(10), onSiteMinutes: 60 }).driver, 0);
  assert.equal(calculateOvernights({ driveMinutes: hours(11), onSiteMinutes: hours(2.5) }).driver, 0, '11 + 2.5 + 0.5 break is exactly 14');
  assert.equal(calculateOvernights({ driveMinutes: hours(12), onSiteMinutes: 0 }).driver, 1, 'over 11 driving hours');
  assert.equal(calculateOvernights({ driveMinutes: hours(10), onSiteMinutes: hours(4) }).driver, 1, 'long loading pushes past 14 on-duty hours');
  const roundTrip = calculateOvernights({ driveMinutes: hours(28), onSiteMinutes: 60 });
  assert.deepEqual([roundTrip.driver, roundTrip.onDutyHours], [2, 30.5], '28 h of driving plus 1 h on site and three breaks');
});

test('permitted loads can be held to fewer travel hours a day, and escorts follow that limit', () => {
  const settings = { permittedLoadHours: 9 };
  assert.equal(calculateOvernights({ driveMinutes: hours(10), settings }).driver, 0, 'a legal load still gets 11 hours');
  assert.equal(calculateOvernights({ driveMinutes: hours(10), permittedLoad: true, settings }).driver, 1);
  assert.equal(calculateOvernights({ driveMinutes: hours(10), permittedLoad: true, settings: { permittedLoadHours: 13 } }).driver, 0, 'never more than the driving limit');
  assert.deepEqual(calculateOvernights({ escortDriveMinutes: [hours(10), hours(5)], permittedLoad: true, settings }).escorts, [1, 0]);
  assert.deepEqual(calculateOvernights({ escortDriveMinutes: [hours(10)], permittedLoad: true }).escorts, [0]);
});

test('each night is charged at the company rate, and blank rates show nights without charging', () => {
  const trip = { driveMinutes: hours(28), escortDriveMinutes: [hours(14), hours(14)], permittedLoad: true };
  const priced = calculateOvernights({ ...trip, settings: { driverCharge: 250, escortCharge: 150 } });
  assert.deepEqual([priced.driver, priced.escorts, priced.charge], [2, [1, 1], 800]);
  assert.deepEqual([calculateOvernights(trip).charge, calculateOvernights(trip).driver], [0, 2]);
});

test('escort driving is the customer trip prorated by the miles each escort is required', () => {
  assert.deepEqual(escortDriveMinutes([200, 50], 200, 600), [600, 150]);
  assert.deepEqual(escortDriveMinutes([200], 0, 600), [600], 'unknown miles: the whole customer trip');
});

test('equipment quotes add overnights on top; standard quotes do not', () => {
  const config = (charges) => ({ pricing: { hourly_rate: 100, drive_time_buffer: 0, rounding_interval: 1 },
    geofences: { builtInZoneMode: 'opt_in', enabledZones: [], customZones: [] },
    client_portal: { escort_rules: [{ vehicleCount: 1, minWidth: 144, surcharge: 400 }],
      overnight_pricing: { maxDriveHours: 11, maxOnDutyHours: 14, ...charges },
      weight_tiers: [{ minWeight: 0, maxWeight: 999999, rate: 100, drive_time_buffer: 0, load_unload_base_mins: 30, rounding_interval: 1 }] } });
  // One hour out to the pickup, 14 hours loaded, 14 hours back to the yard.
  const route = { totalMeters: 2_000_000, rawDriveMinutes: hours(29), customerRoutePoints: [],
    legs: [{ durationMinutes: hours(1), distanceMeters: 100_000 }, { durationMinutes: hours(14), distanceMeters: 1_000_000 }, { durationMinutes: hours(14), distanceMeters: 900_000 }] };
  const quote = (cfg, role = 'client', quoteSource = 'client_portal') => calculateAuthoritativeQuote({ role, config: cfg, clientConfig: null, route,
    input: { waypoints: ['A, TX', 'B, CO'], quoteSource, equipment: { weight: 30000, width: 150, height: 120 } } });

  const priced = quote(config({ driverCharge: 300, escortCharge: 200 }));
  assert.deepEqual([priced.overnights.driver, priced.overnights.escorts, priced.overnights.charge], [2, [1], 800]);
  assert.equal(priced.minQuote - quote(config({})).minQuote, 800);
  assert.deepEqual(priced.quoteDetails.overnights, priced.overnights);
  assert.equal(quote(config({ driverCharge: 300 }), 'dispatch', 'main_calculator').overnights, null);
});

test('hour limits default to the federal rules and charges start blank', () => {
  assert.deepEqual(normalizeConfig(DEFAULT_CONFIG).client_portal.overnight_pricing,
    { maxDriveHours: 11, maxOnDutyHours: 14, permittedLoadHours: null, driverCharge: null, escortCharge: null });
  const errors = (overnight_pricing) => validateConfigInput({ client_portal: { overnight_pricing } }).errors.map((error) => error.path);
  assert.deepEqual(errors({ maxDriveHours: 11, permittedLoadHours: '', driverCharge: 250 }), []);
  assert.deepEqual(errors({ maxDriveHours: 30, escortCharge: -1 }), ['client_portal.overnight_pricing.maxDriveHours', 'client_portal.overnight_pricing.escortCharge']);
});

test('trips with any overnight stay come to the company for approval', async () => {
  const { hasOvernights } = await import('../src/lib/pricingEngine.js');
  assert.equal(hasOvernights({ driver: 0, escorts: [0, 1] }), true);
  assert.equal(hasOvernights({ driver: 0, escorts: [] }), false);
  assert.equal(hasOvernights(null), false);

  const config = { pricing: {}, geofences: { builtInZoneMode: 'opt_in', enabledZones: [], customZones: [] },
    client_portal: { approval_threshold: 80000, weight_tiers: [{ minWeight: 0, maxWeight: 999999, rate: 100, drive_time_buffer: 0, load_unload_base_mins: 30 }] } };
  const quote = (driveHours) => calculateAuthoritativeQuote({ role: 'client', config, clientConfig: null,
    input: { waypoints: ['A, TX', 'B, TX'], equipment: { weight: 30000, width: 96, height: 120 } },
    route: { totalMeters: 100000, rawDriveMinutes: hours(driveHours), customerRoutePoints: [], legs: [] } });
  assert.equal(quote(6).approvalRequired, false);
  assert.equal(quote(16).approvalRequired, true, 'one driver night, even with no overnight charge set');
});
