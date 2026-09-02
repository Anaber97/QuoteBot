// src/lib/configSchema.js
/**
 * CANONICAL CONFIG SCHEMA
 *
 * This is the single source of truth for the entire application configuration.
 * All other modules import and use these defaults, normalization, and validation functions.
 * This eliminates duplication and prevents configuration drift across:
 * - Settings.jsx (browser settings UI)
 * - App.jsx (state management)
 * - saveAppConfig.js (server persistence)
 * - quoteCalculator.js (browser pricing)
 * - _quoteEngine.js (server pricing)
 */

import { RATES } from '../config/rates.js';

// ===== NORMALIZATION UTILITIES =====

/**
 * Normalizes drive time buffer from various input formats.
 * Accepts: percentage (10), decimal (1.1), or fallback value
 */
export const normalizeDriveTimeBuffer = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 10;
  if (num > 1.5) return num; // Already a percentage, return as-is
  if (num > 0) return (num - 1) * 100; // Convert decimal (1.1) to percentage (10)
  return 10;
};

/**
 * Ensures a value is a finite number with fallback.
 */
const toFinite = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

/**
 * Ensures a value is an array.
 */
const asArray = (value) => (Array.isArray(value) ? value : []);

// ===== CANONICAL DEFAULTS =====

export const DEFAULT_PRICING = {
  pricing_mode: 'hourly',
  hourly_rate: RATES?.HOURLY_MIN || 125,
  mileage_rate: 5,
  hourly_min: RATES?.HOURLY_MIN || 125,
  hourly_max: RATES?.HOURLY_MIN || 125,
  mileage_min: 5,
  mileage_max: 5,
  rounding_interval: RATES?.ROUNDING_INTERVAL || 25,
  drive_time_buffer: (RATES?.DRIVE_TIME_BUFFER - 1) * 100 || 10,
  after_hours_multiplier: (RATES?.AFTER_HOURS_MULTIPLIER - 1) * 100 || 25,
  road_club_multiplier: (RATES?.ROAD_CLUB_MULTIPLIER - 1) * 100 || 15,
  metro_multiplier: 28.57,
  hazard_multiplier: 40,
  base_permit_fee: 150,
  load_unload_base_mins: RATES?.LOAD_UNLOAD_BASE_MINS || 30,
  extra_stop_mins: RATES?.EXTRA_STOP_MINS || 15,
  mileage_min_rate: 5,
  mileage_max_rate: 5,
  heavy_hourly_min: 200,
  heavy_hourly_max: 200,
  surchargeModes: {
    after_hours_multiplier: 'percent',
    road_club_multiplier: 'percent',
    metro_multiplier: 'percent',
    hazard_multiplier: 'percent',
  },
  custom_truck_classes: [
    { id: '1', name: 'Standard Tow / Flatbed', minRate: RATES?.HOURLY_MIN || 125, maxRate: RATES?.HOURLY_MIN || 125, minMileageRate: 5, maxMileageRate: 5, drive_time_buffer: 10, load_unload_base_mins: 30 },
    { id: '2', name: 'Medium Duty Flatbed', minRate: 150, maxRate: 150, minMileageRate: 6, maxMileageRate: 6, drive_time_buffer: 10, load_unload_base_mins: 30 },
    { id: '3', name: 'Heavy Duty Towing', minRate: 200, maxRate: 200, minMileageRate: 8, maxMileageRate: 8, drive_time_buffer: 15, load_unload_base_mins: 45 },
    { id: '4', name: 'Rotator / Heavy Recovery', minRate: 350, maxRate: 350, minMileageRate: 12, maxMileageRate: 12, drive_time_buffer: 15, load_unload_base_mins: 60 },
  ],
  custom_surcharges: [
    { id: 'after-hours', name: 'After Hours', feeType: 'percent', value: 25, active: true },
    { id: 'road-club', name: 'Road Club', feeType: 'percent', value: 15, active: true },
    { id: '1', name: 'Winch Out / Off-Road', feeType: 'flat', value: 75, active: true },
    { id: '2', name: 'Bad Weather / Ice', feeType: 'percent', value: 20, active: false },
  ],
};

export const DEFAULT_SURCHARGES = {
  custom_surcharges: DEFAULT_PRICING.custom_surcharges,
};

