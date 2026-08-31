import test from 'node:test';
import assert from 'node:assert/strict';
import { isHighConfidenceEquipmentResult } from '../api/searchEquipment.js';

const validResult = {
  make: 'Caterpillar',
  model: '320D',
  serial_number: null,
  operating_weight_lbs: 45000,
  width_in: 102,
  height_in: 138,
  confidence: 'high',
};

test('accepts an exact, plausible, high-confidence make and model match', () => {
  assert.equal(isHighConfidenceEquipmentResult(validResult, 'CAT 320D'), true);
});

test('rejects medium-confidence AI equipment', () => {
  assert.equal(isHighConfidenceEquipmentResult({ ...validResult, confidence: 'medium' }, 'CAT 320D'), false);
});

test('rejects a high-confidence result whose model does not match the search', () => {
  assert.equal(isHighConfidenceEquipmentResult(validResult, 'John Deere 850J'), false);
});

test('rejects implausible specifications', () => {
  assert.equal(isHighConfidenceEquipmentResult({ ...validResult, operating_weight_lbs: 900000 }, 'CAT 320D'), false);
});

test('accepts an exact serial-number search', () => {
  assert.equal(isHighConfidenceEquipmentResult({ ...validResult, serial_number: 'ABC-123' }, 'ABC-123'), true);
});
