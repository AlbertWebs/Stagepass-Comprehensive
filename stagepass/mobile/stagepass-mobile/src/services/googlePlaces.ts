/**
 * Google Places API (New) – autocomplete and place details.
 * Uses EXPO_PUBLIC_GOOGLE_PLACES_API_KEY. No key = no requests.
 */

const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACES_DETAILS_BASE = 'https://places.googleapis.com/v1/places';

function getApiKey(): string | null {
  return (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY) || null;
}

export function hasGooglePlacesKey(): boolean {
  return !!getApiKey();
}

export type PlaceSuggestion = {
  placeId: string;
  /** Resource name e.g. "places/ChIJ..." */
  place: string;
  /** Main text for list display */
  text: string;
};

export type PlaceDetails = {
  location_name: string;
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  displayName?: string;
};

/** Autocomplete (New): POST with body { input: string }. Returns place predictions only. */
export async function fetchPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
  const key = getApiKey();
  if (!key || !query.trim()) return [];

  const res = await fetch(PLACES_AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
    },
    body: JSON.stringify({ input: query.trim() }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('[Google Places] Autocomplete error', res.status, err);
    return [];
  }

  const data = (await res.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        place?: string;
        text?: { text?: string };
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      };
    }>;
  };

  const list: PlaceSuggestion[] = [];
  for (const s of data.suggestions || []) {
    const p = s.placePrediction;
    if (!p?.placeId) continue;
    const text =
      p.text?.text ||
      [p.structuredFormat?.mainText?.text, p.structuredFormat?.secondaryText?.text].filter(Boolean).join(', ') ||
      p.placeId;
    list.push({
      placeId: p.placeId,
      place: p.place || `places/${p.placeId}`,
      text,
    });
  }
  return list;
}

/** Place Details (New): GET place by placeId, fields location, formattedAddress, displayName. */
export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const key = getApiKey();
  if (!key || !placeId) return null;

  const url = `${PLACES_DETAILS_BASE}/${encodeURIComponent(placeId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'location,formattedAddress,displayName',
    },
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('[Google Places] Details error', res.status, err);
    return null;
  }

  const data = (await res.json()) as {
    location?: { latitude?: number; longitude?: number };
    formattedAddress?: string;
    displayName?: { text?: string };
  };

  const lat = data.location?.latitude;
  const lng = data.location?.longitude;
  const formattedAddress = data.formattedAddress || '';
  const displayName = data.displayName?.text || '';

  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const location_name = formattedAddress || displayName || placeId;
  return {
    location_name,
    latitude: lat,
    longitude: lng,
    formattedAddress,
    displayName,
  };
}
