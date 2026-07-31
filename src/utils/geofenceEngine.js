// @ts-check
import { GEOFENCES } from '../config/geofences';

/**
 * Checks if a lat/lng coordinate falls inside a rectangular bounding box
 * @param {number} lat 
 * @param {number} lng 
 * @param {{ minLat: number, maxLat: number, minLng: number, maxLng: number }} box 
 * @returns {boolean}
 */
export const isPointInBox = (lat, lng, box) => {
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
};

/**
 * Checks if a specific geofence matches any location in the addresses or coordinates
 * @param {object} zoneConfig 
 * @param {string[]} addresses 
 * @param {Array<{lat: number, lng: number} | null>} coordsList 
 * @returns {boolean}
 */
const checkSingleZone = (zoneConfig, addresses, coordsList) => {
  // 1. Keyword City Search
  const hasKeyword = addresses.some((addr) =>
    zoneConfig.cities.some((city) => addr.toLowerCase().includes(city.toLowerCase()))
  );
  if (hasKeyword) return true;

  // 2. Direct Lat/Lng Hit on waypoints
  const directHit = coordsList.some((c) => c && isPointInBox(c.lat, c.lng, zoneConfig.box));
  if (directHit) return true;

  return false;
};

/**
 * Scans all 60 registered Metros in GEOFENCES to see if the route touches or passes through any metro
 * @param {string[]} addresses List of address strings
 * @param {Array<{lat: number, lng: number} | null>} coordsList Geocoded lat/lng list
 * @returns {Promise<{ hasMetroHit: boolean, matchedMetros: string[] }>}
 */
export const evaluateRouteGeofences = async (addresses, coordsList) => {
  const matchedMetros = [];

  // Check static hits (Keywords or Direct Point Hits)
  for (const [key, zone] of Object.entries(GEOFENCES)) {
    if (checkSingleZone(zone, addresses, coordsList)) {
      matchedMetros.push(zone.name);
    }
  }

  if (matchedMetros.length > 0) {
    return { hasMetroHit: true, matchedMetros };
  }

  // 3. Fallback: Google Directions Route Path Check
  if (window.google?.maps?.DirectionsService && addresses.length >= 2) {
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
            const legs = result.routes[0].legs || [];

            for (const [key, zone] of Object.entries(GEOFENCES)) {
              const passesThrough = legs.some((leg) => {
                const startIn = isPointInBox(leg.start_location.lat(), leg.start_location.lng(), zone.box);
                const endIn = isPointInBox(leg.end_location.lat(), leg.end_location.lng(), zone.box);
                if (startIn || endIn) return true;

                return (leg.steps || []).some((step) =>
                  (step.path || []).some((pt) => isPointInBox(pt.lat(), pt.lng(), zone.box))
                );
              });

              if (passesThrough) {
                matchedMetros.push(zone.name);
              }
            }
          }
          resolve({
            hasMetroHit: matchedMetros.length > 0,
            matchedMetros,
          });
        }
      );
    });
  }

  return { hasMetroHit: false, matchedMetros: [] };
};