// src/utils/geofenceEngine.js
// @ts-check
import { GEOFENCES, HAZARD_ZONES } from "../config/geofences.js";

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
  const disabledZoneIds = new Set((companyRates?.geofences?.disabledZones || []).map((id) => String(id)));
  return Object.values(baseZones).filter((zone) => !disabledZoneIds.has(String(zone.id)));
}

function getZoneCharge(zoneConfig, companyRates = {}) {
  const override = companyRates?.geofences?.customZoneRates?.[zoneConfig.id] || {};
  const defaultFeeType = zoneConfig.feeType || 'percent';
  const defaultValue = defaultFeeType === 'flat'
    ? Number(zoneConfig.price ?? zoneConfig.value ?? 0) || 0
    : Number.isFinite(Number(zoneConfig.multiplier))
      ? Math.max(0, (Number(zoneConfig.multiplier) - 1) * 100)
      : 0;

  if (override.feeType === 'flat') {
    return { feeType: 'flat', value: Number(override.value ?? override.price ?? 0) || 0 };
  }

  if (override.feeType === 'percent') {
    return { feeType: 'percent', value: Number(override.value ?? override.multiplier ?? 0) || 0 };
  }

  if (override.multiplier != null) {
    return { feeType: 'percent', value: Number(override.multiplier) || defaultValue };
  }

  if (override.value != null) {
    return { feeType: defaultFeeType, value: Number(override.value) || defaultValue };
  }

  return { feeType: defaultFeeType, value: defaultValue };
}

export async function checkGeofenceZone(zoneConfig, addresses = [], coordsList = [], routePoints = []) {
  const cleanAddresses = (addresses || []).filter((addr) => typeof addr === 'string' && addr.trim().length > 0);

  if (cleanAddresses.length < 2) return false;

  const isPointInBox = (lat, lng) => {
    const { box } = zoneConfig;
    if (!box) return false;
    return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
  };

  // Check city name keywords in addresses
  const hasKeyword = cleanAddresses.some((addr) =>
    (zoneConfig.cities || []).some((city) => addr.toLowerCase().includes(city.toLowerCase()))
  );
  if (hasKeyword) return true;

  // Check geocoded points
  const directHit = coordsList.some((c) => c && isPointInBox(c.lat, c.lng));
  if (directHit) return true;

  // Route geometry is obtained once by the quote calculator and reused for
  // every zone. Geofence evaluation itself never makes a billable Maps call.
  return routePoints.some((point) => point && isPointInBox(point.lat, point.lng));
}

async function evaluateZoneMatches(baseZones, cleanWaypoints, coordsList, companyRates = {}, routePoints = []) {
  const activeZones = getActiveZones(baseZones, companyRates);
  const results = await Promise.all(
    activeZones.map(async (zone) => {
      const matched = await checkGeofenceZone(zone, cleanWaypoints, coordsList, routePoints);
      const customZone = companyRates?.geofences?.customZones?.find((item) => item.id === zone.id);
      const customShape = customZone?.shape;

      if (!matched && customShape?.length >= 3) {
        const hit = coordsList.some((point) => point && isPointInPolygon(point, customShape));
        if (hit) {
          return { ...zone, charge: getZoneCharge(zone, companyRates), customZone };
        }
      }

      return matched ? { ...zone, charge: getZoneCharge(zone, companyRates), customZone } : null;
    })
  );
  return results.filter(Boolean);
}

export async function evaluateMetroGeofences(cleanWaypoints, coordsList, companyRates = {}, routePoints = []) {
  return evaluateZoneMatches(GEOFENCES, cleanWaypoints, coordsList, companyRates, routePoints);
}

export async function evaluateHazardGeofences(cleanWaypoints, coordsList, companyRates = {}, routePoints = []) {
  return evaluateZoneMatches(HAZARD_ZONES, cleanWaypoints, coordsList, companyRates, routePoints);
}

export async function evaluateCustomGeofences(_cleanWaypoints, coordsList, companyRates = {}, _resolvedLocations = []) {
  const disabledZoneIds = new Set((companyRates?.geofences?.disabledZones || []).map((id) => String(id)));
  const customZones = (companyRates?.geofences?.customZones || []).filter((zone) => !disabledZoneIds.has(String(zone.id)));
  const pickupPoint = coordsList?.[0] || null;
  const dropoffPoint = coordsList?.[coordsList.length - 1] || null;

  const results = await Promise.all(
    customZones.map(async (zone) => {
      // A locality name is a postal/geocoding label, not proof that a point is
      // inside incorporated city limits. Custom pricing is fail-closed unless
      // the zone has an explicit boundary polygon.
      if (!Array.isArray(zone.shape) || zone.shape.length < 3) return null;
      const containsPickup = pickupPoint ? isPointInPolygon(pickupPoint, zone.shape) : false;
      const containsDropoff = dropoffPoint ? isPointInPolygon(dropoffPoint, zone.shape) : false;
      const anyRoutePointInside = coordsList.some((point) => point && isPointInPolygon(point, zone.shape));

      const pricingMode = zone.pricingMode || (String(zone.feeType || 'percent') === 'flat' ? 'flat_rate' : 'surcharge');
      if (pricingMode === 'flat_rate') {
        if (!containsPickup || !containsDropoff) return null;
        return {
          ...zone,
          charge: { feeType: 'flat', value: Number(zone.price ?? zone.value ?? 0) || 0 },
          containsPickup,
          containsDropoff,
        };
      }

      if (!anyRoutePointInside) return null;
      return {
        ...zone,
        charge: { feeType: zone.surchargeFeeType === 'flat' ? 'flat' : 'percent', value: Number(zone.price ?? zone.value ?? 0) || 0 },
        containsPickup,
        containsDropoff,
      };
    })
  );

  return results.filter(Boolean);
}
