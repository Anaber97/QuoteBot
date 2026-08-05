// api/inviteUser.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse body safely
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const email = body?.email;

  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Missing Supabase service role environment variables on server.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);

  if (error) {
    console.error('Supabase Invite Error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, data });
}