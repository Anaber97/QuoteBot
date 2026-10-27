import { resolveZoneCharge, isBuiltInZoneActive, zoneRuleApplies } from '../shared/pricing/zoneCharge.js';
import { addressNamesZoneCity } from '../shared/geo/addressMatch.js';
import { GEOFENCES, HAZARD_ZONES, METRO_CODE_BY_ZONE_ID } from '../src/config/geofences.js';
import { selectHighestPriorityZones } from '../src/utils/geofencePriority.js';
import {
  resolveBaseRates,
  calculateTimeMetrics,
  applyQuoteTimeOverrides,
  calculateSurcharges,
  getFlatOverride,
  getMaxOverride,
  getMinOverride,
  calculateFinalQuotes as calculateFinalQuotesPure,
  calculatePermitRequirements as calculatePermitPure,
  resolveEscortRequirement,
  findWeightTier,
  routeLineMiles,
  calculateOvernights,
  escortDriveMinutes,
} from '../src/lib/pricingEngine.js';

import { evaluateOsow } from '../src/lib/osow.js';
import { resolveRouteStates, routeMilesByState } from '../src/lib/routeStates.js';

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

function findConfiguredZones(zones, addresses, routePoints, config, field) {
  return Object.values(zones).filter((zone) => isBuiltInZoneActive(zone.id, config?.geofences)).map((zone) => {
    const keywordHit = addresses.some((address) => addressNamesZoneCity(address, zone));
    if (!keywordHit && !routePoints.some((point) => pointInBox(point, zone.box))) return null;
    const charge = resolveZoneCharge(zone, config, field);
    const containsPickup = addressNamesZoneCity(addresses[0], zone) || pointInBox(routePoints[0], zone.box);
    const containsDropoff = addressNamesZoneCity(addresses.at(-1), zone) || pointInBox(routePoints.at(-1), zone.box);
    return zoneRuleApplies(charge, { containsPickup, containsDropoff }) ? { ...zone, charge } : null;
  }).filter(Boolean);
}

