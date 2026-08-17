import { requireUser, sendApiError } from './_security.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const companyId = String(req.query?.company_id || '').trim();
    if (!companyId) {
      return res.status(400).json({ error: 'company_id is required.' });
    }
    const { admin } = await requireUser(req, { companyId });

    const { data: configData, error: configError } = await admin
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
    return sendApiError(res, error, 'Unable to load company configuration.');
  }
}
