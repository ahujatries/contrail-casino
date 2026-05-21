/**
 * Great-circle distance in nautical miles.
 */
export const haversineNm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 3440.065; // Earth radius in nm
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Initial bearing in degrees true from point 1 to point 2.
 */
export const bearingDeg = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

/**
 * Shortest signed angular difference (a - b) in degrees, in [-180, 180].
 */
export const angleDiffDeg = (a: number, b: number): number => {
  let d = ((a - b) % 360 + 540) % 360 - 180;
  return d;
};

/**
 * Minutes until aircraft reaches the airport, given current speed.
 * Returns null if not enough data or speed is implausible.
 */
export const etaMinutes = (
  aircraftLat: number,
  aircraftLng: number,
  airportLat: number,
  airportLng: number,
  velocityKt: number | null
): number | null => {
  if (velocityKt == null || velocityKt < 60) return null;
  const dist = haversineNm(aircraftLat, aircraftLng, airportLat, airportLng);
  return (dist / velocityKt) * 60;
};