function findCustomZones(_localities, routePoints, config) {
  const disabled = new Set((config?.geofences?.disabledZones || []).map(String));
  const matches = (config?.geofences?.customZones || []).filter((zone) => !disabled.has(String(zone.id))).filter((zone) => {
    const polygon = Array.isArray(zone.shape) && zone.shape.length >= 3;
    if (!polygon) return false;
    const hits = routePoints.some((point) => pointInPolygon(point, zone.shape));
    if (!['flat_rate', 'max_rate'].includes(zone.pricingMode || (zone.feeType === 'flat' ? 'flat_rate' : 'surcharge'))) return hits;
    const pickupHit = routePoints[0] && pointInPolygon(routePoints[0], zone.shape);
    const dropoffHit = routePoints.at(-1) && pointInPolygon(routePoints.at(-1), zone.shape);
    return pickupHit && dropoffHit;
  }).map((zone) => {
    const pricingMode = zone.pricingMode || (zone.feeType === 'flat' ? 'flat_rate' : 'surcharge');
    const value = toFinite(zone.price ?? zone.value);
    return { ...zone, charge: pricingMode === 'surcharge'
      ? { pricingMode, feeType: zone.surchargeFeeType === 'flat' ? 'flat' : 'percent', value }
      : { pricingMode, feeType: pricingMode === 'max_rate' ? 'max' : pricingMode === 'min_rate' ? 'min' : 'flat', value } };
  });
  return selectHighestPriorityZones(matches);
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
  const metroMatches = findConfiguredZones(GEOFENCES, addresses, customerRoutePoints, config, 'metro_multiplier');
  const hazardMatches = findConfiguredZones(HAZARD_ZONES, addresses, customerRoutePoints, config, 'hazard_multiplier');
  const customMatches = role !== 'client' && input.activeOverrides?.custom === false
    ? [] : findCustomZones(route.localities || [], customerRoutePoints, config);
  const selectedClass = (pricing.custom_truck_classes || []).find((item) => String(item.id) === String(input.selectedTruckClassId));
  const totalWeight = toFinite(input.equipment?.weight) + toFinite(input.equipment?.attachmentWeight);
  const useWeightTierPricing = role === 'client' || input.quoteSource === 'equipment_calculator';
  const tiers = clientConfig?.pricing?.use_custom_pricing && Array.isArray(clientConfig?.pricing?.weight_tiers)
    ? clientConfig.pricing.weight_tiers : config?.client_portal?.weight_tiers || [];
  const tier = findWeightTier(tiers, totalWeight);
  if (useWeightTierPricing && !(totalWeight > 0 && toFinite(input.equipment?.width) > 0 && toFinite(input.equipment?.height) > 0)) {
    throw Object.assign(new Error('Enter the equipment operating weight, width, and height to get a quote.'), { status: 400 });
  }
  if (useWeightTierPricing && !tier) throw Object.assign(new Error(`No equipment weight class is configured for ${totalWeight.toLocaleString()} lbs.`), { status: 400 });

  // Use shared time metrics calculation
  const { rawTotalHours, loadUnloadMinutes, driveTimeBufferPercent } = calculateTimeMetrics({
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
  if (useWeightTierPricing && !(minRate > 0)) {
    throw Object.assign(new Error(`The ${tier.label || 'matching'} weight class has no rate set.`), { status: 400 });
  }

  // Set up overrides appropriately
  const overrides = role === 'client' ? { afterHours: false, roadClub: false, metro: true, hazard: true, customSurcharges: {} } : input.activeOverrides || {};
  // Metro and hazard rules price client and staff quotes alike; only staff can switch them off per quote.
  const activeMetro = overrides.metro === false ? [] : metroMatches;
  const activeHazard = overrides.hazard === false ? [] : hazardMatches;
  const ruleZones = [...customMatches, ...activeMetro, ...activeHazard];

  // Use shared surcharge calculation
  const { multiplier, flatSum } = calculateSurcharges({
    metroMatches: activeMetro,
    hazardMatches: activeHazard,
    customMatches,
    customSurcharges: pricing.custom_surcharges || [],
    useWeightTierPricing,
    allowRouteSurcharges: true,
    overrides,
  });

  const flatOverride = getFlatOverride(ruleZones);
  const maxOverride = getMaxOverride(ruleZones);
  const minOverride = getMinOverride(ruleZones);
  const interval = toFinite(useWeightTierPricing ? tier?.rounding_interval ?? clientPricing.rounding_interval : pricing.rounding_interval, 25);

  // Calculate permit fee
  let permit = calculatePermitPure({
    weight: totalWeight,
    width: toFinite(input.equipment?.width),
    height: toFinite(input.equipment?.height),
    pickupAddress: addresses[0],
    dropoffAddress: addresses.at(-1),
    baseFee: useWeightTierPricing
      ? toFinite(tier?.permitCost, toFinite(config?.pricing?.base_permit_fee, 150))
      : toFinite(config?.pricing?.base_permit_fee, 150),
  });
  // Escorts run the customer trip only (pickup to dropoff), never the deadhead from and back to the yard.
  const customerMiles = (route.legs || []).slice(1, -1).reduce((sum, leg) => sum + toFinite(leg.distanceMeters), 0) * 0.000621371
    || routeLineMiles(customerRoutePoints);
  const escortPricing = config?.client_portal?.escort_pricing;
  let escort = resolveEscortRequirement({
    width: toFinite(input.equipment?.width),
    height: toFinite(input.equipment?.height),
    rules: config?.client_portal?.escort_rules,
    miles: customerMiles,
    pricing: escortPricing,
  });

  let osow = null;
  if (useWeightTierPricing && config.client_portal?.osow_pricing?.enabled) {
    const companyTier = findWeightTier(config.client_portal.weight_tiers, totalWeight);
    osow = evaluateOsow({ weight: totalWeight, width: input.equipment?.width, height: input.equipment?.height,
      lengthFt: input.equipment?.lengthFt, overhangFt: input.equipment?.overhangFt,
      tier: { ...tier, permitCost: tier?.permitCost ?? pricing.base_permit_fee ?? 150, averageClearanceIn: companyTier?.averageClearanceIn, averageVehicleWeightLbs: companyTier?.averageVehicleWeightLbs },
      states: resolveRouteStates(customerRoutePoints), routeKnown: customerRoutePoints.length > 1,
      limits: config.state_transport_limits || [], pricing: config.client_portal.osow_pricing,
      stateMiles: routeMilesByState(customerRoutePoints, customerMiles), escortPricing });
    permit = osow; escort = osow.escort;
  }

  // Use shared final quote calculation
  const timeMetrics = applyQuoteTimeOverrides({
    rawTotalHours, loadUnloadMinutes, driveTimeBufferPercent,
    customLoadUnloadMins: role !== 'client' ? input.customLoadUnloadMins : null,
    customDriveTimeBufferPercent: role !== 'client' ? input.customDriveTimeBufferPercent : null,
  });
  const effectivePricingQuantity = standardPricingMode === 'mileage' ? totalMiles : timeMetrics.rawTotalHours;

  // Equipment quotes add overnight stays: the driver's over the whole round trip, each escort's over its escorted miles.
  const customerDriveMinutes = (route.legs || []).slice(1, -1).reduce((sum, leg) => sum + toFinite(leg.durationMinutes), 0)
    * (1 + timeMetrics.driveTimeBufferPercent / 100);
  const overnights = useWeightTierPricing ? calculateOvernights({
    driveMinutes: timeMetrics.adjustedDriveMinutes,
    onSiteMinutes: timeMetrics.loadUnloadMinutes,
    escortDriveMinutes: escortDriveMinutes(osow ? osow.escortMiles : Array(escort.vehicleCount).fill(customerMiles), customerMiles, customerDriveMinutes),
    permittedLoad: Boolean(permit.needsPermit || escort.vehicleCount > 0),
    settings: config?.client_portal?.overnight_pricing,
  }) : null;

  const quoteResult = calculateFinalQuotesPure({
    pricingQuantity: effectivePricingQuantity,
    minRate,
    maxRate,
    surchargeMultiplier: multiplier,
    surchargeFlatSum: flatSum,
    permitFee: permit.permitFee + escort.surcharge + (overnights?.charge || 0),
    rounding: interval,
    customRate: role !== 'client' ? toFinite(input.customRate) : null,
    customQuantity: role !== 'client' ? effectivePricingQuantity : null,
    flatOverride,
    maxOverride,
    minOverride,
  });

  return {
    totalMiles,
    totalHours: Number(timeMetrics.rawTotalHours.toFixed(2)),
    driveTimeBufferPercent: timeMetrics.driveTimeBufferPercent,
    pricingMode: useWeightTierPricing ? 'equipment-weight-tier' : standardPricingMode,
    minQuote: quoteResult.minQuote,
    maxQuote: quoteResult.maxQuote,
    customQuote: quoteResult.customQuote,
    approvalRequired: Boolean(osow?.reviewRequired) || totalWeight >= toFinite(clientConfig?.approval_threshold ?? config?.client_portal?.approval_threshold, 80000),
    permit,
    osow,
    escort,
    overnights,
    metroCodes: [...new Set(metroMatches.map((zone) => METRO_CODE_BY_ZONE_ID[zone.id]).filter(Boolean))],
    appliedSurcharges: { afterHours: false, roadClub: false, metro: activeMetro.length > 0, hazard: activeHazard.length > 0, customZone: Boolean(customMatches.length) },
    routeLegs: route.legs,
    quoteDetails: { ...(input.equipment || {}), osow, driveTimeBufferPercent: timeMetrics.driveTimeBufferPercent, loadUnloadMinutes: timeMetrics.loadUnloadMinutes, permitFee: permit.permitFee, permitFlags: permit.flags, escort, overnights, customZoneNames: customMatches.map((zone) => zone.name).filter(Boolean) },
  };
}
