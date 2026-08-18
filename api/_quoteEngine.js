import { GEOFENCES, HAZARD_ZONES, METRO_CODE_BY_ZONE_ID } from '../src/config/geofences.js';

const toFinite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const roundToNearest = (value, interval = 25) => Math.round(value / (toFinite(interval, 25) || 25)) * (toFinite(interval, 25) || 25);
const normalizeBuffer = (value) => {
  const number = toFinite(value, 10);
  return number > 1.5 ? 1 + number / 100 : number;
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
const matchesLocality = (address, zone) => {
  const text = normalizeText(address);
  const city = normalizeText(zone?.city);
  const state = normalizeText(zone?.state);
  const locality = normalizeText(zone?.localityQuery || [zone?.city, zone?.state].filter(Boolean).join(', '));
  return Boolean((locality && text.includes(locality)) || (city && state && text.includes(city) && text.includes(state)) || (city && text.includes(city)));
};

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

function findCustomZones(addresses, routePoints, config) {
  const disabled = new Set((config?.geofences?.disabledZones || []).map(String));
  return (config?.geofences?.customZones || []).filter((zone) => !disabled.has(String(zone.id))).filter((zone) => {
    const polygon = Array.isArray(zone.shape) && zone.shape.length >= 3;
    const hits = polygon ? routePoints.some((point) => pointInPolygon(point, zone.shape)) : addresses.some((address) => matchesLocality(address, zone));
    if ((zone.pricingMode || (zone.feeType === 'flat' ? 'flat_rate' : 'surcharge')) !== 'flat_rate') return hits;
    const pickupHit = polygon ? routePoints[0] && pointInPolygon(routePoints[0], zone.shape) : matchesLocality(addresses[0], zone);
    const dropoffHit = polygon ? routePoints.at(-1) && pointInPolygon(routePoints.at(-1), zone.shape) : matchesLocality(addresses.at(-1), zone);
    return pickupHit && dropoffHit;
  }).map((zone) => ({
    ...zone,
    charge: (zone.pricingMode || (zone.feeType === 'flat' ? 'flat_rate' : 'surcharge')) === 'flat_rate'
      ? { feeType: 'flat', value: toFinite(zone.price ?? zone.value) }
      : { feeType: zone.surchargeFeeType === 'flat' ? 'flat' : 'percent', value: toFinite(zone.price ?? zone.value) },
  }));
}

export function calculatePermitRequirements({ weight, width, height, pickupAddress, dropoffAddress, config }) {
  const state = (address) => String(address || '').match(/\b([A-Z]{2})\b/)?.[1] || '';
  const pickupState = state(pickupAddress);
  const dropoffState = state(dropoffAddress);
  const isInterstate = Boolean(pickupState && dropoffState && pickupState !== dropoffState);
  const flags = [];
  if (weight > 45000) flags.push(`Overweight (${weight.toLocaleString()} lbs > 45,000 lbs limit)`);
  if (width > 102) flags.push(`Oversize Width (${width} in > 102 in limit)`);
  if (height > 162) flags.push(`Oversize Height (${height} in > 162 in limit)`);
  if (isInterstate) flags.push(`Interstate Crossing (${pickupState} → ${dropoffState})`);
  const needsPermit = weight > 45000 || width > 102 || height > 162;
  return { needsPermit, isInterstate, flags, permitFee: needsPermit ? toFinite(config?.pricing?.base_permit_fee, 150) * (isInterstate ? 1.5 : 1) : 0 };
}

export function calculateAuthoritativeQuote({ input, config, clientConfig, route, role }) {
  const pricing = config?.pricing || {};
  const clientPricing = clientConfig?.pricing?.use_custom_pricing ? clientConfig.pricing : {};
  const addresses = input.waypoints;
  const customerRoutePoints = route.customerRoutePoints || [];
  const metroMatches = findConfiguredZones(GEOFENCES, addresses, customerRoutePoints, config);
  const hazardMatches = findConfiguredZones(HAZARD_ZONES, addresses, customerRoutePoints, config);
  const customMatches = findCustomZones(addresses, customerRoutePoints, config);
  const selectedClass = (pricing.custom_truck_classes || []).find((item) => String(item.id) === String(input.selectedTruckClassId));
  const totalWeight = toFinite(input.equipment?.weight) + toFinite(input.equipment?.attachmentWeight);
  const useWeightTierPricing = role === 'client' || input.quoteSource === 'equipment_calculator';
  const tiers = clientConfig?.pricing?.use_custom_pricing && Array.isArray(clientConfig?.pricing?.weight_tiers)
    ? clientConfig.pricing.weight_tiers : config?.client_portal?.weight_tiers || [];
  const tier = tiers.find((item) => totalWeight >= toFinite(item.minWeight) && totalWeight <= toFinite(item.maxWeight, 999999));
  if (useWeightTierPricing && !tier) throw Object.assign(new Error(`No equipment weight class is configured for ${totalWeight.toLocaleString()} lbs.`), { status: 400 });

  const driveBuffer = normalizeBuffer(useWeightTierPricing ? tier?.drive_time_buffer : selectedClass?.drive_time_buffer ?? clientPricing.drive_time_buffer ?? pricing.drive_time_buffer ?? 10);
  const loadMinutes = toFinite(useWeightTierPricing ? tier?.load_unload_base_mins : selectedClass?.load_unload_base_mins ?? clientPricing.load_unload_base_mins ?? pricing.load_unload_base_mins, 30);
  const extraStopMinutes = toFinite(clientPricing.extra_stop_mins ?? pricing.extra_stop_mins, 15) * Math.max(0, addresses.length - 2);
  const rawTotalHours = (route.rawDriveMinutes * driveBuffer + loadMinutes + extraStopMinutes) / 60;

  let minRate = toFinite(pricing.hourly_min ?? config.hourly_min, 125);
  let maxRate = toFinite(pricing.hourly_max ?? config.hourly_max, 135);
  if (useWeightTierPricing) minRate = maxRate = toFinite(tier.rate);
  else if (selectedClass) { minRate = toFinite(selectedClass.minRate, minRate); maxRate = toFinite(selectedClass.maxRate, maxRate); }
  else if (input.isHeavy) { minRate = toFinite(pricing.heavy_hourly_min ?? config.heavy_hourly_min, 200); maxRate = toFinite(pricing.heavy_hourly_max ?? config.heavy_hourly_max, 250); }

  const overrides = role === 'client' ? { afterHours: false, roadClub: false, metro: true, hazard: true, customSurcharges: {} } : input.activeOverrides || {};
  const charge = { multiplier: 1, flat: 0 };
  const add = (feeType, value) => feeType === 'flat' ? charge.flat += toFinite(value) : charge.multiplier *= 1 + toFinite(value) / 100;
  const modes = pricing.surchargeModes || config?.surcharges?.surchargeModes || {};
  if (input.isAfterHours && overrides.afterHours) add(modes.after_hours_multiplier, pricing.after_hours_multiplier ?? 25);
  if (input.isRoadClub && overrides.roadClub) add(modes.road_club_multiplier, pricing.road_club_multiplier ?? 15);
  if (metroMatches.length && overrides.metro) add(metroMatches[0].charge.feeType, metroMatches[0].charge.value);
  if (hazardMatches.length && overrides.hazard) hazardMatches.forEach((zone) => add(zone.charge.feeType, zone.charge.value));
  customMatches.forEach((zone) => add(zone.charge.feeType, zone.charge.value));
  (pricing.custom_surcharges || []).filter((item) => item.active !== false && overrides.customSurcharges?.[item.id] === true).forEach((item) => add(item.feeType, item.value));

  const flatOverride = customMatches.filter((zone) => zone.charge.feeType === 'flat').reduce((maximum, zone) => Math.max(maximum, zone.charge.value), 0);
  const interval = toFinite(useWeightTierPricing ? tier.rounding_interval ?? clientPricing.rounding_interval : pricing.rounding_interval, 25);
  let minQuote = flatOverride || roundToNearest(rawTotalHours * minRate * charge.multiplier + charge.flat, interval);
  let maxQuote = flatOverride || roundToNearest(rawTotalHours * maxRate * charge.multiplier + charge.flat, interval);
  let customQuote = null;
  if (role !== 'client' && toFinite(input.customRate) > 0) {
    const hours = input.customLoadUnloadMins == null ? rawTotalHours : Math.max(0, rawTotalHours + (toFinite(input.customLoadUnloadMins) - loadMinutes - extraStopMinutes) / 60);
    customQuote = roundToNearest(hours * toFinite(input.customRate) * charge.multiplier + charge.flat, interval);
  }
  const permit = calculatePermitRequirements({ weight: totalWeight, width: toFinite(input.equipment?.width), height: toFinite(input.equipment?.height), pickupAddress: addresses[0], dropoffAddress: addresses.at(-1), config });
  minQuote += permit.permitFee;
  maxQuote += permit.permitFee;
  if (customQuote != null) customQuote += permit.permitFee;

  return {
    totalMiles: route.totalMeters * 0.000621371,
    totalHours: Number(rawTotalHours.toFixed(2)),
    minQuote, maxQuote, customQuote,
    approvalRequired: totalWeight >= toFinite(clientConfig?.approval_threshold ?? config?.client_portal?.approval_threshold, 80000),
    permit,
    metroCodes: [...new Set(metroMatches.map((zone) => METRO_CODE_BY_ZONE_ID[zone.id]).filter(Boolean))],
    appliedSurcharges: { afterHours: Boolean(input.isAfterHours && overrides.afterHours), roadClub: Boolean(input.isRoadClub && overrides.roadClub), metro: Boolean(metroMatches.length && overrides.metro), hazard: Boolean(hazardMatches.length && overrides.hazard) },
    routeLegs: route.legs,
    quoteDetails: { ...(input.equipment || {}), permitFee: permit.permitFee, permitFlags: permit.flags },
  };
}
