import test from 'node:test';
import assert from 'node:assert/strict';

import { priceEscortMiles, resolveEscortRequirement } from '../src/lib/pricingEngine.js';
import { routeMilesByState } from '../src/lib/routeStates.js';
import { evaluateOsow } from '../src/lib/osow.js';
import { calculateAuthoritativeQuote } from '../api/_quoteEngine.js';
import { validateConfigInput } from '../src/lib/configValidator.js';

test('each escort costs its per-mile rate over its required miles, never below the minimum', () => {
  assert.equal(priceEscortMiles([100], {}), null, 'no rate: the flat escort prices apply');
  assert.equal(priceEscortMiles([100], { perMile: '' }), null);
  assert.equal(priceEscortMiles([100], { perMile: 2 }), 200);
  assert.equal(priceEscortMiles([100], { perMile: 2, minimum: 300 }), 300);
  assert.equal(priceEscortMiles([100, 40], { perMile: 2, minimum: 150 }), 350, 'escort 2 runs fewer miles and hits its minimum');
  assert.equal(priceEscortMiles([100, 100], { perMile: 0, minimum: 500 }), 1000, 'a $0 rate with a minimum is a flat price per escort');
});

test('route miles are split by state and scaled to the road distance', () => {
  // Dallas, TX north to Oklahoma City, OK: the Red River crossing is about 40% of the way.
  const points = Array.from({ length: 21 }, (_, i) => ({ lat: 32.78 + (35.47 - 32.78) * i / 20, lng: -96.8 + (-97.52 + 96.8) * i / 20 }));
  const line = routeMilesByState(points);
  assert.deepEqual(Object.keys(line).sort(), ['OK', 'TX']);
  assert.ok(line.TX > 60 && line.OK > 60, JSON.stringify(line));
  const road = routeMilesByState(points, 210);
  assert.ok(Math.abs(road.TX + road.OK - 210) < 0.2, JSON.stringify(road));
  assert.ok(Math.abs(road.TX / road.OK - line.TX / line.OK) < 0.01, 'scaling keeps each state\'s share');
});

test('simple escort rules price every escort over the customer trip, not the deadhead', () => {
  const rules = [{ vehicleCount: 1, minWidth: 144 }, { vehicleCount: 2, minWidth: 168 }];
  const pricing = { perMile: 2, minimum: 300 };
  assert.deepEqual(resolveEscortRequirement({ width: 150, rules, miles: 200, pricing }), { vehicleCount: 1, surcharge: 400, triggeredBy: ['width'], miles: [200] });
  assert.equal(resolveEscortRequirement({ width: 150, rules, miles: 50, pricing }).surcharge, 300);
  assert.equal(resolveEscortRequirement({ width: 170, rules, miles: 200, pricing }).surcharge, 800);
  assert.deepEqual(resolveEscortRequirement({ width: 150, rules: [{ vehicleCount: 1, minWidth: 144, surcharge: 450 }], miles: 200 }),
    { vehicleCount: 1, surcharge: 450, triggeredBy: ['width'] }, 'no rate: the rule\'s flat surcharge');

  const mile = 1609.344;
  const quote = calculateAuthoritativeQuote({ role: 'client', clientConfig: null,
    config: { pricing: {}, geofences: { builtInZoneMode: 'opt_in', enabledZones: [], customZones: [] },
      client_portal: { escort_rules: rules, escort_pricing: pricing, weight_tiers: [{ minWeight: 0, maxWeight: 999999, rate: 100, rounding_interval: 1 }] } },
    input: { waypoints: ['A, TX', 'B, TX'], equipment: { weight: 30000, width: 150, height: 120 } },
    route: { totalMeters: 300 * mile, rawDriveMinutes: 60, customerRoutePoints: [],
      legs: [{ distanceMeters: 50 * mile }, { distanceMeters: 200 * mile }, { distanceMeters: 50 * mile }] } });
  assert.equal(quote.escort.surcharge, 400);
  assert.deepEqual(quote.escort.miles, [200]);
});

test('state rules charge each escort only for miles in states that need it', () => {
  const limits = [
    { state_code: 'TX', legal_width_in: 102, legal_height_in: 168, legal_weight_lbs: 80000, one_escort_width_in: 144, two_escort_width_in: 180, one_escort_height_in: 200, two_escort_height_in: 220 },
    { state_code: 'OK', legal_width_in: 102, legal_height_in: 168, legal_weight_lbs: 80000, one_escort_width_in: 120, two_escort_width_in: 168, one_escort_height_in: 200, two_escort_height_in: 220 },
  ];
  const load = { weight: 30000, width: 170, height: 100, tier: { permitCost: 100, averageClearanceIn: 0, averageVehicleWeightLbs: 0 },
    states: ['TX', 'OK'], limits, pricing: { generalPermit: 100, oneEscort: 300, twoEscort: 550 }, stateMiles: { TX: 100, OK: 50 } };
  const flat = evaluateOsow(load);
  assert.deepEqual(flat.escort, { vehicleCount: 2, surcharge: 550 }, 'no rate: the flat 2-escort price');
  const perMile = evaluateOsow({ ...load, escortPricing: { perMile: 2, minimum: 0 } });
  assert.deepEqual(perMile.escort, { vehicleCount: 2, surcharge: 400, miles: [150, 50] }, 'escort 1 runs TX and OK; escort 2 only OK');
  assert.equal(evaluateOsow({ ...load, escortPricing: { perMile: 2, minimum: 250 } }).escort.surcharge, 550);
  assert.equal(perMile.reviewReasons.some((reason) => reason.includes('escort price')), false);
});

test('escort pricing must be a non-negative amount', () => {
  const errors = (escort_pricing) => validateConfigInput({ client_portal: { escort_pricing } }).errors.map((error) => error.path);
  assert.deepEqual(errors({ perMile: 2.5, minimum: 350 }), []);
  assert.deepEqual(errors({ perMile: null, minimum: '' }), []);
  assert.deepEqual(errors({ perMile: -1 }), ['client_portal.escort_pricing.perMile']);
});
