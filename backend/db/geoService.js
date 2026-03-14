/**
 * Haversine formula
 * Calculates the straight-line distance (metres) between two GPS coordinates.
 */
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth radius in metres
  const toRad = (d) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * isWithinGeofence
 * Returns { allowed: boolean, distanceM: number }
 */
const isWithinGeofence = (studentLat, studentLng, classLat, classLng) => {
  const radius = Number(process.env.GEOFENCE_RADIUS_METERS) || 100;
  const distanceM = haversineDistance(studentLat, studentLng, classLat, classLng);
  return {
    allowed: distanceM <= radius,
    distanceM: Math.round(distanceM),
  };
};

module.exports = { isWithinGeofence };