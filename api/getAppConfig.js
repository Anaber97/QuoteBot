import { createClient } from '@supabase/supabase-js';
import { getServerEnv } from './_env.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const companyId = String(req.query?.company_id || '').trim();
    const userId = String(req.query?.user_id || '').trim();

    if (!companyId || !userId) {
      return res.status(400).json({ error: 'company_id and user_id are required.' });
    }

    const supabaseUrl = getServerEnv('VITE_SUPABASE_URL') || getServerEnv('SUPABASE_URL');
    const serviceRoleKey = getServerEnv('VITE_SUPABASE_SERVICE_ROLE_KEY') || getServerEnv('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: 'Missing Supabase service role environment variables on server.' });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, company_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile || profile.company_id !== companyId) {
      return res.status(403).json({ error: 'User is not authorized to read this company configuration.' });
    }

    const { data: configData, error: configError } = await supabase
      .from('app_config')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (configError) {
      console.error('App config fetch failed:', configError);
      return res.status(500).json({ error: configError.message || 'Failed to fetch app configuration.' });
    }

    if (!configData) {
      return res.status(200).json({ success: true, config: null });
    }

    // Prefer the newest structured columns, but fall back to the legacy
    // whole-config JSON column when a row was created by an older build.
    const legacy = configData.config && typeof configData.config === 'object'
      ? configData.config
      : {};

    const mergedConfig = {
      ...legacy,
      ...configData,
      pricing: {
        ...(legacy.pricing || {}),
        ...(configData.pricing || {}),
      },
      surcharges: {
        ...(legacy.surcharges || {}),
        ...(configData.surcharges || {}),
      },
      geofences: {
        ...(legacy.geofences || {}),
        ...(configData.geofences || {}),
      },
      client_portal: {
        ...(legacy.client_portal || {}),
        ...(configData.client_portal || {}),
      },
    };

    return res.status(200).json({ success: true, config: mergedConfig });
  } catch (error) {
    console.error('Unexpected getAppConfig error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
}