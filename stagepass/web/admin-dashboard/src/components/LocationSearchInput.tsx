/**
 * Location input with Google Places Autocomplete.
 * When a place is selected, calls onSelect with { location_name, latitude, longitude }.
 * If VITE_GOOGLE_MAPS_API_KEY is not set, renders a plain text input.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, hasGoogleMapsKey } from '@/utils/loadGoogleMaps';

export type LocationResult = {
  location_name: string;
  latitude: number;
  longitude: number;
};

type LocationSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (result: LocationResult) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
};

interface GooglePlaceGeometry {
  location?: { lat: () => number; lng: () => number };
}
interface GooglePlace {
  formatted_address?: string;
  name?: string;
  geometry?: GooglePlaceGeometry;
}

export function LocationSearchInput({
  value,
  onChange,
  onSelect,
  placeholder = 'Search for a venue or address…',
  id,
  className = 'form-input',
  disabled,
}: LocationSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<{ getPlace: () => GooglePlace } | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);

  const initAutocomplete = useCallback(() => {
    const g = (window as unknown as { google?: { maps: { places: { Autocomplete: new (el: HTMLInputElement, opts: object) => { addListener: (ev: string, fn: () => void) => void; getPlace: () => GooglePlace } } } } }).google;
    if (!inputRef.current || !g?.maps?.places || autocompleteRef.current) return false;

    try {
      const Autocomplete = g.maps.places.Autocomplete;
      const autocomplete = new Autocomplete(inputRef.current, {
        types: ['establishment', 'geocode'],
        fields: ['formatted_address', 'geometry', 'name'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const loc = place.geometry?.location;
        const address = place.formatted_address || place.name || '';
        if (address) onChange(address);
        if (loc && address && onSelect) {
          onSelect({
            location_name: address,
            latitude: typeof loc.lat === 'function' ? loc.lat() : (loc as { lat: number }).lat,
            longitude: typeof loc.lng === 'function' ? loc.lng() : (loc as { lng: number }).lng,
          });
        }
      });

      autocompleteRef.current = autocomplete;
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Places Autocomplete failed';
      setScriptError(msg);
      return false;
    }
  }, [onChange, onSelect]);

  useEffect(() => {
    if (!hasGoogleMapsKey()) {
      setScriptError(null);
      return;
    }
    setScriptError(null);
    loadGoogleMaps()
      .then(() => {
        setScriptLoaded(true);
      })
      .catch((err) => {
        setScriptError(err instanceof Error ? err.message : 'Could not load maps');
      });
  }, []);

  useEffect(() => {
    if (!scriptLoaded) return;
    const tryInit = () => {
      if (inputRef.current && !autocompleteRef.current) initAutocomplete();
    };
    tryInit();
    const id = window.setTimeout(tryInit, 150);
    return () => {
      clearTimeout(id);
      autocompleteRef.current = null;
    };
  }, [scriptLoaded, initAutocomplete]);

  const handleFocus = useCallback(() => {
    if (scriptLoaded && inputRef.current && !autocompleteRef.current) initAutocomplete();
  }, [scriptLoaded, initAutocomplete]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        placeholder={hasGoogleMapsKey() ? placeholder : 'Venue or address (set VITE_GOOGLE_MAPS_API_KEY for search)'}
        className={className}
        disabled={disabled}
        autoComplete="off"
      />
      {scriptError && (
        <p className="mt-1 text-xs text-amber-700">
          <span className="font-medium">Google Maps could not load.</span> {scriptError}
          {' '}<a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline">Fix in Google Cloud Console</a>
          {' '}— enable Maps JavaScript API + Places API, turn on billing, and if using key restrictions add <code className="text-[10px] bg-amber-100 px-0.5">http://localhost:3000</code>. You can still type an address below.
        </p>
      )}
    </div>
  );
}
