# Stagepass – Hosting the Three Applications Separately

This guide covers deploying the **Laravel API** (cPanel), **Web Admin Dashboard** (Vercel), and **Mobile App** (Expo/App stores or standalone) so they work together in production.

---

## Overview

| Application      | Hosting     | Purpose                          |
|------------------|------------|-----------------------------------|
| **Laravel API**  | cPanel     | Backend: auth, events, crew, API |
| **Web Admin**    | Vercel     | Admin dashboard (React/Vite)      |
| **Mobile App**   | Expo / stores | Crew app (React Native/Expo)   |

The web and mobile apps must point their **API base URL** to your hosted Laravel API.

---

## 1. Laravel API on cPanel

### Prerequisites
- cPanel hosting with **PHP 8.1+** and **MySQL**
- SSH or File Manager + PHP selector (if available)

### API server access

- SSH host: `s94.etcserver.com`
- SSH user: `stagepassco`
- Expected port: `22` (unless cPanel lists a custom SSH port)
- Connect interactively with `ssh -p 22 stagepassco@s94.etcserver.com`; never put the account password in this guide, a shell command, or the repository.
- SSH was not reachable from the development workstation on 2026-11-25: port 22 and common alternate ports (2022, 2222, 22022) did not accept a TCP connection. Enable SSH access for the cPanel account, check the server firewall/IP allowlist, and confirm the port in cPanel before retrying. HTTPS availability does not mean SSH is enabled.

### Steps

1. **Upload the API**
   - From your project, upload the contents of `stagepass/backend/laravel-api/` to a folder on the server (e.g. `public_html/api` or a subdomain like `api.yourdomain.com`).
   - Do **not** upload `node_modules`, `.git`, or other dev-only folders.

2. **Document root**
   - Point the domain/subdomain **document root** to the Laravel **`public`** folder (e.g. `public_html/api/public`).  
   - This is required so `index.php` is served and the rest of the app stays outside the web root.

3. **Environment**
   - In the project root (one level above `public`), copy `.env.example` to `.env`.
   - Generate key: run `php artisan key:generate` (via SSH or cPanel “Run PHP script” if available).
   - Configure at least:
     - `APP_ENV=production`
     - `APP_DEBUG=false`
     - `APP_URL=https://your-api-domain.com`
     - Database: `DB_CONNECTION=mysql`, `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
     - `SESSION_DOMAIN` if you need cross-subdomain cookies (optional for API-only).

4. **Database**
   - Create a MySQL database and user in cPanel.
   - Run migrations: `php artisan migrate --force`.
   - Seed defaults (admin user, roles): `php artisan db:seed --force`.
   - Change default passwords and PINs after first login.

5. **Permissions**
   - Ensure `storage` and `bootstrap/cache` are writable by the web server (e.g. `chmod -R 775 storage bootstrap/cache`).

6. **CORS**
   - Your API must allow requests from the Vercel domain and (for mobile) from the app’s origin. In Laravel, check `config/cors.php` and set `allowed_origins` to include:
     - `https://your-vercel-admin.vercel.app` (and custom domain if any)
     - For mobile, if you use a web build or in-app browser, add that origin too.

7. **HTTPS**
   - Use SSL for the API (Let’s Encrypt in cPanel). Set `APP_URL` to `https://...`.

### Firebase Cloud Messaging (Android push)

