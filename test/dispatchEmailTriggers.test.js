import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('saving a quote never sends an automatic email', () => {
  const source = fs.readFileSync(new URL('../api/createQuote.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /functions\.invoke|sendStoredApprovalEmail|notifyApproval/);
});

test('dispatch email endpoint accepts only explicit share and dispatch actions', () => {
  const source = fs.readFileSync(new URL('../api/sendQuoteEmail.js', import.meta.url), 'utf8');
  assert.match(source, /\['share', 'action'\]\.includes\(action\)/);
  assert.doesNotMatch(source, /bol_attached/);
});
