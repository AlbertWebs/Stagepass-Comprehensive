# How to run the Stagepass system

The system has three parts: **Laravel API** (backend), **Admin web** (React at http://localhost:3000), and **Mobile app** (Expo/React Native). The admin and mobile apps depend on the API.

---

## 1. Laravel API (required first)

**Location:** `stagepass/backend/laravel-api`

1. Install PHP dependencies (if not done):
   ```bash
   cd stagepass/backend/laravel-api
   composer install
   ```

2. Configure environment:
   - Copy `.env.example` to `.env` if needed.
   - Set `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` for your database.
   - Optionally set `APP_URL=http://localhost:8000`.

3. Generate app key and run migrations:
   ```bash
   php artisan key:generate
   php artisan migrate
   ```

4. Seed test users (creates credentials for web and mobile):
   ```bash
   php artisan db:seed
   ```

5. Start the API server:
   ```bash
   php artisan serve
   ```
   API base URL: **http://localhost:8000**.

   **Windows:** If you see `getaddrinfo for 0.0.0.0 failed`, do **not** use `--host=0.0.0.0`. Use `php artisan serve` (defaults to 127.0.0.1).  
   **Mobile on same network:** To reach the API from a physical device, run `php artisan serve --host=127.0.0.1` and use a tunnel, or on some setups try `php artisan serve --host=<YOUR_PC_IP>` (e.g. `--host=192.168.1.5`) so the phone can call `http://<YOUR_PC_IP>:8000`.

---

## 2. Admin web (http://localhost:3000)

**Location:** `stagepass/web/admin-dashboard`

1. Install dependencies:
   ```bash
   cd stagepass/web/admin-dashboard
   npm install
   ```

2. Point the app to the API. Create or edit `.env`:
   ```
   VITE_API_URL=http://localhost:8000
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```
   Open **http://localhost:3000** in the browser.

4. Log in (web uses **email + password**):
   - **Admin:** `admin@stagepass.com` / `password`
   - **Team leader:** `teamleader@stagepass.com` / `password`
   - **Crew:** `crew@stagepass.com` / `password`

**Pages:** Dashboard, Users, Events, Equipment, Payments, Time off, Reports, Settings (profile, system settings, backup). Profile editing and backup download are under **Settings** (and via Profile/Backup in the user menu).

---

## 3. Mobile app (Expo)

**Location:** `stagepass/mobile/stagepass-mobile`

1. Install dependencies:
   ```bash
   cd stagepass/mobile/stagepass-mobile
   npm install
   ```

2. Set API URL. Create or edit `.env`:
   - **iOS simulator / web:** `EXPO_PUBLIC_API_URL=http://localhost:8000`
   - **Android emulator:** `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000`
   - **Physical device:** `EXPO_PUBLIC_API_URL=http://<your-pc-ip>:8000` (e.g. `http://192.168.1.5:8000`)

3. Start Expo:
   ```bash
   npx expo start
   ```
   Scan the QR code (Expo Go) or run on simulator/emulator.

4. Log in (mobile uses **username + 4-digit PIN**):
   - **Admin:** username `admin` / PIN `1234`
   - **Team leader:** username `teamleader` / PIN `1234`
   - **Crew:** username `crew` / PIN `1234`

The app shows role-based home: crew sees “My event today” or “No event today”; leader and admin see their dashboards.

---

## Test credentials summary

| Role        | Web (email / password)           | Mobile (username / PIN)   |
|------------|-----------------------------------|----------------------------|
| Admin      | admin@stagepass.com / password     | admin / 1234               |
| Team leader| teamleader@stagepass.com / password| teamleader / 1234         |
| Crew       | crew@stagepass.com / password      | crew / 1234                |

All PINs are `1234`. Re-run `php artisan db:seed` to reset these users (existing rows are updated by role).

---

## Troubleshooting

- **Admin web “Network error”:** Ensure the API is running and `VITE_API_URL` matches the API base URL. Restart the dev server after changing `.env`.
- **Mobile “Connection failed”:** Use the correct `EXPO_PUBLIC_API_URL` for your environment (see step 2 in Mobile). Ensure the API is started with `--host=0.0.0.0` when using a physical device.
- **401 / session lost:** Log in again. For web, token is in `localStorage`; for mobile, in secure storage.
- **Backup “Unauthorized”:** Backup is only allowed for Admin/Director roles (e.g. log in as admin).
