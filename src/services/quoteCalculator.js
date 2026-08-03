// src/services/quoteCalculator.js
// @ts-check
import { RATES } from '../config/rates';
import { evaluateMetroGeofences, evaluateHazardGeofences } from '../utils/geofenceEngine';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export const roundToNearest = (val, interval = RATES.ROUNDING_INTERVAL) =>
  Math.round(val / interval) * interval;

/**
 * Geocodes an array of address strings to Lat/Lng coordinates.
 */
export const geocodeAll = async (addresses) => {
  const geocoder = new window.google.maps.Geocoder();
  return Promise.all(
    addresses.map(
      (addr) =>
        new Promise((resolve) => {
          if (!addr.trim()) return resolve(null);
          geocoder.geocode({ address: addr }, (results, status) => {
            if (status === 'OK' && results[0]) {
              const loc = results[0].geometry.location;
              resolve({ lat: loc.lat(), lng: loc.lng() });
            } else {
              resolve(null);
            }
          });
        })
    )
  );
};

/**
 * Fetches Distance Matrix leg durations and calculates total job hours & base quotes.
 */
export async function calculateQuoteData({
  currentBase,
  waypoints,
  isHeavy,
  isAfterHours,
  isRoadClub,
  isMetro,
  isHazard,
}) {
  const cleanWaypoints = waypoints.map((w) => w.trim()).filter(Boolean);
  if (cleanWaypoints.length < 2) {
    throw new Error('Please enter at least a Pick-up and Drop-off location.');
  }

  const origin = encodeURIComponent(currentBase.address);
  const destination = encodeURIComponent(currentBase.address);
  const waypointsParam = cleanWaypoints.map((addr) => encodeURIComponent(addr)).join('|');
  const mapUrl = `https://www.google.com/maps/embed/v1/directions?key=$${GOOGLE_MAPS_API_KEY}&origin=${origin}&destination=${destination}&waypoints=${waypointsParam}&mode=driving`;

  // Geocode addresses and evaluate geofences concurrently
  const coordsList = await geocodeAll(cleanWaypoints);
  const [hitMetroZone, hitHazardZone] = await Promise.all([
    evaluateMetroGeofences(cleanWaypoints, coordsList),
    evaluateHazardGeofences(cleanWaypoints, coordsList),
  ]);

  // Route: Base -> Waypoint 1 -> ... -> Waypoint N -> Base
  const routePoints = [currentBase.address, ...cleanWaypoints, currentBase.address];
  const distanceService = new window.google.maps.DistanceMatrixService();

  const matrixPromises = routePoints.slice(0, -1).map((originPt, i) => {
    const destPt = routePoints[i + 1];
    return new Promise((resolve, reject) => {
      distanceService.getDistanceMatrix(
        {
          origins: [originPt],
          destinations: [destPt],
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (resData, status) => {
          if (status === 'OK') resolve({ index: i, data: resData });
          else reject(status);
        }
      );
    });
  });

  const matrixResults = await Promise.all(matrixPromises);
  matrixResults.sort((a, b) => a.index - b.index);

  let totalDriveSeconds = 0;
  const legsDetails = [];

  matrixResults.forEach(({ index: i, data }) => {
    const legSec = data.rows[0].elements[0].duration.value;
    totalDriveSeconds += legSec;

    let label = `Leg ${i + 1}`;
    if (i === 0) label = 'Base → Pick-up';
    else if (i === routePoints.length - 2) label = 'Drop-off → Base';
    else if (i === 1) label = 'Pick-up → Stop 1';
    else label = `Stop ${i - 1} → Stop ${i}`;

    legsDetails.push({ label, minutes: Math.round(legSec / 60) });
  });

  // Math Buffers & Hours Calculation
  const totalDriveMinutes = totalDriveSeconds / 60;
  const adjustedDriveMinutes = totalDriveMinutes * RATES.DRIVE_TIME_BUFFER;
  const loadUnloadTime =
    RATES.LOAD_UNLOAD_BASE_MINS + (cleanWaypoints.length - 2) * RATES.EXTRA_STOP_MINS;
  const totalJobMinutes = adjustedDriveMinutes + loadUnloadTime;
  const totalHours = totalJobMinutes / 60;

  const minRate = isHeavy ? RATES.HEAVY_HOURLY_MIN : RATES.HOURLY_MIN;
  const maxRate = isHeavy ? RATES.HEAVY_HOURLY_MAX : RATES.HOURLY_MAX;

  return {
    mapUrl,
    quoteData: {
      cleanWaypoints,
      legsDetails,
      adjustedDriveMin: Math.round(adjustedDriveMinutes),
      loadUnloadTime,
      rawTotalHours: totalHours,
      totalHours: totalHours.toFixed(2),
      isHeavy,
      baseMinQuote: roundToNearest(totalHours * minRate),
      baseMaxQuote: roundToNearest(totalHours * maxRate),
      hasAfterHours: isAfterHours,
      hasRoadClub: isRoadClub,
      hasMetroZone: hitMetroZone || isMetro,
      hasHazardZone: hitHazardZone || isHazard,
    },
  };
}

/**
 * Calculates effective multiplier and final min/max/custom pricing.
 */
export function calculateFinalQuotes(quoteData, activeOverrides, customRate) {
  if (!quoteData) return { currentMinQuote: 0, currentMaxQuote: 0, customCalculatedQuote: null, effectiveMultiplier: 1.0 };

  let effectiveMultiplier = 1.0;
  if (quoteData.hasAfterHours && activeOverrides.afterHours) effectiveMultiplier *= RATES.AFTER_HOURS_MULTIPLIER;
  if (quoteData.hasRoadClub && activeOverrides.roadClub) effectiveMultiplier *= RATES.ROAD_CLUB_MULTIPLIER;
  if (quoteData.hasMetroZone && activeOverrides.metro) effectiveMultiplier *= RATES.METRO_MULTIPLIER;
  if (quoteData.hasHazardZone && activeOverrides.hazard) effectiveMultiplier *= 1.40;

  const baseMinRate = quoteData.isHeavy ? RATES.HEAVY_HOURLY_MIN : RATES.HOURLY_MIN;
  const baseMaxRate = quoteData.isHeavy ? RATES.HEAVY_HOURLY_MAX : RATES.HOURLY_MAX;

  const currentMinQuote = roundToNearest(quoteData.rawTotalHours * baseMinRate * effectiveMultiplier);
  const currentMaxQuote = roundToNearest(quoteData.rawTotalHours * baseMaxRate * effectiveMultiplier);
  
  const customCalculatedQuote =
    customRate && !isNaN(parseFloat(customRate))
      ? roundToNearest(quoteData.rawTotalHours * parseFloat(customRate) * effectiveMultiplier)
      : null;

  return { currentMinQuote, currentMaxQuote, customCalculatedQuote, effectiveMultiplier };
}