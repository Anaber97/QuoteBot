import { getServerEnv } from './_env.js';

const MATRIX_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
const parseSeconds = (value) => Number.parseFloat(String(value || '0').replace(/s$/, '')) || 0;

async function routeMatrix(origins, destinations, { key, fetchImpl }) {
  const response = await fetchImpl(MATRIX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition',
    },
    body: JSON.stringify({
      origins: origins.map((address) => ({ waypoint: { address } })),
      destinations: destinations.map((address) => ({ waypoint: { address } })),
      travelMode: 'DRIVE',
      // Ranking only: yards are compared on typical drive time, which is billed at the
      // lower route-matrix rate. The chosen yard is always re-priced with live traffic.
      routingPreference: 'TRAFFIC_UNAWARE',
    }),
  });
  if (!response.ok) throw Object.assign(new Error(`Google route matrix failed (${response.status}).`), { status: 502 });
  const elements = await response.json();
  return Array.isArray(elements) ? elements : [];
}

/**
 * Drive from every yard to the pickup and from the drop-off back to every yard.
 * The loaded run between pickup and drop-off is the same from any yard, so only these
 * two legs decide which yard is cheapest. Uses 2 × yards matrix elements.
 */
export async function compareYardLegs(bases, pickup, dropoff, { apiKey, fetchImpl = fetch } = {}) {
  const key = apiKey || getServerEnv('GOOGLE_MAPS_API_KEY');
  if (!key) throw new Error('Missing server-side Google Maps API key.');
  const yards = (bases || []).filter((base) => base?.id != null && String(base.address || '').trim());
  if (yards.length < 2 || !pickup || !dropoff) return [];

  const addresses = yards.map((base) => String(base.address));
  const [outbound, inbound] = await Promise.all([
    routeMatrix(addresses, [pickup], { key, fetchImpl }),
    routeMatrix([dropoff], addresses, { key, fetchImpl }),
  ]);
  const leg = (elements, indexKey, index) => {
    const element = elements.find((item) => Number(item?.[indexKey] ?? 0) === index);
    return element && element.condition === 'ROUTE_EXISTS'
      ? { minutes: parseSeconds(element.duration) / 60, meters: Number(element.distanceMeters || 0) }
      : null;
  };

  return yards.map((base, index) => {
    const out = leg(outbound, 'originIndex', index);
    const back = leg(inbound, 'destinationIndex', index);
    return out && back ? {
      id: String(base.id),
      name: String(base.name || base.address),
      outMinutes: out.minutes,
      backMinutes: back.minutes,
      outMeters: out.meters,
      backMeters: back.meters,
    } : null;
  }).filter(Boolean);
}
