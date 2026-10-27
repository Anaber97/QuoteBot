import { resolveZoneCharge, isBuiltInZoneActive, zoneRuleApplies } from '../../shared/pricing/zoneCharge.js';
import { addressNamesZoneCity } from '../../shared/geo/addressMatch.js';
// src/utils/geofenceEngine.js
// @ts-check
import { GEOFENCES, HAZARD_ZONES } from "../config/geofences.js";
import { selectHighestPriorityZones } from './geofencePriority.js';

function isPointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false;
  const { lat, lng } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat;
    const yi = polygon[i].lng;
    const xj = polygon[j].lat;
    const yj = polygon[j].lng;
    const intersects = ((yi > lng) !== (yj > lng)) && (lat < ((xj - xi) * (lng - yi)) / ((yj - yi) || 1) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function getActiveZones(baseZones, companyRates = {}) {
  return Object.values(baseZones).filter((zone) => isBuiltInZoneActive(zone.id, companyRates?.geofences));
}

const isInBox = (point, box) => Boolean(point && box
  && point.lat >= box.minLat && point.lat <= box.maxLat && point.lng >= box.minLng && point.lng <= box.maxLng);

export async function checkGeofenceZone(zoneConfig, addresses = [], coordsList = [], routePoints = []) {
  const cleanAddresses = (addresses || []).filter((addr) => typeof addr === 'string' && addr.trim().length > 0);

  if (cleanAddresses.length < 2) return false;

  const isPointInBox = (lat, lng) => {
    const { box } = zoneConfig;
    if (!box) return false;
    return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
  };

  // Check city name keywords in addresses
  const hasKeyword = cleanAddresses.some((addr) => addressNamesZoneCity(addr, zoneConfig));
  if (hasKeyword) return true;

  // Check geocoded points
  const directHit = coordsList.some((c) => c && isPointInBox(c.lat, c.lng));
  if (directHit) return true;

  // Route geometry is obtained once by the quote calculator and reused for
  // every zone. Geofence evaluation itself never makes a billable Maps call.
  return routePoints.some((point) => point && isPointInBox(point.lat, point.lng));
}

async function evaluateZoneMatches(baseZones, cleanWaypoints, coordsList, companyRates = {}, routePoints = [], field) {
  const activeZones = getActiveZones(baseZones, companyRates);
  const results = await Promise.all(
    activeZones.map(async (zone) => {
      const matched = await checkGeofenceZone(zone, cleanWaypoints, coordsList, routePoints);
      const customZone = companyRates?.geofences?.customZones?.find((item) => item.id === zone.id);
      const customShape = customZone?.shape;
      const inShape = customShape?.length >= 3 && coordsList.some((point) => point && isPointInPolygon(point, customShape));
      if (!matched && !inShape) return null;

      const charge = resolveZoneCharge(zone, companyRates, field);
      const containsPickup = addressNamesZoneCity(cleanWaypoints[0], zone) || isInBox(coordsList[0], zone.box);
      const containsDropoff = addressNamesZoneCity(cleanWaypoints.at(-1), zone) || isInBox(coordsList.at(-1), zone.box);
      return zoneRuleApplies(charge, { containsPickup, containsDropoff }) ? { ...zone, charge, customZone } : null;
    })
  );
  return results.filter(Boolean);
}

export async function evaluateMetroGeofences(cleanWaypoints, coordsList, companyRates = {}, routePoints = []) {
  return evaluateZoneMatches(GEOFENCES, cleanWaypoints, coordsList, companyRates, routePoints, 'metro_multiplier');
}

export async function evaluateHazardGeofences(cleanWaypoints, coordsList, companyRates = {}, routePoints = []) {
  return evaluateZoneMatches(HAZARD_ZONES, cleanWaypoints, coordsList, companyRates, routePoints, 'hazard_multiplier');
}

export async function evaluateCustomGeofences(_cleanWaypoints, coordsList, companyRates = {}, _resolvedLocations = []) {
  const disabledZoneIds = new Set((companyRates?.geofences?.disabledZones || []).map((id) => String(id)));
  const customZones = (companyRates?.geofences?.customZones || []).filter((zone) => !disabledZoneIds.has(String(zone.id)));
  const pickupPoint = coordsList?.[0] || null;
  const dropoffPoint = coordsList?.[coordsList.length - 1] || null;

  const results = await Promise.all(
    customZones.map(async (zone) => {
      if (!Array.isArray(zone.shape) || zone.shape.length < 3) return null;
      const containsPickup = pickupPoint ? isPointInPolygon(pickupPoint, zone.shape) : false;
      const containsDropoff = dropoffPoint ? isPointInPolygon(dropoffPoint, zone.shape) : false;
      const anyRoutePointInside = coordsList.some((point) => point && isPointInPolygon(point, zone.shape));

      const pricingMode = zone.pricingMode || (String(zone.feeType || 'percent') === 'flat' ? 'flat_rate' : 'surcharge');
      if (pricingMode === 'flat_rate') {
        if (!containsPickup || !containsDropoff) return null;
        return {
          ...zone,
          charge: { pricingMode, feeType: 'flat', value: Number(zone.price ?? zone.value ?? 0) || 0 },
          containsPickup,
          containsDropoff,
        };
      }

      if (pricingMode === 'max_rate') {
        if (!containsPickup || !containsDropoff) return null;
        return {
          ...zone,
          charge: { pricingMode, feeType: 'max', value: Number(zone.price ?? zone.value ?? 0) || 0 },
          containsPickup,
          containsDropoff,
        };
      }

      if (!anyRoutePointInside) return null;
      if (pricingMode === 'min_rate') {
        return { ...zone, charge: { pricingMode, feeType: 'min', value: Number(zone.price ?? zone.value ?? 0) || 0 }, containsPickup, containsDropoff };
      }
      return {
        ...zone,
        charge: { pricingMode: 'surcharge', feeType: zone.surchargeFeeType === 'flat' ? 'flat' : 'percent', value: Number(zone.price ?? zone.value ?? 0) || 0 },
        containsPickup,
        containsDropoff,
      };
    })
  );

  return selectHighestPriorityZones(results.filter(Boolean));
}
