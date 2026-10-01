import { createHash, randomUUID } from 'node:crypto';

export function requestId(req) {
  const supplied = req.headers?.['idempotency-key'];
  if (supplied == null) return null; // Compatibility for previously deployed clients.
  if (typeof supplied !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(supplied)) {
    throw Object.assign(new Error('A valid request identifier is required.'), { status: 400 });
  }
  return supplied.toLowerCase();
}

export const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const newRequestId = randomUUID;

export function assertSameRequest(existing, hash) {
  if (existing.request_hash !== hash) {
    throw Object.assign(new Error('This request identifier was already used for different content.'), { status: 409 });
  }
}
