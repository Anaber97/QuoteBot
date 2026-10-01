import { readStoredConfig } from '../shared/config/storage.js';
import { clientPortalConfig } from '../shared/config/clientPortal.js';
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
    const { admin, profile } = await requireUser(req, { companyId });

    const { data: configData, error: configError } = await admin
      .from('app_config')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (configError) {
      throw configError;
    }

    if (!configData) {
      return res.status(200).json({ success: true, config: null });
    }

    const mergedConfig = readStoredConfig(configData);

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ success: true, config: profile?.role === 'client' ? clientPortalConfig(mergedConfig) : mergedConfig });
  } catch (error) {
    console.error('Unexpected getAppConfig error:', error);
    return sendApiError(res, error, 'Unable to load company configuration.');
  }
}
