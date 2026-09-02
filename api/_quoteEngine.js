import { GEOFENCES, HAZARD_ZONES, METRO_CODE_BY_ZONE_ID } from '../src/config/geofences.js';
import {
  resolveBaseRates,
  calculateTimeMetrics,
  calculateSurcharges,
  getFlatOverride,
  calculateFinalQuotes as calculateFinalQuotesPure,
  calculatePermitRequirements as calculatePermitPure,
  resolveEscortRequirement,
} from '../src/lib/pricingEngine.js';

const toFinite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function decodePolyline(encoded = '') {
  const points = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index <= encoded.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index <= encoded.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: latitude / 1e5, lng: longitude / 1e5 });
  }
  return points;
}

const pointInBox = (point, box) => Boolean(point && box
  && point.lat >= box.minLat && point.lat <= box.maxLat
  && point.lng >= box.minLng && point.lng <= box.maxLng);

const pointInPolygon = (point, polygon) => {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat; const yi = polygon[i].lng;
    const xj = polygon[j].lat; const yj = polygon[j].lng;
    if (((yi > point.lng) !== (yj > point.lng))
      && point.lat < ((xj - xi) * (point.lng - yi)) / ((yj - yi) || 1) + xi) inside = !inside;
  }
  return inside;
};

const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const zoneCharge = (zone, config) => {
  const override = config?.geofences?.customZoneRates?.[zone.id] || {};
  const feeType = override.feeType || zone.feeType || 'percent';
  const fallback = zone.feeType === 'flat'
    ? toFinite(zone.price ?? zone.value)
    : Math.max(0, (toFinite(zone.multiplier, 1) - 1) * 100);
  const value = toFinite(override.value ?? override.price ?? (override.multiplier != null ? toFinite(override.multiplier) : fallback), fallback);
  return { feeType, value };
};

function findConfiguredZones(zones, addresses, routePoints, config) {
  const disabled = new Set((config?.geofences?.disabledZones || []).map(String));
  return Object.values(zones).filter((zone) => {
    if (disabled.has(String(zone.id))) return false;
    const keywordHit = addresses.some((address) => (zone.cities || []).some((city) => normalizeText(address).includes(normalizeText(city))));
    return keywordHit || routePoints.some((point) => pointInBox(point, zone.box));
  }).map((zone) => ({ ...zone, charge: zoneCharge(zone, config) }));
}

function findCustomZones(_localities, routePoints, config) {
  const disabled = new Set((config?.geofences?.disabledZones || []).map(String));
  return (config?.geofences?.customZones || []).filter((zone) => !disabled.has(String(zone.id))).filter((zone) => {
    const polygon = Array.isArray(zone.shape) && zone.shape.length >= 3;
    // Fail closed: municipality metadata can extend beyond incorporated city
    // limits, so it must never substitute for a configured boundary polygon.
    if (!polygon) return false;
    const hits = routePoints.some((point) => pointInPolygon(point, zone.shape));
    if ((zone.pricingMode || (zone.feeType === 'flat' ? 'flat_rate' : 'surcharge')) !== 'flat_rate') return hits;
    const pickupHit = routePoints[0] && pointInPolygon(routePoints[0], zone.shape);
    const dropoffHit = routePoints.at(-1) && pointInPolygon(routePoints.at(-1), zone.shape);
    return pickupHit && dropoffHit;
  }).map((zone) => ({
    ...zone,
    charge: (zone.pricingMode || (zone.feeType === 'flat' ? 'flat_rate' : 'surcharge')) === 'flat_rate'
      ? { feeType: 'flat', value: toFinite(zone.price ?? zone.value) }
      : { feeType: zone.surchargeFeeType === 'flat' ? 'flat' : 'percent', value: toFinite(zone.price ?? zone.value) },
  }));
}

export function calculatePermitRequirements({ weight, width, height, pickupAddress, dropoffAddress, config }) {
  // Use shared calculation with base fee from config
  return calculatePermitPure({
    weight,
    width,
    height,
    pickupAddress,
    dropoffAddress,
    baseFee: toFinite(config?.pricing?.base_permit_fee, 150),
  });
}

