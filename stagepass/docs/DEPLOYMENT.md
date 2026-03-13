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
