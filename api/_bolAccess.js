import crypto from 'node:crypto';
import { getServerEnv } from './_env.js';

function secret() {
  const value = getServerEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!value) throw new Error('Missing server-side BOL signing key.');
  return value;
}

function payload(quoteId, expiresAt) {
  return `${String(quoteId || '').trim()}.${Number(expiresAt)}`;
}

export function signBolAccess(quoteId, expiresAt) {
  return crypto.createHmac('sha256', secret()).update(payload(quoteId, expiresAt)).digest('hex');
}

export function verifyBolAccess(quoteId, expiresAt, signature) {
  const expiration = Number(expiresAt);
  if (!quoteId || !Number.isFinite(expiration) || expiration <= Math.floor(Date.now() / 1000)) return false;
  const expected = signBolAccess(quoteId, expiration);
  const received = String(signature || '');
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
