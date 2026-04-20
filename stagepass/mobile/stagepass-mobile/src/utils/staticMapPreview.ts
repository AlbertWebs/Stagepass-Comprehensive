import { getGoogleMapsApiKey } from '~/services/googlePlaces';

/**
 * OSM/Yandex: keep the proven 640×400 request — larger or extreme-aspect sizes have caused
 * blank/failed images in production; sharpness comes primarily from Google Static Maps.
 */
const FALLBACK_MAP_W = 640;
const FALLBACK_MAP_H = 400;

/**
 * Google Static Maps: each `size` dimension must be ≤ 640; `scale=2` returns up to 1280px per side.
 * https://developers.google.com/maps/documentation/maps-static/start
 */
const GOOGLE_MAX_SIDE = 640;

/** If aspect math yields a side this small, Google often rejects the request — use a safe preset. */
const GOOGLE_MIN_SIDE = 80;

export type StaticMapPreviewOptions = {
  /**
   * Target width/height in **physical pixels** (e.g. `Math.round(width * PixelRatio.get())`)
   * so the raster is not upscaled on full-bleed screens.
   */
  widthPx?: number;
  heightPx?: number;
  /** Optional venue/geofence area radius in meters used to fit the map to area, not fixed zoom. */
  areaRadiusMeters?: number;
  /** Optional fixed city preset for a consistently zoomed-out map viewport. */
  cityPreset?: 'nairobi';
};

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

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function sanitizeAreaRadiusMeters(radius: number | undefined): number {
  if (typeof radius !== 'number' || !Number.isFinite(radius) || radius <= 0) return 120;
  return Math.min(50000, Math.max(40, radius));
}

function latitudeDeltaForMeters(radiusMeters: number): number {
  const metersPerDegreeLat = 111_320;
  return radiusMeters / metersPerDegreeLat;
}

function longitudeDeltaForMeters(radiusMeters: number, latitude: number): number {
  const latRad = (latitude * Math.PI) / 180;
  const metersPerDegreeLon = Math.max(1, 111_320 * Math.cos(latRad));
  return radiusMeters / metersPerDegreeLon;
}

function fallbackZoomForArea(radiusMeters: number, imageWidthPx: number, latitude: number): number {
  const latRad = (latitude * Math.PI) / 180;
  const metersPerPixelAtZoom0 = 156543.03392 * Math.cos(latRad);
  const targetDiameterMeters = radiusMeters * 2.4; // small breathing room around area
  const targetMetersPerPixel = targetDiameterMeters / Math.max(1, imageWidthPx);
  const rawZoom = Math.log2(metersPerPixelAtZoom0 / Math.max(0.01, targetMetersPerPixel));
  return clampInt(rawZoom, 1, 20);
}

/** Normalize optional pixel size (guards 0×window, NaN, first-frame layout). */
function sanitizeTargetPixels(widthPx: number | undefined, heightPx: number | undefined): { w: number; h: number } {
  const fallbackW = 1080;
  const fallbackH = 1920;
  const w =
    typeof widthPx === 'number' && Number.isFinite(widthPx) && widthPx >= 1 ? Math.min(widthPx, 8192) : fallbackW;
  const h =
    typeof heightPx === 'number' && Number.isFinite(heightPx) && heightPx >= 1 ? Math.min(heightPx, 8192) : fallbackH;
  return { w, h };
}

/** Largest Google `size=` (each side ≤ 640) matching viewport aspect ratio. */
function googleStaticSize(widthPx: number, heightPx: number): { w: number; h: number } {
  const aw = Math.max(1, widthPx);
  const ah = Math.max(1, heightPx);
  const aspect = aw / ah;
  let w: number;
  let h: number;
  if (aspect >= 1) {
    w = GOOGLE_MAX_SIDE;
    h = clampInt(GOOGLE_MAX_SIDE / aspect, 1, GOOGLE_MAX_SIDE);
  } else {
    h = GOOGLE_MAX_SIDE;
    w = clampInt(GOOGLE_MAX_SIDE * aspect, 1, GOOGLE_MAX_SIDE);
  }
  if (Math.min(w, h) < GOOGLE_MIN_SIDE) {
    return { w: 480, h: 320 };
  }
  return { w, h };
}

