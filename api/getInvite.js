import { createAdminClient } from './_security.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const token = String(body?.token || '').trim();

    if (!token) {
      return res.status(400).json({ error: 'Invite token is required.' });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('company_invites')
      .select('id, email, role, company_id, full_name, status, expires_at, accepted_at')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'This invite is no longer valid. Please request a new one.' });
    }

    if (data.status !== 'pending') {
      return res.status(409).json({ error: 'This invite is no longer valid. Please request a new one.' });
    }

    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return res.status(410).json({ error: 'This invite has expired. Please request a new one.' });
    }

    return res.status(200).json({
      invite: {
        id: data.id,
        email: data.email,
        role: data.role,
        company_id: data.company_id,
        full_name: data.full_name,
      },
    });
  } catch (error) {
    console.error('Invite lookup failed:', error);
    return res.status(500).json({ error: error.message || 'Unable to load invite.' });
  }
}
