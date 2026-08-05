// src/utils/geofenceEngine.js
// @ts-check
import { GEOFENCES, HAZARD_ZONES } from "../config/geofences";

function getActiveZones(baseZones, companyRates = {}) {
  const disabledZoneIds = new Set((companyRates?.geofences?.disabledZones || []).map((id) => String(id)));
  return Object.values(baseZones).filter((zone) => !disabledZoneIds.has(String(zone.id)));
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

export async function evaluateMetroGeofences(cleanWaypoints, coordsList, companyRates = {}) {
  const activeZones = getActiveZones(GEOFENCES, companyRates);
  const results = await Promise.all(
    activeZones.map((zone) => checkGeofenceZone(zone, cleanWaypoints, coordsList))
  );
  return results.some(Boolean);
}

export async function evaluateHazardGeofences(cleanWaypoints, coordsList, companyRates = {}) {
  const activeZones = getActiveZones(HAZARD_ZONES, companyRates);
  const results = await Promise.all(
    activeZones.map((zone) => checkGeofenceZone(zone, cleanWaypoints, coordsList))
  );
  return results.some(Boolean);
}