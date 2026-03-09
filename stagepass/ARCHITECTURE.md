# Stagepass — System Architecture

**Stagepass** is an event operations management platform for events companies to manage crew, events, equipment, and payments.

This document confirms the system components, database schema, and API structure as implemented in the codebase.

---

## 1. System overview

### Components

| Component | Technology | Purpose |
|-----------|------------|--------|
| **Mobile App** | React Native (Expo) + TypeScript | Crew/Team Leader/Admin: check-in, events, tasks, checklists, time off, payments |
| **Web Admin Dashboard** | React + Vite + TypeScript | Admin/HR/Accounts: users, events, equipment, payments, time off, reports, settings |
| **Backend API** | Laravel (PHP) | REST API, auth, business logic, persistence |
| **Database** | MySQL (Laravel default) | Persistent storage |

*Note: The web app is implemented with **React + Vite** (not Next.js). The architecture supports swapping to Next.js if desired.*

### Architecture diagram

```
┌─────────────────────┐         ┌─────────────────────┐
│   Mobile App        │         │   Web Admin         │
│   (Expo / RN)       │         │   (React + Vite)    │
│   Android & iOS     │         │   Browser           │
└──────────┬──────────┘         └──────────┬──────────┘
           │                               │
           │  HTTPS / JSON                  │  HTTPS / JSON
           │  Bearer token (Sanctum)        │  Bearer token (Sanctum)
           ▼                               ▼
           ┌───────────────────────────────────────────┐
           │           Laravel API (Backend)           │
           │  • Auth (PIN for mobile, email+pw web)    │
           │  • Events, Crew, Attendance, Payments     │
           │  • Equipment, Checklists, Time Off        │
           │  • Reports, Settings, Backup              │
           └─────────────────────┬─────────────────────┘
                                 │
                                 │  Eloquent / MySQL
                                 ▼
           ┌───────────────────────────────────────────┐
           │              MySQL Database              │
           └───────────────────────────────────────────┘
```

**Data flow**

- **Mobile App → API → Database:** All mobile actions (login, check-in, events, checklists, time off, payment requests) go through the Laravel API; the API reads/writes MySQL.
- **Web Admin → API → Database:** All admin actions (users, events, equipment, payments, time off approval, reports, settings, backup) go through the same API and database.

There is **no direct DB access** from the clients; the API is the single backend.

---

## 2. Authentication & roles

### Authentication

- **Mobile:** PIN login. User identifies with **username** (or email/staff ID) and **4-digit PIN**. API: `POST /api/login` with `username` + `pin`; returns Bearer token. Token stored in **expo-secure-store**.
- **Web Admin:** Email + password. API: `POST /api/login` with `email` + `password`; returns Bearer token. Token stored in **localStorage**.
- **Session:** `GET /api/me` returns current user and roles. Token sent as `Authorization: Bearer <token>` on all authenticated requests.

### Roles (backend and mapping)

Backend roles (in `roles` table, assigned via `role_user`):

| Backend role | Maps to | Typical use |
|--------------|---------|-------------|
| `permanent_employee`, `temporary_employee` | **Crew** | Field crew, check-in, checklists |
| `team_leader` | **Team Leader** | Event lead, crew assignment, manual check-in |
| `hr`, `accounts`, `logistics`, `project_manager` | **HR / Accounts** | Time off, payments, logistics (role-based UI can extend) |
| `director`, `super_admin` | **Admin** | Full access, reports, backup, settings |

Navigation and visibility in Mobile and Web are driven by these roles (e.g. Crew vs Team Leader vs Admin).

---

## 3. Data models (primary fields, relationships, status)

### Events

| Aspect | Detail |
|--------|--------|
| **Primary fields** | `id`, `name`, `description`, `date`, `start_time`, `expected_end_time`, `location_name`, `latitude`, `longitude`, `geofence_radius`, `team_leader_id`, `status`, `created_by_id`, `ended_at`, `ended_by_id`, `end_comment`, `timestamps` |
| **Relationships** | Belongs to `team_leader` (User), `createdBy` (User), `endedBy` (User). Has many: `eventCrew` (EventUser), `crew` (User many-to-many via `event_user`), `eventEquipment`, `equipment` (many-to-many), `payments`, `notes`, `checklistItems`, `meals`, `expenses`. |
| **Status** | `created`, `active`, `completed`, `closed` |

### Crew members (Users + event assignment)

| Aspect | Detail |
|--------|--------|
| **Primary fields (users)** | `id`, `name`, `email`, `username`, `password`, `pin`, `phone`, `fcm_token`, `timestamps` |
| **Event assignment** | Pivot table `event_user`: `event_id`, `user_id`, `role_in_event`, `checkin_time`, `checkout_time`, `total_hours`. Unique on `(event_id, user_id)`. |
| **Relationships** | User: belongs to many `roles`; has many events via `event_user`. Event: has many `crew` (User) via `event_user`. |

### Attendance

