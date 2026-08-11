// api/inviteUser.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse request body safely
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const email = String(body?.email || '').trim().toLowerCase();
    const clientOrigin = body?.origin || req.headers.origin;

    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Load Supabase Service Role credentials
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ 
        error: 'Missing Supabase service role environment variables on server.' 
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const role = body?.role || 'client';
    const companyId = body?.company_id || null;
    const inviteName = body?.name || '';
    const invitedBy = body?.invited_by || null;

    // Determine target domain (Live origin -> ENV fallback -> fallback domain)
    const baseUrl = clientOrigin || process.env.SITE_URL || 'https://your-production-domain.com';
    const inviteToken = crypto.randomUUID();
    const redirectUrl = `${baseUrl.replace(/\/$/, '')}/?invite=${inviteToken}${role ? `&role=${encodeURIComponent(role)}` : ''}`;

    // Send invitation email with production redirect link
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      console.error('Supabase Invite Error:', error);
      return res.status(500).json({ error: error.message });
    }

    try {
      await supabase.from('company_invites').insert([{
        token: inviteToken,
        email,
        company_id: companyId,
        role,
        full_name: inviteName,
        invited_by: invitedBy,
        status: 'pending',
        created_at: new Date().toISOString(),
      }]);
    } catch (inviteDbErr) {
      console.warn('Invite record write skipped:', inviteDbErr);
    }

    return res.status(200).json({ 
      success: true, 
      message: `Invitation successfully sent to ${email}`,
      data,
      inviteToken,
      redirectUrl,
    });

  } catch (err) {
    console.error('Unexpected server error in inviteUser API:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}