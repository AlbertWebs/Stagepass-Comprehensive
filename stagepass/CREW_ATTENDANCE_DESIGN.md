# Stagepass — Crew Attendance System Design

This document describes the **Crew Attendance** system for the Stagepass mobile app and how it is implemented: data model, status states, API, mobile UI, leader monitoring, and admin visibility.

---

## 1. Requirements (implemented)

| Requirement | Status |
|-------------|--------|
| Login with PIN | ✅ Mobile: username (or email/staff ID) + 4-digit PIN via `POST /api/login`. |
| View assigned event | ✅ Crew home shows “my event today” via `GET /api/my-event-today`. |
| Large Check-In button | ✅ Prominent primary button on crew home when not checked in. |
| Check-Out at end of shift | ✅ Check-Out button shown after check-in; disabled after checkout. |
| Capture check-in time | ✅ Stored in `event_user.checkin_time`. |
| Capture check-out time | ✅ Stored in `event_user.checkout_time`. |
| GPS location (optional) | ✅ Sent with check-in; stored in `event_user.checkin_latitude`, `checkin_longitude`. |
| Event ID / User ID | ✅ `event_user.event_id`, `event_user.user_id`. |
| Crew can only check into assigned events | ✅ API requires existing `event_user` row (404 if not assigned). |
| Crew cannot check in twice | ✅ 422 if `checkin_time` already set. |
| Checkout must happen after check-in | ✅ 422 if no `checkin_time` or already checked out. |
| Late arrivals flagged | ✅ Leader/Admin event detail shows “Late” badge when check-in &gt; event start time. |
| Team leaders monitor crew attendance in real time | ✅ Event detail “Arrival checklist” with status and “Mark arrived”. |
| Admin sees attendance across all events | ✅ Reports (attendance summary, by day) + per-event detail. |

---

## 2. Attendance data model

Attendance is stored on the **event_user** pivot (one row per crew member per event).

| Field | Type | Description |
|-------|------|-------------|
| `id` | bigint | Primary key. |
| `event_id` | FK → events | Event. |
| `user_id` | FK → users | Crew member. |
| `role_in_event` | string (nullable) | Role label (e.g. “Rigger”, “Sound”). |
| `checkin_time` | timestamp (nullable) | When the crew member checked in. |
| `checkout_time` | timestamp (nullable) | When they checked out. |
| `total_hours` | decimal(8,2) (nullable) | Computed at checkout (checkout − checkin). |
| `checkin_latitude` | decimal (nullable) | GPS latitude at check-in (optional, stored when sent). |
| `checkin_longitude` | decimal (nullable) | GPS longitude at check-in. |
| `timestamps` | created_at, updated_at | Laravel timestamps. |

**Constraints:** `UNIQUE(event_id, user_id)` so each user can be assigned once per event.

**Relationships:**

- `Event` has many `EventUser` (and many `User` through `event_user` with pivot).
- `User` has many events through `event_user`.
- `EventUser` belongs to `Event` and `User`.

---

## 3. Attendance status states

Per **assignment** (one event_user row), the effective state is derived from timestamps:

| State | Condition | Allowed next actions |
|-------|-----------|----------------------|
| **Not arrived** | `checkin_time` is null | Check-in (crew or leader manual), or remove from event. |
| **Checked in** | `checkin_time` set, `checkout_time` null | Check-out only. |
| **Checked out** | Both `checkin_time` and `checkout_time` set | No further attendance actions. |

**Late arrival** is not a separate DB state; it is computed when displaying:  
`checkin_time` &gt; event’s scheduled start (event.date + event.start_time).  
Leader/Admin UI shows a “Late” badge for those rows.

---

## 4. API endpoints

### Crew (mobile)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attendance/checkin` | Check in to an assigned event. Body: `event_id`, `latitude`, `longitude`. Enforces geofence; stores check-in time and optional GPS. |
| POST | `/api/attendance/checkout` | Check out. Body: `event_id`. Requires prior check-in; sets `checkout_time` and `total_hours`. |
| GET | `/api/my-event-today` | Get current user’s event for today (used for crew home). |
| GET | `/api/events/{id}` | Event detail including crew with pivot (checkin_time, checkout_time, etc.). |