| Aspect | Detail |
|--------|--------|
| **Storage** | Attendance is stored on the **event_user** pivot: `checkin_time`, `checkout_time`, `total_hours`. |
| **API** | `POST /api/attendance/checkin` (event_id, lat, lng), `POST /api/attendance/checkout` (event_id). Optional manual check-in: `POST /api/events/{event}/attendance/manual-checkin/{user}`. |
| **States** | Not checked in (null `checkin_time`), Checked in (has `checkin_time`, null `checkout_time`), Checked out (both set). |

### Tasks

| Aspect | Detail |
|--------|--------|
| **Implementation** | There is no dedicated **tasks** table. Task-like behaviour is covered by **event_checklist_items** (per-event checklist with type `crew` or `equipment`, label, sort_order, is_checked). |
| **Extension** | A future `tasks` table could add: `event_id`, `user_id`, `title`, `description`, `status`, `due_at`, `completed_at`, with API for “my tasks” and completion. |

### Checklists

| Aspect | Detail |
|--------|--------|
| **Primary fields** | `id`, `event_id`, `type` (crew | equipment), `source_id`, `label`, `sort_order`, `is_checked`, `checked_at`, `checked_by_id`, `timestamps` |
| **Relationships** | Belongs to `event`; belongs to `checkedBy` (User). |
| **Status** | Effectively two states: unchecked (`is_checked` false), checked (`is_checked` true, optional `checked_at`). |
| **API** | `GET/POST /api/events/{event}/checklist`, `PATCH .../checklist/{item}`. |

### Equipment

| Aspect | Detail |
|--------|--------|
| **Primary fields** | `id`, `name`, `serial_number`, `condition`, `timestamps` |
| **Event assignment** | `event_equipment`: `event_id`, `equipment_id`, `confirmed_by`, `confirmed_at`, `notes`. Unique on `(event_id, equipment_id)`. |
| **Relationships** | Event has many `equipment` (many-to-many via `event_equipment`). |
| **Condition** | String (e.g. good, fair, poor, out_of_service). |

### Payments

| Aspect | Detail |
|--------|--------|
| **Table** | `event_payments` |
| **Primary fields** | `id`, `event_id`, `user_id`, `purpose`, `hours`, `per_diem`, `allowances`, `total_amount`, `status`, `approved_by`, `approved_at`, `rejection_reason`, `timestamps` |
| **Relationships** | Belongs to `event`, `user`; belongs to `approvedBy` (User). |
| **Status** | `pending`, `approved`, `rejected` |
| **API** | List, initiate (create request), approve, reject. |

### Notifications

| Aspect | Detail |
|--------|--------|
| **Table** | `notifications` (Laravel polymorphic: uuid, type, notifiable_type/id, data, read_at). |
| **Usage** | Laravel Notifications (e.g. crew reminders: added to event, event near, check-in due). Optional FCM for push (`users.fcm_token`). |
| **Related** | `reminder_logs` table logs sent reminders (event_id, user_id, type, channel, sent_at) for idempotency/throttling. |

### Time off requests

| Aspect | Detail |
|--------|--------|
| **Primary fields** | `id`, `user_id`, `start_date`, `end_date`, `reason`, `status`, `processed_by`, `processed_at`, `timestamps` |
| **Relationships** | Belongs to `user`; belongs to `processedBy` (User). |
| **Status** | `pending`, `approved`, `rejected` |
| **API** | List (admin), request (mobile), approve, reject. |

---

## 4. Database schema structure (summary)

### Core tables

| Table | Key columns |
|-------|-------------|
| **users** | id, name, email, username, password, pin, phone, fcm_token, timestamps |
| **roles** | id, name, label |
| **role_user** | role_id, user_id |
| **events** | id, name, description, date, start_time, expected_end_time, location_name, latitude, longitude, geofence_radius, team_leader_id, status, created_by_id, ended_at, ended_by_id, end_comment, timestamps |
| **event_user** | id, event_id, user_id, role_in_event, checkin_time, checkout_time, total_hours, timestamps. UNIQUE(event_id, user_id) |
| **equipment** | id, name, serial_number, condition, timestamps |
| **event_equipment** | id, event_id, equipment_id, confirmed_by, confirmed_at, notes, timestamps. UNIQUE(event_id, equipment_id) |
| **event_payments** | id, event_id, user_id, purpose, hours, per_diem, allowances, total_amount, status, approved_by, approved_at, rejection_reason, timestamps. UNIQUE(event_id, user_id) |
| **event_checklist_items** | id, event_id, type, source_id, label, sort_order, is_checked, checked_at, checked_by_id, timestamps |
| **event_notes** | id, event_id, user_id, note, timestamps |
| **time_off_requests** | id, user_id, start_date, end_date, reason, status, processed_by, processed_at, timestamps |
| **notifications** | uuid id, type, notifiable_type, notifiable_id, data, read_at, timestamps |
| **reminder_logs** | id, event_id, user_id, type, channel, sent_at, timestamps |
| **settings** | key (PK), value, timestamps |

### Supporting tables

