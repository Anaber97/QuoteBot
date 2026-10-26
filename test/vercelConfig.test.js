import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const rewrite = new RegExp(`^${config.rewrites[0].source.replace('/(', '/(?:')}$`);
const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]));

test('client-side routes load the app on a direct visit', () => {
  for (const path of ['/privacy', '/terms', '/', '/settings/pricing']) assert.match(path, rewrite, path);
});

test('API routes and static files are never rewritten to the app shell', () => {
  for (const path of ['/api/createQuote', '/api/ops', '/assets/index-abc123.js', '/manifest.webmanifest', '/sw.js']) {
    assert.doesNotMatch(path, rewrite, path);
  }
});

test('every response carries the baseline security headers', () => {
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.match(headers['Strict-Transport-Security'], /max-age=\d{8}/);
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.match(headers['Content-Security-Policy'], /connect-src [^;]*https:\/\/\*\.supabase\.co/);
});
