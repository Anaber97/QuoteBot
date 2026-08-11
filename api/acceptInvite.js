import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const token = String(body?.token || '').trim();
    const userId = String(body?.userId || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const fullName = String(body?.fullName || '').trim();

    if (!token || !userId || !email) {
      return res.status(400).json({ error: 'Invite token, user ID, and email are required.' });
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

    const { data, error } = await supabase.rpc('accept_company_invite', {
      p_token: token,
      p_user_id: userId,
      p_full_name: fullName,
    });

    if (error) {
      const message = String(error.message || '').toLowerCase();
      if (message.includes('invalid invitation token') || message.includes('no longer valid')) {
        return res.status(404).json({ error: 'This invite is no longer valid. Please request a new one.' });
      }
      if (message.includes('expired')) {
        return res.status(410).json({ error: 'This invite has expired. Please request a new one.' });
      }
      if (message.includes('does not match authenticated user')) {
        return res.status(403).json({ error: 'This invite belongs to a different email address.' });
      }
      throw error;
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(500).json({ error: 'Unable to complete invite acceptance.' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Invite acceptance failed:', error);
    return res.status(500).json({ error: error.message || 'Unable to accept invite.' });
  }
}