import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveVerificationStatus, matchesEquipmentSearch, normalizeSourcedResults } from '../api/searchEquipment.js';

const source = (overrides = {}) => ({
  url: 'https://example.com/spec', operating_weight_lbs: 45000, width_in: 102, height_in: 138, ...overrides,
});

test('manufacturer evidence is Verified', () => {
  assert.equal(deriveVerificationStatus([source({ is_manufacturer: true })]), 'Verified');
});

test('two agreeing independent sources are Corroborated', () => {
  assert.equal(deriveVerificationStatus([source(), source({ url: 'https://other.example/spec', operating_weight_lbs: 45100 })]), 'Corroborated');
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

test('rejects evidence URLs not returned by web search citations', () => {
  const result = normalizeSourcedResults({
    citations: ['https://trusted.example/spec'],
    choices: [{ message: { content: JSON.stringify({ results: [{ make: 'CAT', model: '320D', operating_weight_lbs: 45000, width_in: 102, height_in: 138, evidence: [source()] }] }) } }],
  }, 'CAT 320D')[0];
  assert.equal(result.verification_status, 'Unverified');
  assert.deepEqual(result.sources, []);
});
