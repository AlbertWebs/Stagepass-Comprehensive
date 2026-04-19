import { PixelRatio } from 'react-native';
import { getGoogleMapsApiKey } from '~/services/googlePlaces';

/** OSM/Yandex static endpoints often fail or return blank above ~1024px. */
const MAX_RASTER_DIM = 1024;

/**
 * Ordered list of static map image URLs for a venue pin (try in order on failure).
 * Prefer Google Static Maps when an API key is configured (reliable on mobile).
 */
export function buildVenueStaticMapPreviewUrls(latitude: number, longitude: number): string[] {
  const lat = latitude.toFixed(6);
  const lon = longitude.toFixed(6);
  const scalePx = Math.min(PixelRatio.get(), 3);
  const w = Math.min(Math.round(900 * scalePx), MAX_RASTER_DIM);
  const h = Math.min(Math.round(520 * scalePx), MAX_RASTER_DIM);

  const urls: string[] = [];

  const key = getGoogleMapsApiKey();
  if (key) {
    const gw = Math.min(640, Math.max(120, Math.round(w / scalePx)));
    const gh = Math.min(640, Math.max(120, Math.round(h / scalePx)));
    const marker = encodeURIComponent(`color:0xca8a04|${lat},${lon}`);
    urls.push(
      `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=15&size=${gw}x${gh}&scale=2&maptype=roadmap&markers=${marker}&key=${encodeURIComponent(key)}`
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
