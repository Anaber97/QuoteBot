// src/utils/geofenceEngine.js
// @ts-check
import { GEOFENCES, HAZARD_ZONES } from "../config/geofences";

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

function getZoneMultiplier(zoneConfig, companyRates = {}) {
  const override = companyRates?.geofences?.customZoneRates?.[zoneConfig.id];
  if (override?.multiplier != null) {
    const numeric = Number(override.multiplier);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return zoneConfig.multiplier;
}

export async function checkGeofenceZone(zoneConfig, addresses = [], coordsList = []) {
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

  if (typeof window === 'undefined' || !window.google || !window.google.maps) {
    return false;
  }

  // Check route steps via DirectionsService
  return new Promise((resolve) => {
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: cleanAddresses[0],
        destination: cleanAddresses[cleanAddresses.length - 1],
        waypoints: cleanAddresses.slice(1, -1).map((addr) => ({ location: addr, stopover: true })),
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result?.routes?.[0]) {
          const passesThrough = result.routes[0].legs.some((leg) => {
            const startIn = isPointInBox(leg.start_location.lat(), leg.start_location.lng());
            const endIn = isPointInBox(leg.end_location.lat(), leg.end_location.lng());
            if (startIn || endIn) return true;
            return (leg.steps || []).some((step) =>
              (step.path || []).some((pt) => isPointInBox(pt.lat(), pt.lng()))
            );
          });
          resolve(passesThrough);
        } else {
          resolve(false);
        }
      }
    );
  });
}

async function evaluateZoneMatches(baseZones, cleanWaypoints, coordsList, companyRates = {}) {
  const activeZones = getActiveZones(baseZones, companyRates);
  const results = await Promise.all(
    activeZones.map(async (zone) => {
      const matched = await checkGeofenceZone(zone, cleanWaypoints, coordsList);
      const customShape = companyRates?.geofences?.customZones?.find((item) => item.id === zone.id)?.shape;
      const customPrice = companyRates?.geofences?.customZones?.find((item) => item.id === zone.id)?.price;

      if (!matched && customShape?.length >= 3) {
        const hit = coordsList.some((point) => point && isPointInPolygon(point, customShape));
        if (hit) {
          return { ...zone, multiplier: getZoneMultiplier(zone, companyRates), customPrice };
        }
      }

      return matched ? { ...zone, multiplier: getZoneMultiplier(zone, companyRates), customPrice } : null;
    })
  );
  return results.filter(Boolean);
}

export async function evaluateMetroGeofences(cleanWaypoints, coordsList, companyRates = {}) {
  return evaluateZoneMatches(GEOFENCES, cleanWaypoints, coordsList, companyRates);
}

export async function evaluateHazardGeofences(cleanWaypoints, coordsList, companyRates = {}) {
  return evaluateZoneMatches(HAZARD_ZONES, cleanWaypoints, coordsList, companyRates);
}

export async function evaluateCustomGeofences(cleanWaypoints, coordsList, companyRates = {}) {
  const disabledZoneIds = new Set((companyRates?.geofences?.disabledZones || []).map((id) => String(id)));
  const customZones = (companyRates?.geofences?.customZones || []).filter((zone) => !disabledZoneIds.has(String(zone.id)));

  const results = await Promise.all(
    customZones.map(async (zone) => {
      if (!Array.isArray(zone.shape) || zone.shape.length < 3) return null;
      const matched = coordsList.some((point) => point && isPointInPolygon(point, zone.shape));
      if (!matched) return null;
      return {
        ...zone,
        multiplier: Number(zone.price ?? 0) > 0 ? 1 + Number(zone.price ?? 0) / 100 : 1,
      };
    })
  );

  return results.filter(Boolean);
}