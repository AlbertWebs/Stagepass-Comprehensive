/**
 * Office / daily check-in location: 100 m radius (override with EXPO_PUBLIC_OFFICE_CHECKIN_RADIUS_M).
 * Set in .env from your office location (e.g. from Google Maps link).
 * Example: https://maps.app.goo.gl/wZg18AJBwUt9kJdj7 → get lat/lng from Maps and set below.
 */
function parseNum(value: string | undefined): number | null {
  if (value == null || value === '') return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export const OFFICE_CHECKIN_RADIUS_METERS = 100;

export function getOfficeCheckinConfig(): {
  latitude: number;
  longitude: number;
  radiusMeters: number;
} | null {
  const lat = parseNum(process.env.EXPO_PUBLIC_OFFICE_CHECKIN_LAT);
  const lng = parseNum(process.env.EXPO_PUBLIC_OFFICE_CHECKIN_LNG);
  if (lat == null || lng == null) return null;
  const radius = parseNum(process.env.EXPO_PUBLIC_OFFICE_CHECKIN_RADIUS_M);
  return {
    latitude: lat,
    longitude: lng,
    radiusMeters: radius != null && radius > 0 ? radius : OFFICE_CHECKIN_RADIUS_METERS,
  };
}
