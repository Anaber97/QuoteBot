import { assertSameRequest, fingerprint, newRequestId, requestId } from './_idempotency.js';
import { getServerEnv } from './_env.js';

export async function findEmailDelivery(admin, profile, req, intent) {
  const id = requestId(req) || newRequestId();
  const hash = fingerprint(intent);
  const { data, error } = await admin.from('email_deliveries').select('*')
    .eq('actor_id', profile.id).eq('request_id', id).maybeSingle();
  if (error) throw error;
  if (data) assertSameRequest(data, hash);
  return { id, hash, delivery: data };
}

export async function storeEmailDelivery(admin, profile, operation, quote, eventType, payload) {
  const { data, error } = await admin.from('email_deliveries').insert({
    request_id: operation.id, request_hash: operation.hash, actor_id: profile.id,
    company_id: profile.company_id, quote_id: quote.id, event_type: eventType, payload,
  }).select('*').single();
  if (error?.code === '23505') {
    const existing = await admin.from('email_deliveries').select('*')
      .eq('actor_id', profile.id).eq('request_id', operation.id).single();
    if (existing.error) throw existing.error;
    assertSameRequest(existing.data, operation.hash);
    return existing.data;
  }
  if (error) throw error;
  return data;
}

export async function sendEmailDelivery(admin, delivery) {
  if (delivery.status === 'sent') return;
  // Stop ambiguous retries before the provider's 24-hour deduplication window ends.
  if (Date.now() - new Date(delivery.created_at).getTime() > 23 * 60 * 60 * 1000) {
    throw Object.assign(new Error('This delivery needs review before sending again. Contact your workspace manager.'), { status: 409 });
  }
  const { data, error } = await admin.functions.invoke('send-quote-approval-email', {
    headers: { 'x-towcalc-server-key': getServerEnv('SUPABASE_SERVICE_ROLE_KEY') },
    body: { ...delivery.payload, idempotencyKey: `delivery-${delivery.id}` },
  });
  if (error) throw error;
  const completed = await admin.rpc('complete_email_delivery', { p_id: delivery.id, p_provider_message_id: data?.id || null });
  if (completed.error) throw completed.error;
}
