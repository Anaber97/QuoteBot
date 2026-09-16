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

test('keeps URL-only manufacturer citations when the result includes complete specs', () => {
  const result = normalizeSourcedResults({
    citations: ['https://manufacturer.example/spec'],
    choices: [{ message: { content: JSON.stringify({ results: [{ make: 'CAT', model: '320D', operating_weight_lbs: 45000, transport_width_in: 102, transport_height_in: 138, evidence: [{ url: 'https://manufacturer.example/spec', is_manufacturer: true }] }] }) } }],
  }, 'CAT 320D')[0];
  assert.equal(result.verification_status, 'Verified');
  assert.equal(result.operating_weight_lbs, 45000);
});

test('uses provider-returned citations when the model evidence URL does not match', () => {
  const results = normalizeSourcedResults({
    citations: ['https://trusted.example/spec', 'https://second.example/spec'],
    choices: [{ message: { content: JSON.stringify({ results: [{ make: 'CAT', model: '320D', operating_weight_lbs: 45000, width_in: 102, height_in: 138, evidence: [source()] }] }) } }],
  }, 'CAT 320D');
  assert.equal(results[0].sources[0].url, 'https://trusted.example/spec');
  assert.equal(results[0].verification_status, 'Unverified');
});

test('parses Sonar JSON followed by inline citation markers', () => {
  const result = normalizeSourcedResults({
    citations: ['https://manufacturer.example/spec'],
    choices: [{ message: { content: '{"results":[{"make":"CAT","model":"320D","operating_weight_lbs":45000,"transport_width_in":102,"transport_height_in":138,"evidence":[{"url":"https://manufacturer.example/spec","is_manufacturer":true}]}]}\n[1]' } }],
  }, 'CAT 320D')[0];
  assert.equal(result.verification_status, 'Verified');
  assert.equal(result.width_in, 102);
});
