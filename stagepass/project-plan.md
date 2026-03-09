# Stagepass Management System – Project Plan

## Overview

Production-grade system for an events company: crew attendance, geofencing, payments, equipment, and time-off workflows. Mobile app for employees and team leaders; REST API for all clients.

## Modules Delivered

| # | Module | Backend | Mobile |
|---|--------|---------|--------|
| 1 | Authentication | POST /api/login, logout, GET /api/me; Sanctum | Login, token storage, role detection |
| 2 | User roles | roles, permissions, role_user; RBAC | Role-based UI (future) |
| 3 | Event management | CRUD events; team_leader_id; status | Event list, event detail |
| 4 | Crew assignment | assign-user, transfer-user | Assign/transfer (team leader) |
| 5 | Attendance | checkin (GPS), checkout; hours | Check-in/out with geofence check |
| 6 | Meal eligibility | event_meals; breakfast &lt; 7:00, dinner ≥ 19:30 | Derived from check-in/out |
| 7 | Transport & parking | event_expenses (cab, parking) | Can be added to event/expense UI |
| 8 | Equipment | equipment, event_equipment, confirm | Equipment list, confirm (team leader) |
| 9 | Payments & per diem | initiate, approve, reject | Payments workflow (accounts) |
| 10 | Time off | request, approve, reject | Request leave screen |
| 11 | Notes | event_notes | Notes on event |
| 12 | Audit log | activity_logs table + model | — |
| 13 | Push notifications | CrewCheckedIn event → notification | FCM setup in infra |

## Architecture Decisions

- **Monorepo**: Single repo for API, mobile, web, infra, and docs to keep versions and contracts in sync.
- **Laravel Sanctum**: Stateless API tokens for mobile; no session cookies.
- **Geofence**: Haversine distance (meters) on backend and in mobile `useGeofence`; check-in allowed only when `distance ≤ geofence_radius`.
- **RBAC**: Role-based access via `roles` and `role_user`; policies can be added per resource.
- **Events & listeners**: Check-in dispatches `CrewCheckedIn`; listener notifies team leader (DB + broadcast); FCM can be added in `infrastructure/firebase` and a custom notification channel.

## Database

Migrations live in `backend/laravel-api/database/migrations`. Key tables:

- users, roles, permissions, role_user, permission_role
- events (with latitude, longitude, geofence_radius, team_leader_id)
- event_user (checkin_time, checkout_time, total_hours)
- event_meals, event_expenses, equipment, event_equipment
- event_payments, time_off_requests, event_notes, activity_logs, notifications

Shared schemas/diagrams can be maintained under `database/schemas` and `database/diagrams`.

## Next Steps

1. **Policies**: Add Laravel policies for events, payments, time-off per role.
2. **FCM**: Implement Firebase Cloud Messaging channel and device tokens (fcm_token on users).
3. **Web admin**: Bootstrap `web/admin-dashboard` (e.g. Next.js or Vite + React) and reuse API.
4. **CI/CD**: Add pipelines under `infrastructure/ci-cd` for API and mobile.
5. **Docker**: Add `infrastructure/docker` for local API + MySQL (and optionally queue worker).
