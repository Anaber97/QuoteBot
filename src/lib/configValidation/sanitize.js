// src/lib/configValidation/sanitize.js
/**
 * Removes unknown/unwanted fields from config, keeping only recognized ones
 * (prevents arbitrary data pollution of persisted config), and truncates
 * arrays at their configured maximums.
 */
import { LIMITS } from './shared.js';

const sanitizePricing = (pricing) => {
  if (!pricing || typeof pricing !== 'object') return {};

  return {
    pricing_mode: pricing.pricing_mode,
    hourly_min: pricing.hourly_min,
    hourly_max: pricing.hourly_max,
    mileage_min: pricing.mileage_min,
    mileage_max: pricing.mileage_max,
    rounding_interval: pricing.rounding_interval,
    drive_time_buffer: pricing.drive_time_buffer,
    load_unload_base_mins: pricing.load_unload_base_mins,
    extra_stop_mins: pricing.extra_stop_mins,
    after_hours_multiplier: pricing.after_hours_multiplier,
    road_club_multiplier: pricing.road_club_multiplier,
    metro_multiplier: pricing.metro_multiplier,
    hazard_multiplier: pricing.hazard_multiplier,
    base_permit_fee: pricing.base_permit_fee,
    heavy_hourly_min: pricing.heavy_hourly_min,
    heavy_hourly_max: pricing.heavy_hourly_max,
    custom_truck_classes: Array.isArray(pricing.custom_truck_classes) ? pricing.custom_truck_classes.slice(0, LIMITS.MAX_TRUCK_CLASSES) : [],
    custom_surcharges: Array.isArray(pricing.custom_surcharges) ? pricing.custom_surcharges.slice(0, LIMITS.MAX_CUSTOM_SURCHARGES) : [],
  };
};

const sanitizeSurcharges = (surcharges) => {
  if (!surcharges || typeof surcharges !== 'object') return {};

  return {
    custom_surcharges: Array.isArray(surcharges.custom_surcharges) ? surcharges.custom_surcharges.slice(0, LIMITS.MAX_CUSTOM_SURCHARGES) : [],
  };
};

const sanitizeGeofences = (geofences) => {
  if (!geofences || typeof geofences !== 'object') return {};

  return {
    disabledZones: Array.isArray(geofences.disabledZones) ? geofences.disabledZones.slice(0, LIMITS.MAX_ARRAY_LENGTH) : [],
    customZoneRates: geofences.customZoneRates && typeof geofences.customZoneRates === 'object' ? geofences.customZoneRates : {},
    customZones: Array.isArray(geofences.customZones) ? geofences.customZones.slice(0, LIMITS.MAX_CUSTOM_ZONES) : [],
  };
};

const sanitizeClientPortal = (portal) => {
  if (!portal || typeof portal !== 'object') return {};

  return {
    contact_phone: portal.contact_phone,
    contact_email: portal.contact_email,
    send_jobs_to_contact_email: portal.send_jobs_to_contact_email,
    dispatch_email: portal.dispatch_email,
    approval_threshold: portal.approval_threshold,
    rounding_interval: portal.rounding_interval,
    use_custom_pricing: portal.use_custom_pricing,
    disclosure: portal.disclosure,
    weight_tiers: Array.isArray(portal.weight_tiers) ? portal.weight_tiers.slice(0, LIMITS.MAX_WEIGHT_TIERS) : [],
    clients: Array.isArray(portal.clients) ? portal.clients.slice(0, LIMITS.MAX_CLIENTS) : [],
  };
};

export function sanitizeConfig(config) {
  if (!config || typeof config !== 'object') return {};

  return {
    company_id: config.company_id,
    pricing: sanitizePricing(config.pricing),
    surcharges: sanitizeSurcharges(config.surcharges),
    geofences: sanitizeGeofences(config.geofences),
    bases: Array.isArray(config.bases) ? config.bases.slice(0, LIMITS.MAX_BASES) : [],
    users: Array.isArray(config.users) ? config.users.slice(0, LIMITS.MAX_USERS) : [],
    client_portal: sanitizeClientPortal(config.client_portal),
  };
}
