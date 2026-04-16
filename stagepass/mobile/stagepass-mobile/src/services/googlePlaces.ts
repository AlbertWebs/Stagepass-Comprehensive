/**
 * Google Places – legacy REST APIs (same as web Maps JavaScript Places Autocomplete).
 * Uses Place Autocomplete (Legacy) + Place Details (Legacy) so mobile matches web results
 * (e.g. "Stagepass" returns the same suggestions).
 * Key from: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY, EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
 * or app.config.js extra.googlePlacesApiKey (e.g. from VITE_GOOGLE_MAPS_API_KEY in .env).
 */

import Constants from 'expo-constants';

const LEGACY_AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const LEGACY_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

function getApiKey(): string | null {
  const fromEnv =
    typeof process !== 'undefined' &&
    (process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);
  if (fromEnv) return fromEnv;
  const fromExtra = (Constants.expoConfig?.extra as { googlePlacesApiKey?: string } | undefined)?.googlePlacesApiKey;
  return fromExtra || null;
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

/**
 * Legacy Place Autocomplete – same product as web (establishment + geocode).
 * Matches Maps JavaScript API Places Autocomplete results.
 */
export async function fetchPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
  const key = getApiKey();
  if (!key || !query.trim()) return [];

  const params = new URLSearchParams({
    input: query.trim(),
    types: 'establishment|geocode',
    key,
  });
  const url = `${LEGACY_AUTOCOMPLETE_URL}?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.text();
    if (__DEV__) console.warn('[Google Places] Autocomplete error', res.status, err);
    return [];
  }

  const data = (await res.json()) as {
    status: string;
    predictions?: Array<{
      place_id?: string;
      description?: string;
      structured_formatting?: { main_text?: string; secondary_text?: string };
    }>;
  };

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    if (__DEV__) console.warn('[Google Places] Autocomplete status', data.status);
    return [];
  }

  const list: PlaceSuggestion[] = [];
  for (const p of data.predictions || []) {
    const placeId = p.place_id;
    if (!placeId) continue;
    const text =
      p.description ||
      [p.structured_formatting?.main_text, p.structured_formatting?.secondary_text].filter(Boolean).join(', ') ||
      placeId;
    list.push({
      placeId,
      place: `places/${placeId}`,
      text,
    });
  }
  return list;
}

/**
 * Legacy Place Details – geometry, formatted_address, name.
 * Same product as web; place_id from legacy autocomplete.
 */
export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const key = getApiKey();
  if (!key || !placeId) return null;

  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'geometry,formatted_address,name',
    key,
  });
  const url = `${LEGACY_DETAILS_URL}?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    const err = await res.text();
    if (__DEV__) console.warn('[Google Places] Details error', res.status, err);
    return null;
  }

  const data = (await res.json()) as {
    status: string;
    result?: {
      geometry?: { location?: { lat: number; lng: number } };
      formatted_address?: string;
      name?: string;
    };
  };

  if (data.status !== 'OK' || !data.result) return null;

  const loc = data.result.geometry?.location;
  const lat = loc?.lat;
  const lng = loc?.lng;
  const formattedAddress = data.result.formatted_address || '';
  const name = data.result.name || '';

  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const location_name = formattedAddress || name || placeId;
  return {
    location_name,
    latitude: lat,
    longitude: lng,
    formattedAddress,
    displayName: name || undefined,
  };
}
