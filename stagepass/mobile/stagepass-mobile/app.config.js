/**
 * Expo config. Loads .env so Google Places key can come from
 * EXPO_PUBLIC_GOOGLE_PLACES_API_KEY or VITE_GOOGLE_MAPS_API_KEY.
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  try {
    fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) return;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      env[key] = val;
    });
  } catch (_) {}
  return env;
}

const env = loadEnv();

if (process.env.EAS_BUILD_PROFILE === 'production') {
  const hasApiUrl = !!(env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL);
  if (!hasApiUrl) {
    console.warn(
      '\n[Stagepass] Production EAS build: EXPO_PUBLIC_API_URL is not set. Add it in expo.dev → Project → Environment variables (production), e.g. https://api.yourdomain.com\n'
    );
  }
}

const googlePlacesApiKey =
  env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
  env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  env.VITE_GOOGLE_MAPS_API_KEY;

const appJson = require('./app.json');

/** EAS sets this for `eas build --profile production` (undefined for local `expo start`). */
const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production';

/**
 * Production: disable HTTP cleartext (HTTPS-only) for security and Play policy.
 * Preview/dev: allow cleartext so EXPO_PUBLIC_API_URL can be http:// for emulators/LAN.
 */
function mapPlugins(plugins) {
  if (!Array.isArray(plugins)) return plugins;
  return plugins.map((entry) => {
    if (Array.isArray(entry) && entry[0] === 'expo-build-properties') {
      const prev = typeof entry[1] === 'object' && entry[1] !== null ? entry[1] : {};
      const prevAndroid = prev.android && typeof prev.android === 'object' ? prev.android : {};
      return [
        'expo-build-properties',
        {
          ...prev,
          android: {
            ...prevAndroid,
            usesCleartextTraffic: isProductionBuild ? false : prevAndroid.usesCleartextTraffic !== false,
          },
        },
      ];
    }
    return entry;
  });
}

module.exports = {
  expo: {
    ...appJson.expo,
    /** EAS Update — required for builds when using EAS Update. https://expo.fyi/eas-update-config */
    updates: {
      url: 'https://u.expo.dev/9c5ebab6-be53-4719-b5ef-704d71b23691',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    plugins: mapPlugins(appJson.expo.plugins),
    extra: {
      ...(appJson.expo?.extra || {}),
      eas: {
        ...((appJson.expo?.extra && appJson.expo.extra.eas) || {}),
        projectId: '9c5ebab6-be53-4719-b5ef-704d71b23691',
      },
      googlePlacesApiKey: googlePlacesApiKey || undefined,
      /** Read at runtime for diagnostics (optional). */
      easBuildProfile: process.env.EAS_BUILD_PROFILE || null,
    },
  },
};