The Laravel API sends Android pushes through the [FCM HTTP v1 API](https://firebase.google.com/docs/cloud-messaging/send/v1-api). This project reads `FIREBASE_CREDENTIALS` and optional `FIREBASE_CA_BUNDLE` from the API server's Laravel environment; setting only `GOOGLE_APPLICATION_CREDENTIALS` is not sufficient for this sender.

1. Store the Firebase service-account JSON outside the web root and outside Git. Give the PHP process read access without making the file publicly downloadable.
2. Set the production API `.env` values (use the actual absolute path on the server):

   ```env
   FIREBASE_CREDENTIALS=/absolute/private/path/firebase-service-account.json
   FIREBASE_CA_BUNDLE=
   ```

   The service account's `project_id` must be `stagepassav-4b3f2`. For Linux hosting, leave `FIREBASE_CA_BUNDLE` blank to use the system CA store, or set it to a valid CA bundle path on that server. Do not reuse the Windows CA bundle used by a local Windows environment.

3. In Google Cloud Console for `stagepassav-4b3f2`, enable **Firebase Cloud Messaging API (V1)** and grant the service account **Firebase Cloud Messaging API Admin** (`roles/firebasecloudmessaging.admin`). The service uses the `https://www.googleapis.com/auth/firebase.messaging` OAuth scope. See Firebase's [server environment guide](https://firebase.google.com/docs/cloud-messaging/server-environment) and [FCM IAM roles](https://docs.cloud.google.com/iam/docs/roles-permissions/firebasecloudmessaging) for authorization details.
4. Allow outbound HTTPS on port 443 to `oauth2.googleapis.com` and `fcm.googleapis.com`; ensure the server's CA certificates are current.
5. After updating `.env`, run `php artisan config:clear` then `php artisan config:cache` from the Laravel project root. Restart long-running PHP/queue workers so they load the new configuration.
6. Verify the mobile app package and `google-services.json` belong to the same Firebase project (`com.stagepass.spmobile`). A recipient must have notifications allowed and a current native FCM token stored on their user record. Opening the latest installed app and signing in refreshes that token.

**Troubleshooting:** `FCM: failed to get OAuth2 token` points to the server credential, CA, or outbound-network setup. An FCM `SENDER_ID_MISMATCH` or invalid registration token points to the recipient's stored device token or a Firebase project mismatch. Check `storage/logs/laravel.log` for the failing response; never include private keys, OAuth tokens, or full device tokens in a support log excerpt.

**API base URL for the next steps:**  
`https://your-api-domain.com`  
(no trailing slash; the app will append `/api/...` or your route prefix.)

---

## 2. Web Admin Dashboard on Vercel

### Prerequisites
- Vercel account
- Git repo connected to Vercel (or Vercel CLI)

### Steps

1. **Build settings**
   - **Root Directory:** `stagepass/web/admin-dashboard` (or your repo path to the web app).
   - **Framework Preset:** Vite.
   - **Build Command:** `npm run build` (or `yarn build`).
   - **Output Directory:** `dist` (default for Vite).
   - **Install Command:** `npm install` (or `yarn`).

2. **Environment variables** (in Vercel → Project → Settings → Environment Variables)
   - **`VITE_API_URL`** = `https://your-api-domain.com`  
     (your Laravel API base URL; no trailing slash.)
   - Optional: **`VITE_GOOGLE_MAPS_API_KEY`** for location search.

3. **Deploy**
   - Push to your connected branch or run `vercel --prod` from the web admin root.
   - After deploy, the dashboard will call the API at `VITE_API_URL`.

4. **Custom domain (optional)**
   - In Vercel, add your domain and follow DNS instructions.

5. **CORS**
   - Ensure the Laravel API allows your Vercel origin (e.g. `https://your-project.vercel.app` and your custom domain).

---

## 3. Mobile App (Expo / Standalone)

The mobile app talks to the same Laravel API. You don’t “host” the app in the same way; you **build** it and distribute via app stores or internal distribution, with the API URL set at build time.

### Option A: Expo Application Services (EAS) Build

1. **Configure API URL**
   - In `stagepass/mobile/stagepass-mobile/.env` (or EAS secrets), set:
     - **`EXPO_PUBLIC_API_URL`** = `https://your-api-domain.com`  
       (same API as above; no trailing slash.)

2. **EAS Build**
   - Install EAS CLI: `npm i -g eas-cli` and log in.
   - In the mobile app directory, run `eas build --platform all` (or `ios` / `android`).
   - EAS uses the env vars (or secrets) at build time so the app is built with the correct API URL.

3. **Submit to stores (optional)**
   - `eas submit` for App Store / Play Store, or distribute the built binaries internally.

### Option B: Local / manual build

1. **.env**
   - In `stagepass/mobile/stagepass-mobile/`, create or edit `.env`:
     - `EXPO_PUBLIC_API_URL=https://your-api-domain.com`

2. **Build**
   - For a development build: `npx expo run:ios` or `npx expo run:android` (with device/emulator pointing at the same API).
   - For production builds, use EAS or your existing process; ensure the same `EXPO_PUBLIC_API_URL` is used when building.

3. **CORS / API**
   - Mobile apps often use native HTTP, so CORS is less relevant, but the API must be reachable over HTTPS from devices (no mixed content; valid SSL).

---

## Summary Checklist

| Step | API (cPanel) | Web Admin (Vercel) | Mobile |
|------|----------------|--------------------|--------|
| 1 | Upload Laravel to server, document root = `public` | Set root to web app folder | Set `EXPO_PUBLIC_API_URL` in .env or EAS |
| 2 | `.env`: DB, `APP_URL`, `APP_KEY` | Env: `VITE_API_URL` = API URL | Build with env so app uses API URL |
| 3 | `php artisan migrate --force` | Deploy (e.g. `vercel --prod`) | EAS build or local build |
| 4 | `php artisan db:seed --force` | — | Distribute build (store or internal) |
| 5 | CORS allows Vercel (and mobile origin if needed) | — | Ensure device can reach API over HTTPS |

**Shared value:** All three use the same **API base URL** (e.g. `https://api.yourdomain.com`). No trailing slash.

---

## Optional: Support / WhatsApp (mobile)

If the mobile app uses a support WhatsApp link, set **`EXPO_PUBLIC_SUPPORT_WHATSAPP`** in the mobile app’s environment (e.g. `+1234567890`) so the “Contact support” feature works in production.
