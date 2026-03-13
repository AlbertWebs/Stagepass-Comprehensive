/**
 * Load Google Maps JavaScript API with Places library.
 * Set VITE_GOOGLE_MAPS_API_KEY in .env for location search.
 */

declare global {
  interface Window {
    __googleMapsResolve?: () => void;
    gm_authFailure?: () => void;
    google?: typeof google;
  }
}

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Not in browser'));
  if (window.google?.maps?.places) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  if (!key?.trim()) {
    return Promise.reject(
      new Error('VITE_GOOGLE_MAPS_API_KEY is not set. Add it to .env and restart the dev server.')
    );
  }

  const timeoutMs = 15000;
  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      if (window.google?.maps?.places) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => {
        if (window.google?.maps?.places) resolve();
        else reject(new Error('Places not available. Enable Places API in Google Cloud Console.'));
      });
      return;
    }

    let settled = false;
    const cleanup = () => {
      settled = true;
      delete window.__googleMapsResolve;
      delete window.gm_authFailure;
    };
    const timeoutId = setTimeout(() => {
      if (settled) return;
      cleanup();
      clearTimeout(timeoutId);
      reject(
        new Error(
          'Google Maps timed out. Enable Maps JavaScript API and Places API (and billing) in Google Cloud Console.'
        )
      );
    }, timeoutMs);

    window.gm_authFailure = () => {
      if (settled) return;
      cleanup();
      clearTimeout(timeoutId);
      reject(
        new Error(
          'Invalid API key or billing disabled. In Google Cloud: (1) Enable Maps JavaScript API and Places API, (2) Enable billing, (3) If using key restrictions, allow this site (e.g. http://localhost:3000).'
        )
      );
    };

    window.__googleMapsResolve = () => {
      if (settled) return;
      cleanup();
      clearTimeout(timeoutId);
      if (window.google?.maps?.places) resolve();
      else reject(new Error('Places not available. Enable Maps JavaScript API and Places API in Google Cloud Console.'));
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=__googleMapsResolve`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      if (settled) return;
      cleanup();
      clearTimeout(timeoutId);
      reject(new Error('Failed to load Google Maps. Check API key and enable Maps JavaScript API and Places API.'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function hasGoogleMapsKey(): boolean {
  return Boolean((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string)?.trim());
}
