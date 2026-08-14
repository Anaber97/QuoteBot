import { createClient } from '@supabase/supabase-js';

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

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: 'Missing Supabase service role environment variables on server.' });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

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