- **personal_access_tokens** (Sanctum)
- **event_meals**, **event_expenses** (event-level data)
- **activity_logs** (audit)
- **cache**, **jobs**, **sessions**, **password_reset_tokens** (framework)

### Scale (1000+ crew per event)

- **event_user**: One row per crew per event; indexed on `event_id`, `user_id`. Pagination and filtering on list endpoints (e.g. crew status) keep response sizes bounded.
- **event_checklist_items**: Per event; can be paginated or loaded in chunks if needed.
- **event_payments**: One row per user per event (unique constraint); list endpoint is paginated.
- **API**: Pagination (`per_page`, `page`) used on events, users, equipment, payments, time off. Optional indexing on `events.date`, `event_user.checkin_time`, and foreign keys supports large events.

---

## 5. API structure overview

Base URL: `/api` (e.g. `https://your-domain.com/api`). All authenticated routes use **Bearer token** (Laravel Sanctum).

### Auth (public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | Mobile: `username` + `pin`. Web: `email` + `password`. Returns `token`, `user`. |
| POST | `/forgot-password` | Sends reset link (email). |

### Auth (protected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/logout` | Revoke current token. |
| GET | `/me` | Current user + roles. |
| PATCH | `/me` | Update profile (name, email, password). |

### Users & roles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/roles` | List roles. |
| GET | `/users` | List users (paginated, optional search/role). |
| POST | `/users` | Create user. |
| GET | `/users/{user}` | Show user. |
| PUT | `/users/{user}` | Update user. |
| DELETE | `/users/{user}` | Delete user. |

### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/my-event-today` | Current user’s event for today (for crew/leader home). |
| GET | `/events` | List events (paginated, optional status). |
| POST | `/events` | Create event. |
| GET | `/events/{event}` | Event detail (with crew, equipment, notes, checklist). |
| PUT | `/events/{event}` | Update event. |
| DELETE | `/events/{event}` | Delete event. |
| POST | `/events/{event}/assign-user` | Assign crew (user_id, role_in_event). |
| DELETE | `/events/{event}/crew/{user}` | Remove crew from event. |
| POST | `/events/{event}/attendance/manual-checkin/{user}` | Manual check-in (team leader/admin). |
| POST | `/events/{event}/end` | End event (ended_at, end_comment). |
| GET/POST | `/events/{event}/notes` | List or create notes. |
| GET/POST | `/events/{event}/checklist` | List or create checklist. |
| PATCH | `/events/{event}/checklist/{item}` | Toggle checklist item. |
| POST | `/events/{event}/equipment` | Attach equipment. |
| POST | `/events/{event}/equipment/confirm` | Confirm equipment. |

### Attendance (mobile)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/attendance/checkin` | Check in (event_id, latitude, longitude). |
| POST | `/attendance/checkout` | Check out (event_id). |

### Equipment

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/equipment` | List (paginated, optional search). |
| POST | `/equipment` | Create. |
| GET | `/equipment/{equipment}` | Show. |
| PUT | `/equipment/{equipment}` | Update. |
| DELETE | `/equipment/{equipment}` | Delete. |

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payments` | List (paginated, optional status, event_id). |
| POST | `/payments/initiate` | Create payment request (event_id, user_id, hours, per_diem, allowances, purpose). |
| POST | `/payments/approve` | Approve (payment_id). |
| POST | `/payments/reject` | Reject (payment_id, optional reason). |

### Time off

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/timeoff` | List requests (paginated, optional status). Admin/HR. |
| POST | `/timeoff/request` | Create request (start_date, end_date, reason). Mobile. |
| POST | `/timeoff/approve` | Approve (request_id). |
| POST | `/timeoff/reject` | Reject (request_id). |

### Reports, settings, backup

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reports` | Reports (e.g. financial, attendance) with from/to params. |
| GET | `/settings` | App settings (key-value). Admin/Director. |
| PUT | `/settings` | Update settings. Admin/Director. |
| GET | `/backup` | JSON export (users, events, equipment). Admin/Director. |

---

## 6. Confirmation checklist

| Requirement | Status |
|-------------|--------|
| System: Stagepass event operations (crew, events, equipment, payments) | Yes |
| Mobile App (Android & iOS) | Yes — React Native (Expo) + TypeScript |
| Web Admin Dashboard | Yes — React + Vite + TypeScript |
| Laravel API Backend | Yes |
| MySQL database | Yes — Laravel default |
| PIN login for mobile | Yes — username + 4-digit PIN |
| Roles: Crew, Team Leader, Admin, HR/Accounts | Yes — via backend roles (see §2) |
| Data models: Events, Crew, Attendance, Tasks*, Checklists, Equipment, Payments, Notifications, Time Off | Yes — *Tasks as checklist items; dedicated tasks table can be added |
| Architecture: Mobile → API → DB, Web → API → DB | Yes |
| Scale (1000+ crew) | Supported — pagination, indexes, pivot design |

This architecture document reflects the current Stagepass codebase and can be used as the single reference for system design, database schema, and API structure.
