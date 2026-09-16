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

test('rejects evidence URLs not returned by web search citations', () => {
  const results = normalizeSourcedResults({
    citations: ['https://trusted.example/spec'],
    choices: [{ message: { content: JSON.stringify({ results: [{ make: 'CAT', model: '320D', operating_weight_lbs: 45000, width_in: 102, height_in: 138, evidence: [source()] }] }) } }],
  }, 'CAT 320D');
  assert.deepEqual(results, []);
});
