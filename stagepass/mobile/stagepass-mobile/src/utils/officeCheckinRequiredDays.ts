/** Default: Monday–Friday (aligned with backend OfficeCheckinRequiredDays). */
export const DEFAULT_OFFICE_CHECKIN_REQUIRED_DAYS = [1, 2, 3, 4, 5];

/**
 * Weekdays when office check-in is required: 0 = Sunday … 6 = Saturday (Date.getDay()).
 * Accepts API array or JSON string from settings store.
 */
export function parseOfficeCheckinRequiredDays(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    const days = raw.map(Number).filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6);
    return days.length > 0 ? [...new Set(days)].sort((a, b) => a - b) : [...DEFAULT_OFFICE_CHECKIN_REQUIRED_DAYS];
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      const a = JSON.parse(raw) as unknown;
      if (Array.isArray(a)) {
        const days = a.map(Number).filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6);
        return days.length > 0 ? [...new Set(days)].sort((a, b) => a - b) : [...DEFAULT_OFFICE_CHECKIN_REQUIRED_DAYS];
      }
    } catch {
      /* ignore */
    }
  }
  return [...DEFAULT_OFFICE_CHECKIN_REQUIRED_DAYS];
}
