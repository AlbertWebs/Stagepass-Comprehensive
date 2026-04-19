import { getGoogleMapsApiKey } from '~/services/googlePlaces';

/** OSM/Yandex static endpoints often fail or return blank above ~1024px. */
const MAX_RASTER_DIM = 1024;

/**
 * Do not use https://tile.openstreetmap.org/... as an Image source — OSM blocks many app
 * requests with 403 (tile usage policy). See https://operations.osmfoundation.org/policies/tiles/
 *
 * Static map generators (e.g. staticmap.openstreetmap.de) are separate from the main tile CDN.
 *
 * Note: Do not attach custom headers to these URLs when using expo-image. Google Static Maps
 * and several CDNs reject or mishandle non-browser requests with a custom User-Agent, which
 * caused all previews to fail and fall through to the error placeholder.
 */
export const MAP_PREVIEW_REQUEST_HEADERS = {
  'User-Agent': 'Stagepass/1.0 (https://stagepass.co.ke; in-app map preview)',
  Accept: 'image/*,*/*',
};

/** Preferred: plain remote URI so Static Maps and fallbacks load reliably in expo-image. */
export function mapPreviewImageSource(uri: string): { uri: string } {
  return { uri };
}

/**
 * Ordered list of static map image URLs for a venue pin (try in order on failure).
 * Prefer Google Static Maps when an API key is configured (enable "Maps Static API" in Google Cloud).
 */
export function buildVenueStaticMapPreviewUrls(latitude: number, longitude: number): string[] {
  const lat = latitude.toFixed(6);
  const lon = longitude.toFixed(6);
  const w = Math.min(640, MAX_RASTER_DIM);
  const h = Math.min(400, MAX_RASTER_DIM);

  const urls: string[] = [];

  const key = getGoogleMapsApiKey()?.trim();
  if (key) {
    const marker = encodeURIComponent(`color:0xca8a04|${lat},${lon}`);
    urls.push(
      `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=15&size=480x320&scale=2&maptype=roadmap&markers=${marker}&key=${encodeURIComponent(key)}`
    );
  }

  urls.push(
    `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=15&size=${w}x${h}&markers=${lat},${lon},red-pushpin`
  );
  urls.push(
    `https://static-maps.yandex.ru/1.x/?lang=en-US&ll=${lon},${lat}&z=15&l=map&size=${w},${h}&pt=${lon},${lat},pm2rdm`
  );

  return urls;
}
