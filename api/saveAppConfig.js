import { requireUser, sendApiError } from './_security.js';
import { normalizeConfig } from '../src/lib/configSchema.js';
import { validateConfigInput, sanitizeConfig, checkRequestSize } from '../src/lib/configValidator.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check request size first to prevent DoS
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

    // Validate incoming config before processing
    const validation = validateConfigInput(incoming);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Config validation failed',
        details: validation.errors,
        warnings: validation.warnings,
      });
    }

    // Sanitize to remove unknown fields
    const sanitized = sanitizeConfig(incoming);

    const { admin } = await requireUser(req, { companyId, manager: true });

    // Use shared configSchema normalization
    const normalizedConfig = normalizeConfig(sanitized);
    const { pricing, surcharges, geofences, bases, users, client_portal } = normalizedConfig;

    const row = {
      company_id: companyId,

      // Legacy flat columns for backward compatibility
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

      // Current structured columns
      pricing,
      surcharges,
      geofences,
      bases,
      users,
      client_portal,

      // Legacy whole-config column for older builds
      config: normalizedConfig,

      updated_at: new Date().toISOString(),
    };

    const { data: savedRow, error: saveError } = await admin
      .from('app_config')
      .upsert(row, { onConflict: 'company_id' })
      .select('*')
      .single();

    if (saveError) {
      console.error('App config save failed:', saveError);
      return res.status(500).json({
        error: saveError.message || 'Failed to save app configuration.',
      });
    }

    return res.status(200).json({
      success: true,
      config: normalizedConfig,
      row: savedRow,
    });
  } catch (error) {
    console.error('Unexpected saveAppConfig error:', error);
    return sendApiError(res, error, 'Unable to save company configuration.');
  }
}
