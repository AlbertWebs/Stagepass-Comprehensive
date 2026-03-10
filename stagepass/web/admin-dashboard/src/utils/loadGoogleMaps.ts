/**
 * Load Google Maps JavaScript API with Places library.
 * Set VITE_GOOGLE_MAPS_API_KEY in .env for location search.
 */

declare global {
  interface Window {
    __googleMapsResolve?: () => void;
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
    return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set'));
  }

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      if (window.google?.maps?.places) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => {
        if (window.google?.maps?.places) resolve();
        else reject(new Error('Google Maps loaded but Places not available'));
      });
      return;
    }

    window.__googleMapsResolve = () => {
      if (window.google?.maps?.places) resolve();
      else reject(new Error('Google Maps loaded but Places not available'));
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=__googleMapsResolve`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function hasGoogleMapsKey(): boolean {
  return Boolean((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string)?.trim());
}