### Team leader / Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events/{id}` | Event with crew and pivot (attendance status). Used for leader monitoring. |
| POST | `/api/events/{event}/attendance/manual-checkin/{user}` | Manual check-in for a crew member (e.g. no device). No GPS required. |
| GET | `/api/reports` | Query params: `from`, `to`. Returns attendance summary and by_day across all events (admin). |

**Validation / rules (backend):**

- Check-in: user must be on event; no existing `checkin_time`; event not ended; geofence satisfied if event has location.
- Check-out: user must have `checkin_time` and no `checkout_time`; event not ended.
- Manual check-in: caller must be event’s team leader or admin; event not ended.

---

## 5. Mobile UI workflow

1. **Login**  
   User enters username (or email/staff ID) and 4-digit PIN. App calls `POST /api/login`, stores token, and navigates to home.

2. **Home (crew)**  
   App calls `GET /api/my-event-today`.  
   - If no event today: show “No event today” and link to Events tab.  
   - If event today: show **CrewHomeScreen** with event name, location, start time, team leader.

3. **Check-In**  
   - Large primary button: **CHECK IN**.  
   - App gets device location; when available, button is enabled.  
   - On press: `POST /api/attendance/checkin` with `event_id`, `latitude`, `longitude`.  
   - On success: UI refreshes; button is replaced by **CHECK OUT** (and status “CHECKED IN” until checkout).

4. **Check-Out**  
   - After check-in, large button: **CHECK OUT**.  
   - On press: `POST /api/attendance/checkout` with `event_id`.  
   - On success: `total_hours` is set; UI shows “CHECKED OUT” and button is disabled.

5. **Fallback**  
   If crew cannot check in (e.g. no GPS, outside geofence), team leader can use web admin to **Mark arrived** (manual check-in) for that user.

Geofence: if the event has latitude/longitude and geofence_radius, check-in is only allowed when the device is within that radius (and location is required). If event has no location, API returns a clear error; leader can use manual check-in.

---

## 6. Leader monitoring dashboard

**Location:** Web Admin → Event detail page (e.g. `/events/:id`).

**Section: “Arrival checklist”**

- Table: **Name**, **Role**, **Status**, **Action**.
- **Status:** “Not arrived” or “Arrived &lt;time&gt;” with optional **Late** badge when check-in is after event start.
- **Action:** “Mark arrived” for users who have not yet checked in (manual check-in).

Leaders (and admins) see all crew for that event and their attendance in real time. Refreshing the event (or re-opening the page) loads the latest check-in/checkout data. No WebSockets; monitoring is “refresh to update”.

---

## 7. Admin: attendance across all events

- **Reports** (`/reports`): date range `from` / `to`.  
  - **Attendance** summary: total check-ins, total hours.  
  - **By day:** check-ins and hours per day across all events.
- **Per event:** from **Events** list, open an event to see its crew and the same “Arrival checklist” (status, late flag, manual check-in).  
- **Exports:** backup/reports endpoints can include attendance data for further analysis.

---

## 8. Design summary

| Topic | Design |
|-------|--------|
| **Data model** | Single pivot table `event_user` with check-in/out times, optional GPS, and total_hours. |
| **Status states** | Not arrived → Checked in → Checked out; “Late” is derived for display. |
| **API** | Check-in/checkout for crew; manual check-in and event detail for leaders; reports for admin. |
| **Mobile UI** | PIN login → My event today → large Check-In → Check-Out when done. |
| **Leader monitoring** | Event detail “Arrival checklist” with status, late flag, and Mark arrived. |
| **Admin** | Reports (attendance summary + by day) and per-event crew attendance. |

The Crew Attendance system is implemented end-to-end: mobile PIN login, assigned event view, large Check-In/Check-Out buttons, capture of check-in/checkout times and optional GPS, enforcement of assigned-only and single check-in/checkout order, late-arrival flagging for leaders/admins, and leader plus admin visibility as described above.
