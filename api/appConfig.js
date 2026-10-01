import { readStoredConfig } from '../shared/config/storage.js';
import { clientPortalConfig } from '../shared/config/clientPortal.js';
import { requireUser, sendApiError } from './_security.js';
import { normalizeConfig } from '../src/lib/configSchema.js';
import { validateConfigInput, sanitizeConfig, checkRequestSize } from '../src/lib/configValidator.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
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
    console.error('Unexpected appConfig GET error:', error);
    return sendApiError(res, error, 'Unable to load company configuration.');
  }
}

async function handlePost(req, res) {
  try {
    const sizeCheck = checkRequestSize(req);
    if (!sizeCheck.valid) {
      return res.status(413).json({ error: sizeCheck.error });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const companyId = String(body?.company_id || '').trim();
    const incoming = body?.config || null;

    if (!companyId || !incoming) {
      return res.status(400).json({ error: 'company_id and config are required.' });
    }

    const validation = validateConfigInput(incoming);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Config validation failed',
        details: validation.errors,
        warnings: validation.warnings,
      });
    }

    const sanitized = sanitizeConfig(incoming);
    const { admin } = await requireUser(req, { companyId, manager: true });
    const normalizedConfig = normalizeConfig(sanitized);
    const { pricing, surcharges, geofences, bases, users, client_portal } = normalizedConfig;

    const row = {
      company_id: companyId,
      pricing_mode: pricing.pricing_mode,
      hourly_rate: pricing.hourly_rate,
      mileage_rate: pricing.mileage_rate,
      hourly_min: pricing.hourly_min,
      hourly_max: pricing.hourly_max,
      rounding_interval: pricing.rounding_interval,
      drive_time_buffer: pricing.drive_time_buffer,
      load_unload_base_mins: pricing.load_unload_base_mins,
      extra_stop_mins: pricing.extra_stop_mins,
      after_hours_multiplier: pricing.after_hours_multiplier,
      road_club_multiplier: pricing.road_club_multiplier,
      metro_multiplier: pricing.metro_multiplier,
      hazard_multiplier: pricing.hazard_multiplier,
      pricing,
      surcharges,
      geofences,
      bases,
      users,
      client_portal,
      config: normalizedConfig,
      updated_at: new Date().toISOString(),
    };

    const { data: savedRow, error: saveError } = await admin
      .from('app_config')
      .upsert(row, { onConflict: 'company_id' })
      .select('*')
      .single();

    if (saveError) throw saveError;

    const persistedConfig = normalizeConfig(savedRow);
    const requestedTiers = normalizedConfig.client_portal.weight_tiers;
    const persistedTiers = persistedConfig.client_portal.weight_tiers;
    const requestedEscortRules = normalizedConfig.client_portal.escort_rules;
    const persistedEscortRules = persistedConfig.client_portal.escort_rules;
    if (JSON.stringify(persistedTiers) !== JSON.stringify(requestedTiers)
      || JSON.stringify(persistedEscortRules) !== JSON.stringify(requestedEscortRules)) {
      console.error('Equipment pricing persistence verification failed', { companyId });
      return res.status(500).json({ error: 'Equipment pricing did not persist exactly. Please try saving again.' });
    }

    return res.status(200).json({
      success: true,
      config: persistedConfig,
      row: savedRow,
    });
  } catch (error) {
    console.error('Unexpected appConfig POST error:', error);
    return sendApiError(res, error, 'Unable to save company configuration.');
  }
}