/**
 * Ordered list of static map image URLs for a venue pin (try in order on failure).
 * Prefer Google Static Maps when an API key is configured (enable "Maps Static API" in Google Cloud).
 *
 * Pass **physical** width/height when the image is shown full-screen so Google returns enough
 * pixels for the device scale. OSM/Yandex use a fixed 640×400 image (reliable); `contentFit="cover"`
 * still fills the screen.
 */
export function buildVenueStaticMapPreviewUrls(
  latitude: number,
  longitude: number,
  options?: StaticMapPreviewOptions
): string[] {
  const lat = latitude.toFixed(6);
  const lon = longitude.toFixed(6);

  const { w: tw, h: th } = sanitizeTargetPixels(options?.widthPx, options?.heightPx);
  const googleDims = googleStaticSize(tw, th);
  const areaRadiusMeters = sanitizeAreaRadiusMeters(options?.areaRadiusMeters);
  const areaLatDelta = latitudeDeltaForMeters(areaRadiusMeters);
  const areaLonDelta = longitudeDeltaForMeters(areaRadiusMeters, latitude);
  const cityPreset = options?.cityPreset;
  const bounds =
    cityPreset === 'nairobi'
      ? {
          north: -1.1635,
          south: -1.4445,
          east: 37.1067,
          west: 36.6509,
          centerLat: -1.286389,
          centerLon: 36.817223,
          fallbackZoom: 8,
        }
      : {
          north: latitude + areaLatDelta,
          south: latitude - areaLatDelta,
          east: longitude + areaLonDelta,
          west: longitude - areaLonDelta,
          centerLat: latitude,
          centerLon: longitude,
          fallbackZoom: fallbackZoomForArea(areaRadiusMeters, FALLBACK_MAP_W, latitude),
        };
  const north = bounds.north.toFixed(6);
  const south = bounds.south.toFixed(6);
  const east = bounds.east.toFixed(6);
  const west = bounds.west.toFixed(6);
  const centerLat = bounds.centerLat.toFixed(6);
  const centerLon = bounds.centerLon.toFixed(6);
  const fallbackZoom = bounds.fallbackZoom;

  const urls: string[] = [];

  const key = getGoogleMapsApiKey()?.trim();
  if (key) {
    const marker = encodeURIComponent(`color:0xca8a04|${lat},${lon}`);
    if (cityPreset === 'nairobi') {
      urls.push(
        `https://maps.googleapis.com/maps/api/staticmap?center=${centerLat},${centerLon}&zoom=8&size=${googleDims.w}x${googleDims.h}&scale=2&maptype=roadmap&markers=${marker}&key=${encodeURIComponent(key)}`
      );
    } else {
      const visibleArea = encodeURIComponent(`${north},${lon}|${south},${lon}|${lat},${east}|${lat},${west}`);
      urls.push(
        `https://maps.googleapis.com/maps/api/staticmap?size=${googleDims.w}x${googleDims.h}&scale=2&maptype=roadmap&visible=${visibleArea}&markers=${marker}&key=${encodeURIComponent(key)}`
      );
    }
  }

  urls.push(
    `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLon}&zoom=${fallbackZoom}&size=${FALLBACK_MAP_W}x${FALLBACK_MAP_H}&markers=${lat},${lon},red-pushpin`
  );
  urls.push(
    `https://static-maps.yandex.ru/1.x/?lang=en-US&ll=${centerLon},${centerLat}&z=${fallbackZoom}&l=map&size=${FALLBACK_MAP_W},${FALLBACK_MAP_H}&pt=${lon},${lat},pm2rdm`
  );

  return urls;
}
