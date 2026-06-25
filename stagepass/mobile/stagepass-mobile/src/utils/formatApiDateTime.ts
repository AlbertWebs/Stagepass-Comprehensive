const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Parse API datetime strings. Naive `Y-m-d H:i:s` values from the server are UTC.
 */
export function parseApiDateTime(value?: string | null): Date | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  if (!HAS_TIMEZONE.test(normalized)) {
    normalized += 'Z';
  }

  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatApiTime(
  value?: string | null,
  options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true },
  locale = 'en-US',
): string {
  const d = parseApiDateTime(value);
  if (!d) return '—';
  return d.toLocaleTimeString(locale, options);
}
