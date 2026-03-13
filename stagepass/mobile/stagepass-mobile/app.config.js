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
const googlePlacesApiKey =
  env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
  env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  env.VITE_GOOGLE_MAPS_API_KEY;

const appJson = require('./app.json');
module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo?.extra || {}),
      googlePlacesApiKey: googlePlacesApiKey || undefined,
    },
  },
};