export const DEFAULT_GEOFENCES = {
  disabledZones: [],
  customZoneRates: {},
  customZones: [],
};

export const DEFAULT_CLIENT_PORTAL = {
  contact_phone: '(555) 555-0199',
  contact_email: 'quotes@yourcompany.com',
  send_jobs_to_contact_email: true,
  dispatch_email: '',
  approval_threshold: 80001,
  rounding_interval: 25,
  use_custom_pricing: false,
  disclosure:
    'These quotes are electronically generated estimates based on the information provided and may be affected by route conditions, permit requirements, or equipment-specific variables. Please confirm final pricing with a company representative before dispatch.',
  weight_tiers: [
    { id: 'tier-1', label: '0–20,000 lbs', minWeight: 0, maxWeight: 20000, rate: 150, hourlyRate: 150, mileageRate: 5, drive_time_buffer: 10, load_unload_base_mins: 30, rounding_interval: 25 },
    { id: 'tier-2', label: '20,001–40,000 lbs', minWeight: 20001, maxWeight: 40000, rate: 180, hourlyRate: 180, mileageRate: 6, drive_time_buffer: 10, load_unload_base_mins: 30, rounding_interval: 25 },
    { id: 'tier-3', label: '40,001–60,000 lbs', minWeight: 40001, maxWeight: 60000, rate: 200, hourlyRate: 200, mileageRate: 8, drive_time_buffer: 10, load_unload_base_mins: 30, rounding_interval: 25 },
    { id: 'tier-4', label: '60,001–80,000 lbs', minWeight: 60001, maxWeight: 80000, rate: 225, hourlyRate: 225, mileageRate: 10, drive_time_buffer: 10, load_unload_base_mins: 30, rounding_interval: 25 },
    { id: 'tier-5', label: '80,001+ lbs', minWeight: 80001, maxWeight: 999999, rate: 250, hourlyRate: 250, mileageRate: 12, drive_time_buffer: 10, load_unload_base_mins: 30, rounding_interval: 25 },
  ],
  clients: [],
};

export const DEFAULT_CONFIG = {
  company_id: '00000000-0000-0000-0000-000000000000',
  pricing: DEFAULT_PRICING,
  surcharges: DEFAULT_SURCHARGES,
  geofences: DEFAULT_GEOFENCES,
  bases: [],
  users: [],
  client_portal: DEFAULT_CLIENT_PORTAL,
};

// ===== NORMALIZATION FUNCTIONS =====

export const ROUNDING_OPTIONS = [1, 5, 10, 25, 50];

/**
 * Normalizes a client portal tier with all required fields and defaults.
 */
export const normalizeClientPortalTier = (tier = {}, index = 0) => {
  const hourlyRate = toFinite(tier.hourlyRate ?? tier.rate ?? tier.hourly_rate, 0);
  return {
    id: tier.id || `tier-${index + 1}`,
    label: tier.label || `Tier ${index + 1}`,
    minWeight: toFinite(tier.minWeight ?? tier.min, 0),
    maxWeight: toFinite(tier.maxWeight ?? tier.max, 999999),
    rate: hourlyRate,
    hourlyRate,
    mileageRate: toFinite(tier.mileageRate ?? tier.mileage_rate, 5),
    rounding_interval: ROUNDING_OPTIONS.includes(Number(tier.rounding_interval)) ? Number(tier.rounding_interval) : 25,
    drive_time_buffer: toFinite(tier.drive_time_buffer, 10),
    load_unload_base_mins: toFinite(tier.load_unload_base_mins, 30),
  };
};

/**
 * Normalizes a custom surcharge with all required fields and defaults.
 */
export const normalizeCustomSurcharge = (surcharge = {}, index = 0) => ({
  id: surcharge.id || `surcharge-${index + 1}`,
  name: surcharge.name || `Custom Surcharge ${index + 1}`,
  feeType: surcharge.feeType || 'flat',
  value: toFinite(surcharge.value, 0),
  active: surcharge.active !== false,
});

/**
 * Normalizes a custom truck class with all required fields and defaults.
 */
