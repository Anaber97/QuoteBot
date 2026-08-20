import { getServerEnv } from './_env.js';
import { decodePolyline } from './_quoteEngine.js';

const parseDuration = (value) => Number.parseFloat(String(value || '0').replace(/s$/, '')) || 0;

export async function resolveGoogleLocalities(addresses, { apiKey } = {}) {
  const key = apiKey || getServerEnv('GOOGLE_MAPS_API_KEY');
  if (!key) throw new Error('Missing server-side Google Maps API key.');
  return Promise.all((addresses || []).map(async (address) => {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', String(address || ''));
    url.searchParams.set('key', key);
    const response = await fetch(url);
    if (!response.ok) throw Object.assign(new Error(`Google Geocoding failed (${response.status}).`), { status: 502 });
    const payload = await response.json();
    if (payload?.status === 'ZERO_RESULTS') return null;
    if (payload?.status !== 'OK') {
      throw Object.assign(new Error(payload?.error_message || `Google Geocoding failed (${payload?.status || 'unknown status'}).`), { status: 502 });
    }
    const result = payload?.results?.[0];
    if (!result) return null;
    const components = result.address_components || [];
    const component = (...types) => components.find((item) => types.some((type) => item.types?.includes(type)));
    return {
      city: component('locality', 'postal_town', 'administrative_area_level_3', 'sublocality')?.long_name || '',
      state: component('administrative_area_level_1')?.short_name || '',
      formattedAddress: result.formatted_address || String(address || ''),
    };
  }));
}

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
