const EARTH_RADIUS_MILES = 3958.8;
const RADIUS_POINT_COUNT = 64;

export function buildRadiusPolygon(center, radiusMiles) {
  const latitude = Number(center?.lat);
  const longitude = Number(center?.lng);
  const radius = Number(radiusMiles);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radius) || radius <= 0) return [];

  const latRadians = latitude * Math.PI / 180;
  const lngRadians = longitude * Math.PI / 180;
  const angularDistance = radius / EARTH_RADIUS_MILES;

  return Array.from({ length: RADIUS_POINT_COUNT }, (_, index) => {
    const bearing = (index / RADIUS_POINT_COUNT) * Math.PI * 2;
    const pointLat = Math.asin(
      Math.sin(latRadians) * Math.cos(angularDistance)
      + Math.cos(latRadians) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const pointLng = lngRadians + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRadians),
      Math.cos(angularDistance) - Math.sin(latRadians) * Math.sin(pointLat)
    );
    return { lat: pointLat * 180 / Math.PI, lng: pointLng * 180 / Math.PI };
  });
}
