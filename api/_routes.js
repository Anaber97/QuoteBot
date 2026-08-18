import { getServerEnv } from './_env.js';
import { decodePolyline } from './_quoteEngine.js';

const parseDuration = (value) => Number.parseFloat(String(value || '0').replace(/s$/, '')) || 0;

export async function computeServerRoute(addresses, { apiKey } = {}) {
  const key = apiKey || getServerEnv('GOOGLE_MAPS_API_KEY');
  if (!key) throw new Error('Missing server-side Google Maps API key.');
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.legs.distanceMeters,routes.legs.duration,routes.legs.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: { address: addresses[0] },
      destination: { address: addresses.at(-1) },
      intermediates: addresses.slice(1, -1).map((address) => ({ address })),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: false,
      languageCode: 'en-US',
      units: 'IMPERIAL',
    }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    const error = new Error(detail?.error?.message || `Google Routes failed (${response.status}).`);
    error.status = response.status === 400 ? 400 : 502;
    throw error;
  }
  const route = (await response.json())?.routes?.[0];
  if (!route?.legs?.length) throw Object.assign(new Error('Google did not return a usable route.'), { status: 400 });
  const legs = route.legs.map((leg) => ({ durationMinutes: parseDuration(leg.duration) / 60, distanceMeters: Number(leg.distanceMeters || 0), points: decodePolyline(leg.polyline?.encodedPolyline) }));
  return {
    totalMeters: Number(route.distanceMeters || legs.reduce((sum, leg) => sum + leg.distanceMeters, 0)),
    rawDriveMinutes: parseDuration(route.duration) / 60,
    legs: legs.map(({ durationMinutes, distanceMeters }) => ({ durationMinutes, distanceMeters })),
    customerRoutePoints: legs.slice(1, addresses.length - 2).flatMap((leg) => leg.points),
  };
}
