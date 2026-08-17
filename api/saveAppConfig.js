import { requireUser, sendApiError } from './_security.js';

const finiteNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const companyId = String(body?.company_id || '').trim();
    const incoming = body?.config || null;

    if (!companyId || !incoming) {
      return res.status(400).json({ error: 'company_id and config are required.' });
    }
    const { admin } = await requireUser(req, { companyId, manager: true });

    // Always save one canonical object. The JSON columns receive the
    // structured sections, while the old flat columns receive the core
    // pricing values so older code/data remain compatible.
    const pricing = {
      ...(incoming.pricing || {}),
      hourly_min: finiteNumber(incoming.pricing?.hourly_min ?? incoming.hourly_min, 125),
      hourly_max: finiteNumber(incoming.pricing?.hourly_max ?? incoming.hourly_max, 135),
      rounding_interval: finiteNumber(
        incoming.pricing?.rounding_interval ?? incoming.rounding_interval,
        25
      ),
      drive_time_buffer: finiteNumber(
        incoming.pricing?.drive_time_buffer ?? incoming.drive_time_buffer,
        10
      ),
      load_unload_base_mins: finiteNumber(
        incoming.pricing?.load_unload_base_mins ?? incoming.load_unload_base_mins,
        30
      ),
      extra_stop_mins: finiteNumber(
        incoming.pricing?.extra_stop_mins ?? incoming.extra_stop_mins,
        15
      ),
      after_hours_multiplier: finiteNumber(
        incoming.pricing?.after_hours_multiplier ?? incoming.after_hours_multiplier,
        25
      ),
      road_club_multiplier: finiteNumber(
        incoming.pricing?.road_club_multiplier ?? incoming.road_club_multiplier,
        15
      ),
      metro_multiplier: finiteNumber(
        incoming.pricing?.metro_multiplier ?? incoming.metro_multiplier,
        28.57
      ),
      hazard_multiplier: finiteNumber(
        incoming.pricing?.hazard_multiplier ?? incoming.hazard_multiplier,
        40
      ),
      custom_truck_classes: asArray(incoming.pricing?.custom_truck_classes),
      custom_surcharges: asArray(incoming.pricing?.custom_surcharges),
    };

    const surcharges = {
      ...(incoming.surcharges || {}),
      custom_surcharges: pricing.custom_surcharges,
    };

    const geofences = {
      disabledZones: asArray(incoming.geofences?.disabledZones),
      customZoneRates: incoming.geofences?.customZoneRates || {},
      customZones: asArray(incoming.geofences?.customZones),
    };

    const bases = asArray(incoming.bases);
    const users = asArray(incoming.users);
    const clientPortal = {
      ...(incoming.client_portal || {}),
      weight_tiers: asArray(incoming.client_portal?.weight_tiers),
      clients: asArray(incoming.client_portal?.clients),
    };

    const canonicalConfig = {
      ...incoming,
      company_id: companyId,
      pricing,
      surcharges,
      geofences,
      bases,
      users,
      client_portal: clientPortal,
    };

    const row = {
      company_id: companyId,

      // Legacy flat columns.
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

      // Current structured columns.
      pricing,
      surcharges,
      geofences,
      bases,
      users,
      client_portal: clientPortal,

      // Legacy whole-config column. Keeping this populated means an older
      // build can still read the same saved settings.
      config: canonicalConfig,

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
      config: canonicalConfig,
      row: savedRow,
    });
  } catch (error) {
    console.error('Unexpected saveAppConfig error:', error);
    return sendApiError(res, error, 'Unable to save company configuration.');
  }
}
