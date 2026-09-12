import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOsow } from '../src/lib/osow.js';
import { resolveRouteStates } from '../src/lib/routeStates.js';
import { normalizeConfig } from '../src/lib/configSchema.js';
import { sanitizeConfig, validateConfigInput } from '../src/lib/configValidator.js';
import { calculateAuthoritativeQuote } from '../api/_quoteEngine.js';

const limit = { state_code: 'TX', legal_width_in: 102, legal_height_in: 168, legal_weight_lbs: 80000,
  one_escort_width_in: 144, one_escort_height_in: 180, two_escort_width_in: 168, two_escort_height_in: 192 };
const base = { weight: 40000, width: 100, height: 120, tier: { averageClearanceIn: 48, averageVehicleWeightLbs: 40000 },
  limits: [limit], states: ['TX'], pricing: { generalPermit: 175, oneEscort: 300, twoEscort: 550 } };
test('legal equality is allowed; deck height and truck weight trigger OSOW above limits', () => {
  assert.equal(evaluateOsow(base).needsPermit, false);
  const result=evaluateOsow({ ...base, height: 121, weight: 40001 });
  assert.deepEqual(result.states[0].reasons, ['Overheight','Overweight']);
  assert.equal(result.grossWeight,80001); assert.equal(result.loadedHeight,169);
  assert.equal(result.permitFee,175);
});
test('escort equality triggers; charge highest tier once and each permit state once', () => {
  const result=evaluateOsow({...base,width:168,states:['TX','OK','TX'],limits:[limit,{...limit,state_code:'OK'}]});
  assert.equal(result.permitFee,350); assert.equal(result.escort.vehicleCount,2); assert.equal(result.escort.surcharge,550);
});
test('unknown thresholds, missing measurements, missing prices and missing states require review', () => {
  const result=evaluateOsow({...base,width:170,tier:{},limits:[{...limit,two_escort_height_in:null}],states:['TX','DC'],pricing:{}});
  assert.equal(result.reviewRequired,true); assert.equal(result.states[1].unknown,true);
  assert.ok(result.reviewReasons.some((r)=>r.includes('unspecified')));
  assert.ok(result.reviewReasons.some((r)=>r.includes('price')));
});
test('explicit zero price stays zero and special notes remain visible', () => {
  const result=evaluateOsow({...base,width:170,pricing:{generalPermit:0,oneEscort:0,twoEscort:0},limits:[{...limit,notes:'Police escort required'}]});
  assert.equal(result.permitFee,0); assert.equal(result.escort.surcharge,0);
  assert.ok(result.reviewReasons.includes('TX: Police escort required'));
});
test('Indiana workbook GVW exception triggers above 200,000 pounds',()=>{
  assert.equal(evaluateOsow({...base,weight:160001,states:['IN'],limits:[{...limit,state_code:'IN'}]}).escort.vehicleCount,2);
});
test('route segment detects intervening states with both endpoints outside',()=>{
  const states=resolveRouteStates([{lat:33.749,lng:-84.388},{lat:32.7767,lng:-96.797}]);
  for(const state of ['GA','AL','MS','LA','TX']) assert.ok(states.includes(state),state);
  assert.deepEqual(resolveRouteStates([]),[]);
});
test('same-state route does not add endpoint address abbreviations',()=>{
  assert.deepEqual(resolveRouteStates([{lat:32.7767,lng:-96.797},{lat:32.7555,lng:-97.3308}]),['TX']);
});
test('settings survive normalization and sanitation, with missing measurements kept null',()=>{
  const config=normalizeConfig({client_portal:{weight_tiers:[{minWeight:0,maxWeight:80000,rate:100,...base.tier}],osow_pricing:{enabled:true,...base.pricing}}});
  const roundtrip=normalizeConfig(sanitizeConfig(config));
  assert.equal(roundtrip.client_portal.weight_tiers[0].averageClearanceIn,48);
  assert.equal(roundtrip.client_portal.osow_pricing.twoEscort,550);
  assert.equal(normalizeConfig({client_portal:{weight_tiers:[{minWeight:0,maxWeight:1,rate:100}]}}).client_portal.weight_tiers[0].averageVehicleWeightLbs,null);
  roundtrip.client_portal.weight_tiers[0].averageClearanceIn=-1;
  assert.equal(validateConfigInput(roundtrip).valid,false);
});
test('authoritative quote loads company vehicle assumptions even with custom client rates',()=>{
  const config=normalizeConfig({client_portal:{weight_tiers:[{minWeight:0,maxWeight:999999,rate:100,...base.tier}],osow_pricing:{enabled:true,...base.pricing}}});
  config.state_transport_limits=[limit];
  const result=calculateAuthoritativeQuote({config,role:'client',clientConfig:{pricing:{use_custom_pricing:true,weight_tiers:[{minWeight:0,maxWeight:999999,rate:200}]}},
    input:{quoteSource:'client_portal',equipment:{weight:40000,attachmentWeight:1,width:100,height:120},waypoints:['Pickup','Dropoff']},
    route:{totalMeters:1000,rawDriveMinutes:30,customerRoutePoints:[{lat:32.7767,lng:-96.797},{lat:32.7555,lng:-97.3308}],legs:[]}});
  assert.equal(result.osow.grossWeight,80001); assert.equal(result.permit.permitFee,175);
  assert.equal(result.quoteDetails.osow.grossWeight,80001);
});
