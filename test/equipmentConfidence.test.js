import test from 'node:test';
import assert from 'node:assert/strict';
import { deFuzzEquipmentQuery, deriveVerificationStatus, matchesEquipmentSearch, normalizeSourcedResults } from '../api/searchEquipment.js';

const source = (overrides = {}) => ({
  url: 'https://example.com/spec', operating_weight_lbs: 45000, width_in: 102, height_in: 138, ...overrides,
});

test('manufacturer evidence is Verified', () => {
  assert.equal(deriveVerificationStatus([source({ is_manufacturer: true })]), 'Verified');
});

test('two agreeing non-manufacturer sources are Unverified', () => {
  assert.equal(deriveVerificationStatus([source(), source({ url: 'https://other.example/spec', operating_weight_lbs: 45100 })]), 'Unverified');
});

test('uses higher close-source specs to keep unverified estimates permit-conservative', () => {
  const result = normalizeSourcedResults({
    citations: ['https://first.example/spec', 'https://second.example/spec'],
    choices: [{ message: { content: JSON.stringify({ results: [{ make: 'CAT', model: '320D', operating_weight_lbs: 45000, width_in: 102, height_in: 138, evidence: [
      source({ url: 'https://first.example/spec' }),
      source({ url: 'https://second.example/spec', operating_weight_lbs: 46100, width_in: 104, height_in: 140 }),
    ] }] }) } }],
  }, 'CAT 320D')[0];
  assert.equal(result.verification_status, 'Unverified');
  assert.equal(result.operating_weight_lbs, 46100);
  assert.equal(result.width_in, 104);
  assert.equal(result.height_in, 140);
});

test('disagreeing complete sources are Conflict', () => {
  assert.equal(deriveVerificationStatus([source(), source({ url: 'https://other.example/spec', operating_weight_lbs: 52000 })]), 'Conflict');
});

test('one non-manufacturer source is Unverified', () => {
  assert.equal(deriveVerificationStatus([source()]), 'Unverified');
});

test('matches a combined make and model search', () => {
  assert.equal(matchesEquipmentSearch({ make: 'Hyundai', model: '50D-9' }, 'Hyundai 50D-9'), true);
});

test('de-fuzzes aliases, compact model text, and model years', () => {
  assert.equal(deFuzzEquipmentQuery('2021 CAT320'), 'caterpillar 320');
  assert.equal(matchesEquipmentSearch({ make: 'Caterpillar', model: '320D' }, '2021 CAT 320'), true);
  assert.equal(matchesEquipmentSearch({ make: 'Lee Boy', model: 'G700B' }, 'Leeboy G700B'), true);
});

test('accepts transport dimension fields from web results', () => {
  const result = normalizeSourcedResults({
    citations: ['https://manufacturer.example/spec'],
    choices: [{ message: { content: JSON.stringify({ results: [{ make: 'CAT', model: '320D', operating_weight_lbs: 45000, transport_width_in: 102, transport_height_in: 138, evidence: [source({ url: 'https://manufacturer.example/spec', is_manufacturer: true, transport_width_in: 102, transport_height_in: 138 })] }] }) } }],
  }, 'CAT 320D')[0];
  assert.equal(result.transport_width_in, 102);
  assert.equal(result.transport_height_in, 138);
  assert.equal(result.verification_status, 'Verified');
});

test('accepts a clean citation for the same grounded URL with tracking parameters', () => {
  const result = normalizeSourcedResults({
    citations: ['https://manufacturer.example/spec?utm_source=google'],
    choices: [{ message: { content: JSON.stringify({ results: [{ make: 'CAT', model: '320D', evidence: [source({ url: 'https://manufacturer.example/spec', is_manufacturer: true })] }] }) } }],
  }, 'CAT 320D')[0];
  assert.equal(result.verification_status, 'Verified');
});

test('rejects URL-only manufacturer citations without field-level evidence', () => {
  const result = normalizeSourcedResults({
    citations: ['https://manufacturer.example/spec'],
    choices: [{ message: { content: JSON.stringify({ results: [{ make: 'CAT', model: '320D', operating_weight_lbs: 45000, transport_width_in: 102, transport_height_in: 138, evidence: [{ url: 'https://manufacturer.example/spec', is_manufacturer: true }] }] }) } }],
  }, 'CAT 320D')[0];
  assert.equal(result, undefined);
});

test('combines manufacturer documents only when each contributes field-level evidence', () => {
  const result = normalizeSourcedResults({
    citations: ['https://manufacturer.example/brochure', 'https://manufacturer.example/manual'],
    choices: [{ message: { content: JSON.stringify({ results: [{ make: 'CAT', model: '320D', evidence: [
      source({ url: 'https://manufacturer.example/brochure', is_manufacturer: true, operating_weight_lbs: 45000, width_in: null, height_in: null }),
      source({ url: 'https://manufacturer.example/manual', is_manufacturer: true, operating_weight_lbs: null, width_in: 102, height_in: 138 }),
    ] }] }) } }],
  }, 'CAT 320D')[0];
  assert.equal(result.verification_status, 'Verified');
  assert.equal(result.operating_weight_lbs, 45000);
  assert.equal(result.width_in, 102);
  assert.equal(result.height_in, 138);
});

test('accepts a complete direct manufacturer PDF when the gateway omits citations', () => {
  const result = normalizeSourcedResults({ results: [{
    make: 'Yanmar', model: 'TL100VS', operating_weight_lbs: 10555, transport_width_in: 78, transport_height_in: 84.5,
    evidence: [source({
      url: 'https://yanmarce.com/specs/tl100vs.pdf', publisher: 'Yanmar Compact Equipment', is_manufacturer: true,
      operating_weight_lbs: 10555, transport_width_in: 78, transport_height_in: 84.5,
    })],
  }] }, 'Yanmar TL100');
  assert.equal(result[0].verification_status, 'Verified');
  assert.equal(result[0].transport_height_in, 84.5);
});

test('rejects model evidence URLs that were not returned by the search provider', () => {
  const results = normalizeSourcedResults({
    citations: ['https://trusted.example/spec', 'https://second.example/spec'],
    choices: [{ message: { content: JSON.stringify({ results: [{ make: 'CAT', model: '320D', operating_weight_lbs: 45000, width_in: 102, height_in: 138, evidence: [source()] }] }) } }],
  }, 'CAT 320D');
  assert.equal(results.length, 0);
});

test('parses Sonar JSON followed by inline citation markers', () => {
  const result = normalizeSourcedResults({
    citations: ['https://manufacturer.example/spec'],
    choices: [{ message: { content: '{"results":[{"make":"CAT","model":"320D","evidence":[{"url":"https://manufacturer.example/spec","is_manufacturer":true,"operating_weight_lbs":45000,"transport_width_in":102,"transport_height_in":138}]}]}\n[1]' } }],
  }, 'CAT 320D')[0];
  assert.equal(result.verification_status, 'Verified');
  assert.equal(result.width_in, 102);
});