export const normalizeCustomTruckClass = (truckClass = {}, index = 0) => {
  const hourlyRate = toFinite(truckClass.hourlyRate ?? truckClass.rate ?? truckClass.minRate, 125);
  const mileageRate = toFinite(truckClass.mileageRate ?? truckClass.minMileageRate, 5);
  return {
    id: truckClass.id || `class-${index + 1}`,
    name: truckClass.name || `Truck Class ${index + 1}`,
    rate: hourlyRate,
    hourlyRate,
    mileageRate,
    minRate: hourlyRate,
    maxRate: hourlyRate,
    minMileageRate: mileageRate,
    maxMileageRate: mileageRate,
    drive_time_buffer: toFinite(truckClass.drive_time_buffer, 10),
    load_unload_base_mins: toFinite(truckClass.load_unload_base_mins, 30),
  };
};

/**
 * Comprehensive config normalization.
 * Handles legacy data formats, merges nested objects, and applies all defaults.
 *
 * @param {Object} rawConfig - Raw config object (may contain legacy data)
 * @returns {Object} - Normalized, canonical config object
 */
export function normalizeConfig(rawConfig = {}) {
  // Handle legacy "config" column format
  const baseConfig = {
    ...(rawConfig.config && typeof rawConfig.config === 'object' ? rawConfig.config : {}),
    ...rawConfig,
  };

  // Extract custom surcharges from either location
  const customSurcharges = baseConfig.pricing?.custom_surcharges ?? baseConfig.surcharges?.custom_surcharges;
  const normalizedCustomSurcharges = Array.isArray(customSurcharges)
    ? customSurcharges.map((item, index) => normalizeCustomSurcharge(item, index))
    : null;

  // Handle business surcharges migration
  const migratedCustomSurcharges = baseConfig.pricing?.configurable_business_surcharges === true
    ? normalizedCustomSurcharges
    : [
        { id: 'after-hours', name: 'After Hours', feeType: 'percent', value: toFinite(baseConfig.pricing?.after_hours_multiplier ?? 25, 25), active: true },
        { id: 'road-club', name: 'Road Club', feeType: 'percent', value: toFinite(baseConfig.pricing?.road_club_multiplier ?? 15, 15), active: true },
        ...(normalizedCustomSurcharges || []),
      ].filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id || candidate.name.toLowerCase() === item.name.toLowerCase()) === index);

  // Normalize weight tiers
  const weightTiers = baseConfig.client_portal?.weight_tiers ?? baseConfig.pricing?.weight_tiers ?? [];
  const normalizedWeightTiers = Array.isArray(weightTiers)
    ? weightTiers.map((tier, index) => normalizeClientPortalTier(tier, index))
    : DEFAULT_CONFIG.client_portal.weight_tiers;

  // Normalize truck classes
  const truckClasses = baseConfig.pricing?.custom_truck_classes ?? [];
  const normalizedTruckClasses = Array.isArray(truckClasses)
    ? truckClasses.map((tc, index) => normalizeCustomTruckClass(tc, index))
    : DEFAULT_PRICING.custom_truck_classes;

  // Build normalized pricing
  const hourlyRate = toFinite(baseConfig.pricing?.hourly_rate ?? baseConfig.pricing?.hourly_min ?? baseConfig.hourly_rate ?? baseConfig.hourly_min, DEFAULT_PRICING.hourly_rate);
  const mileageRate = toFinite(baseConfig.pricing?.mileage_rate ?? baseConfig.pricing?.mileage_min ?? baseConfig.mileage_rate, DEFAULT_PRICING.mileage_rate);
  const heavyHourlyRate = toFinite(baseConfig.pricing?.heavy_hourly_min, DEFAULT_PRICING.heavy_hourly_min);
  const normalizedPricing = {
    ...DEFAULT_PRICING,
    ...(baseConfig.pricing || {}),
    ...(baseConfig.surcharges || {}),
    pricing_mode: baseConfig.pricing?.pricing_mode ?? baseConfig.pricing_mode ?? DEFAULT_PRICING.pricing_mode,
    hourly_rate: hourlyRate,
    mileage_rate: mileageRate,
    hourly_min: hourlyRate,
    hourly_max: hourlyRate,
    mileage_min: mileageRate,
    mileage_max: mileageRate,
    rounding_interval: toFinite(baseConfig.pricing?.rounding_interval ?? baseConfig.rounding_interval, DEFAULT_PRICING.rounding_interval),
    drive_time_buffer: normalizeDriveTimeBuffer(baseConfig.pricing?.drive_time_buffer ?? baseConfig.drive_time_buffer ?? DEFAULT_PRICING.drive_time_buffer),
    after_hours_multiplier: toFinite(baseConfig.pricing?.after_hours_multiplier ?? baseConfig.surcharges?.after_hours_multiplier ?? baseConfig.after_hours_multiplier, DEFAULT_PRICING.after_hours_multiplier),
    road_club_multiplier: toFinite(baseConfig.pricing?.road_club_multiplier ?? baseConfig.surcharges?.road_club_multiplier ?? baseConfig.road_club_multiplier, DEFAULT_PRICING.road_club_multiplier),
    metro_multiplier: toFinite(baseConfig.pricing?.metro_multiplier ?? baseConfig.surcharges?.metro_multiplier, DEFAULT_PRICING.metro_multiplier),
    hazard_multiplier: toFinite(baseConfig.pricing?.hazard_multiplier ?? baseConfig.surcharges?.hazard_multiplier, DEFAULT_PRICING.hazard_multiplier),
    base_permit_fee: toFinite(baseConfig.pricing?.base_permit_fee, DEFAULT_PRICING.base_permit_fee),
    load_unload_base_mins: toFinite(baseConfig.pricing?.load_unload_base_mins ?? baseConfig.load_unload_base_mins, DEFAULT_PRICING.load_unload_base_mins),
    extra_stop_mins: toFinite(baseConfig.pricing?.extra_stop_mins ?? baseConfig.extra_stop_mins, DEFAULT_PRICING.extra_stop_mins),
    heavy_hourly_min: heavyHourlyRate,
    heavy_hourly_max: heavyHourlyRate,
    surchargeModes: {
      ...DEFAULT_PRICING.surchargeModes,
      ...(baseConfig.pricing?.surchargeModes || baseConfig.surcharges?.surchargeModes || {}),
    },
    configurable_business_surcharges: true,
    custom_surcharges: migratedCustomSurcharges || DEFAULT_PRICING.custom_surcharges,
    custom_truck_classes: normalizedTruckClasses,
  };

  // Build normalized surcharges
  const normalizedSurcharges = {
    ...DEFAULT_SURCHARGES,
    ...(baseConfig.surcharges || {}),
    custom_surcharges: migratedCustomSurcharges || DEFAULT_SURCHARGES.custom_surcharges,
  };

  // Build normalized geofences
  const normalizedGeofences = {
    ...DEFAULT_GEOFENCES,
    ...(baseConfig.geofences || {}),
    disabledZones: asArray(baseConfig.geofences?.disabledZones),
    customZoneRates: baseConfig.geofences?.customZoneRates || {},
    customZones: asArray(baseConfig.geofences?.customZones),
  };

  // Build normalized client portal
  const normalizedClientPortal = {
    ...DEFAULT_CLIENT_PORTAL,
    ...(baseConfig.client_portal || {}),
    contact_phone: baseConfig.client_portal?.contact_phone || DEFAULT_CLIENT_PORTAL.contact_phone,
    contact_email: baseConfig.client_portal?.contact_email || DEFAULT_CLIENT_PORTAL.contact_email,
    send_jobs_to_contact_email: baseConfig.client_portal?.send_jobs_to_contact_email !== false,
    dispatch_email: baseConfig.client_portal?.dispatch_email || '',
    approval_threshold: toFinite(baseConfig.client_portal?.approval_threshold, DEFAULT_CLIENT_PORTAL.approval_threshold),
    rounding_interval: toFinite(baseConfig.client_portal?.rounding_interval, DEFAULT_CLIENT_PORTAL.rounding_interval),
    use_custom_pricing: baseConfig.client_portal?.use_custom_pricing === true,
    disclosure: baseConfig.client_portal?.disclosure || DEFAULT_CLIENT_PORTAL.disclosure,
    weight_tiers: normalizedWeightTiers,
    clients: asArray(baseConfig.client_portal?.clients),
  };

  return {
    company_id: baseConfig.company_id || DEFAULT_CONFIG.company_id,
    pricing: normalizedPricing,
    surcharges: normalizedSurcharges,
    geofences: normalizedGeofences,
    bases: asArray(baseConfig.bases),
    users: asArray(baseConfig.users),
    client_portal: normalizedClientPortal,
  };
}
