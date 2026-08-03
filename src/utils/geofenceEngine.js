// @ts-check
import { GEOFENCES, HAZARD_ZONES } from "../config/geofences";

/**
 * Checks whether any waypoint or route path intersects a geofence zone.
 */
export async function checkGeofenceZone(zoneConfig, addresses, coordsList) {
  const isPointInBox = (lat, lng) => {
    const { box } = zoneConfig;
    return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
  };

  const hasKeyword = addresses.some((addr) =>
    zoneConfig.cities.some((city) => addr.toLowerCase().includes(city))
  );
  if (hasKeyword) return true;

  const directHit = coordsList.some((c) => c && isPointInBox(c.lat, c.lng));
  if (directHit) return true;

  return new Promise((resolve) => {
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: addresses[0],
        destination: addresses[addresses.length - 1],
        waypoints: addresses.slice(1, -1).map((addr) => ({ location: addr, stopover: true })),
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result.routes[0]) {
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

/**
 * Evaluates all Metro geofences for the given trip.
 */
export async function evaluateMetroGeofences(cleanWaypoints, coordsList) {
  const results = await Promise.all(
    Object.values(GEOFENCES).map((zone) => checkGeofenceZone(zone, cleanWaypoints, coordsList))
  );
  return results.some(Boolean);
}

/**
 * Evaluates all Hazard geofences for the given trip.
 */
export async function evaluateHazardGeofences(cleanWaypoints, coordsList) {
  const hazardHits = await Promise.all(
    Object.values(HAZARD_ZONES).map((zone) => checkGeofenceZone(zone, cleanWaypoints, coordsList))
  );
  return hazardHits.some(Boolean);
}