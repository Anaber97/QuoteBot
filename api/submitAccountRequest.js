import { createAdminClient, enforceRateLimit, sendApiError } from './_security.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const fullName = String(body.fullName || '').trim().slice(0, 120);
    const companyName = String(body.companyName || '').trim().slice(0, 160);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
    const phone = String(body.phone || '').trim().slice(0, 40);
    if (fullName.length < 2 || companyName.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Name, company, and a valid email address are required.' });
    }
    const admin = createAdminClient();
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwarded || String(req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown');
    await enforceRateLimit(admin, `account-request-ip:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
    await enforceRateLimit(admin, `account-request-email:${email}`, { limit: 2, windowMs: 24 * 60 * 60 * 1000 });
    const { error } = await admin.from('account_requests').insert({ full_name: fullName, company_name: companyName, email, phone });
    if (error?.code === '23505') return res.status(200).json({ success: true });
    if (error) throw error;
    return res.status(201).json({ success: true });
  } catch (error) {
    return sendApiError(res, error, 'Unable to submit account request.');
  }
}
