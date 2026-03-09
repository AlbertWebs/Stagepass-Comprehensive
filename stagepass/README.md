# Stagepass Management System

Monorepo for the Stagepass event and crew management platform: Laravel API, React Native (Expo) mobile app, and future web admin dashboard.

## Structure

```
stagepass/
├── backend/laravel-api/    # Laravel 12 REST API (Sanctum, RBAC, events, attendance, payments)
├── mobile/stagepass-mobile/ # Expo React Native app (iOS + Android)
├── web/admin-dashboard/    # Future web admin
├── infrastructure/         # Docker, nginx, CI/CD, Firebase
├── database/              # Schemas, seeders, diagrams
├── docs/                  # Architecture, API, workflows, deployment
├── scripts/               # Setup, migrations, maintenance
└── shared/                # Constants, types, utilities
```

## Quick start

### Backend (Laravel API)

```bash
cd stagepass/backend/laravel-api
cp .env.example .env
composer install
php artisan key:generate
# Configure .env with MySQL (DB_*), then:
php artisan migrate
php artisan db:seed
php artisan serve
```

API base: `http://localhost:8000`. Routes under `/api` (e.g. `POST /api/login`, `GET /api/events`).

### Mobile (Expo)

```bash
cd stagepass/mobile/stagepass-mobile
npm install
# Set EXPO_PUBLIC_API_URL in .env or app config (e.g. http://localhost:8000 for simulator)
npx expo start
```

Then run on iOS/Android or web. Login uses the test user from seed (or create users via API/tinker).

### Running both

1. Start Laravel: `cd backend/laravel-api && php artisan serve`
2. Start Expo: `cd mobile/stagepass-mobile && npx expo start`
3. On Android emulator, use `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000` so the device can reach the host API.

## Features

- **Auth**: Login / logout, Sanctum tokens, role-based access (RBAC).
- **Events**: CRUD, team leader, geofence (lat/lon + radius).
- **Crew**: Assign/transfer crew to events; check-in/check-out with GPS validation.
- **Meals**: Breakfast/lunch/dinner eligibility from check-in/check-out times.
- **Equipment**: Assign to events; team leader confirms arrival.
- **Payments**: Team leader initiates; accounts approve/reject.
- **Time off**: Request leave; HR/manager approve/reject.
- **Notifications**: Check-in triggers notification to team leader (database + broadcast; FCM can be wired via Firebase).
- **Audit**: Activity log model and migrations in place for auditing actions.

## Tech stack

- **Backend**: Laravel 12, Laravel Sanctum, MySQL, queues, events/listeners.
- **Mobile**: React Native (Expo), TypeScript, Redux Toolkit, Expo Location, Expo SecureStore.

See `project-plan.md` and `docs/` for architecture and API details.