export function calculateAuthoritativeQuote({ input, config, clientConfig, route, role }) {
  const pricing = config?.pricing || {};
  const clientPricing = clientConfig?.pricing?.use_custom_pricing ? clientConfig.pricing : {};
  const addresses = input.waypoints;
  const customerRoutePoints = route.customerRoutePoints || [];
  const metroMatches = findConfiguredZones(GEOFENCES, addresses, customerRoutePoints, config);
  const hazardMatches = findConfiguredZones(HAZARD_ZONES, addresses, customerRoutePoints, config);
  const customMatches = findCustomZones(route.localities || [], customerRoutePoints, config);
  const selectedClass = (pricing.custom_truck_classes || []).find((item) => String(item.id) === String(input.selectedTruckClassId));
  const totalWeight = toFinite(input.equipment?.weight) + toFinite(input.equipment?.attachmentWeight);
  const useWeightTierPricing = role === 'client' || input.quoteSource === 'equipment_calculator';
  const tiers = clientConfig?.pricing?.use_custom_pricing && Array.isArray(clientConfig?.pricing?.weight_tiers)
    ? clientConfig.pricing.weight_tiers : config?.client_portal?.weight_tiers || [];
  const tier = tiers.find((item) => totalWeight >= toFinite(item.minWeight) && totalWeight <= toFinite(item.maxWeight, 999999));
  if (useWeightTierPricing && !tier) throw Object.assign(new Error(`No equipment weight class is configured for ${totalWeight.toLocaleString()} lbs.`), { status: 400 });

  // Use shared time metrics calculation
  const { rawTotalHours, loadUnloadMinutes } = calculateTimeMetrics({
    rawDriveMinutes: route.rawDriveMinutes,
    baseLoadMinutes: toFinite(useWeightTierPricing ? tier?.load_unload_base_mins : selectedClass?.load_unload_base_mins ?? clientPricing.load_unload_base_mins ?? pricing.load_unload_base_mins, 30),
    extraStopMinutes: toFinite(clientPricing.extra_stop_mins ?? pricing.extra_stop_mins, 15),
    extraStopCount: Math.max(0, addresses.length - 2),
    driveTimeBuffer: toFinite(useWeightTierPricing ? tier?.drive_time_buffer : selectedClass?.drive_time_buffer ?? clientPricing.drive_time_buffer ?? pricing.drive_time_buffer ?? 10, 10),
    useWeightTierPricing,
    tier,
    selectedClass,
  });

  const totalMiles = route.totalMeters * 0.000621371;
  const standardPricingMode = pricing.pricing_mode === 'mileage' ? 'mileage' : 'hourly';

  // Use shared base rate resolution
  const { minRate, maxRate } = resolveBaseRates({
    pricingMode: standardPricingMode,
    useWeightTierPricing,
    tier,
    selectedClass,
    isHeavy: input.isHeavy,
    pricing,
    config,
  });

  // Set up overrides appropriately
  const overrides = role === 'client' ? { afterHours: false, roadClub: false, metro: true, hazard: true, customSurcharges: {} } : input.activeOverrides || {};

  // Use shared surcharge calculation
  const { multiplier, flatSum } = calculateSurcharges({
    metroMatches: !useWeightTierPricing ? metroMatches : [],
    hazardMatches: !useWeightTierPricing ? hazardMatches : [],
    customMatches: !useWeightTierPricing ? customMatches : [], // Custom zones ignored in weight tier mode
    customSurcharges: pricing.custom_surcharges || [],
    useWeightTierPricing,
    overrides,
  });

  // Check for flat override (only in non-weight-tier mode)
  const flatOverride = !useWeightTierPricing ? getFlatOverride(customMatches) : 0;
  const interval = toFinite(useWeightTierPricing ? tier?.rounding_interval ?? clientPricing.rounding_interval : pricing.rounding_interval, 25);
  const pricingQuantity = standardPricingMode === 'mileage' ? totalMiles : rawTotalHours;

  // Calculate permit fee
  const permit = calculatePermitPure({
    weight: totalWeight,
    width: toFinite(input.equipment?.width),
    height: toFinite(input.equipment?.height),
    pickupAddress: addresses[0],
    dropoffAddress: addresses.at(-1),
    baseFee: useWeightTierPricing
      ? toFinite(tier?.permitCost, toFinite(config?.pricing?.base_permit_fee, 150))
      : toFinite(config?.pricing?.base_permit_fee, 150),
  });
  const escort = resolveEscortRequirement({
    width: toFinite(input.equipment?.width),
    height: toFinite(input.equipment?.height),
    rules: config?.client_portal?.escort_rules,
  });

  // Use shared final quote calculation
  let customQuantity = null;
  if (role !== 'client' && toFinite(input.customLoadUnloadMins) > 0) {
    const customHours = input.customLoadUnloadMins == null ? rawTotalHours : Math.max(0, rawTotalHours + (toFinite(input.customLoadUnloadMins) - loadUnloadMinutes) / 60);
    customQuantity = standardPricingMode === 'mileage' ? totalMiles : customHours;
  }

  const quoteResult = calculateFinalQuotesPure({
    pricingQuantity,
    minRate,
    maxRate,
    surchargeMultiplier: multiplier,
    surchargeFlatSum: flatSum + escort.surcharge,
    permitFee: permit.permitFee,
    rounding: interval,
    customRate: role !== 'client' ? toFinite(input.customRate) : null,
    customQuantity,
    flatOverride,
  });

  return {
    totalMiles,
    totalHours: Number(rawTotalHours.toFixed(2)),
    pricingMode: useWeightTierPricing ? 'equipment-weight-tier' : standardPricingMode,
    minQuote: quoteResult.minQuote,
    maxQuote: quoteResult.maxQuote,
    customQuote: quoteResult.customQuote,
    approvalRequired: totalWeight >= toFinite(clientConfig?.approval_threshold ?? config?.client_portal?.approval_threshold, 80000),
    permit,
    escort,
    metroCodes: [...new Set(metroMatches.map((zone) => METRO_CODE_BY_ZONE_ID[zone.id]).filter(Boolean))],
    appliedSurcharges: { afterHours: false, roadClub: false, metro: Boolean(!useWeightTierPricing && metroMatches.length && overrides.metro), hazard: Boolean(!useWeightTierPricing && hazardMatches.length && overrides.hazard) },
    routeLegs: route.legs,
    quoteDetails: { ...(input.equipment || {}), permitFee: permit.permitFee, permitFlags: permit.flags, escort },
  };
}
