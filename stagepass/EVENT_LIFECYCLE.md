# Stagepass — Full Event Lifecycle Workflow

This document defines the **event lifecycle** implemented in Stagepass: who does what, required inputs, database changes, notifications, and validation rules. The workflow enforces operational discipline and prevents inconsistent data.

---

## 1. Full event lifecycle flow (sequence)

```
  Create Event → Add Crew → Assign Team Leader → Crew Check-In → Monitor Event
       → Add Notes → Transfer Crew (optional) → Crew Checkout → Close Event
```

Steps can overlap (e.g. notes and monitoring happen throughout; transfer is optional). The order above is the logical sequence for a typical event.

---

## 2. State transitions for events

Event `status` is stored on the `events` table. Allowed values:

| Status      | Meaning |
|------------|--------|
| `created`  | Event created; crew can be added; team leader assignable; not yet “live”. |
| `active`   | Event is live; crew can check in/out; notes and monitoring. Set manually via update or (optional) automatically at start time. |
| `completed`| Event has been ended (team leader or admin ran “End event” with comment). No further check-in/checkout or crew add/transfer. |
| `closed`   | Optional final state (e.g. after accounting/payments closed). Set manually via update. No further changes. |

**Transitions:**

- **Create event** → `created`
- **Update event** (manual) → `created` | `active` | `completed` | `closed`
- **End event** (API “Close event”) → `completed` (and `ended_at`, `ended_by_id`, `end_comment` set)

```
  [created] ──(update)──► [active] ──(end)──► [completed] ──(update)──► [closed]
       │                      │                    │
       └──────────────────────┴────────────────────┴── No add crew / check-in / transfer
```

---

## 3. Step-by-step workflow

For each step: **who** performs it, **required inputs**, **database updates**, **notifications**, and **next system state**.

---

### Step 1 — Create Event

| Item | Detail |
|------|--------|
| **Who** | **Admin** (director / super_admin) or **Team Leader** (or any user with event create access in the app). |
| **Required inputs** | `name` (required), `date`, `start_time`; optional: `description`, `expected_end_time`, `location_name`, `latitude`, `longitude`, `geofence_radius`, `team_leader_id`. |
| **Database updates** | Insert `events`: name, description, date, start_time, expected_end_time, location_name, latitude, longitude, geofence_radius, team_leader_id, status=`created`, created_by_id. Insert `event_user`: creator attached as crew (so they see the event). |
| **Notifications** | None. |
| **Next system state** | Event status = **created**. |

**Validation rules:**

- `name`: required, string, max 255.
- `date`: required, date.
- `start_time`: required, format H:i.
- `geofence_radius`: optional, integer 50–5000, default 100.
- `team_leader_id`: optional, exists in users.

**API:** `POST /api/events`

---

### Step 2 — Add Crew

| Item | Detail |
|------|--------|
| **Who** | **Admin** or **Team Leader** for that event (team_leader_id or super_admin/director). |
| **Required inputs** | `user_id` (required), `role_in_event` (optional). |
| **Database updates** | Insert `event_user`: event_id, user_id, role_in_event. Unique on (event_id, user_id). |
| **Notifications** | **CrewAddedToEventReminder** (email + SMS); ReminderLog entries (TYPE_ADDED, email + SMS). |
| **Next system state** | Event unchanged (still created/active); crew list increased. |

**Validation rules:**

- Caller must be able to manage crew (admin or event’s team leader).
- Event status must **not** be `completed` or `closed`.
- `user_id`: required, exists in users.
- User must not already be on the event crew.

**API:** `POST /api/events/{event}/assign-user`

---

### Step 3 — Assign Team Leader

| Item | Detail |
|------|--------|
| **Who** | **Admin** or event **creator** (or anyone with event update access in the app). |
| **Required inputs** | `team_leader_id` (user id; nullable to clear). |
| **Database updates** | Update `events.team_leader_id`. |
| **Notifications** | None in current implementation. |
| **Next system state** | Event unchanged; team leader set for crew management and “End event”. |

**Validation rules:**

- `team_leader_id`: optional, exists in users.

**API:** `PUT /api/events/{event}` with `team_leader_id`, or set on `POST /api/events`.

---

### Step 4 — Crew Check-In

| Item | Detail |
|------|--------|
| **Who** | **Crew** (self) via geofence check-in, or **Team Leader / Admin** via manual check-in. |
| **Required inputs** | **Self:** `event_id`, `latitude`, `longitude`. **Manual:** event and user (path params). |
| **Database updates** | Update `event_user`: set `checkin_time` = now() for that event_id + user_id. |
| **Notifications** | **Self check-in:** `CrewCheckedIn` event is dispatched (can drive notifications/analytics). Manual check-in: no notification in current implementation. |
| **Next system state** | Assignment has checkin_time set; crew is “checked in”. |

**Validation rules:**

- Event status must **not** be `completed` or `closed`.
- User must be on event crew (event_user row exists).
- **Self:** must not already have checkin_time; event must have latitude/longitude; user must be within `geofence_radius` of event location.
- **Manual:** only team leader or admin for the event; must not already have checkin_time.

**API:** `POST /api/attendance/checkin` (crew) or `POST /api/events/{event}/attendance/manual-checkin/{user}` (leader/admin).

---

### Step 5 — Monitor Event

| Item | Detail |
|------|--------|
| **Who** | **Admin**, **Team Leader**, or **Crew** (own event). |
| **Required inputs** | None (read-only). |
| **Database updates** | None. |
| **Notifications** | None. |
| **Next system state** | No change. |

**Behaviour:** View event detail (crew, check-in/checkout times, notes, checklist, equipment). Reports (attendance, payments) support monitoring. No dedicated “monitor” API; uses `GET /api/events/{event}`, `GET /api/reports`, and list endpoints.

---

### Step 6 — Add Notes

| Item | Detail |
|------|--------|
| **Who** | **Admin**, **Team Leader**, or **Crew** assigned to the event (any authenticated user who can access the event). |
| **Required inputs** | `note` (required, string, max 2000). |
| **Database updates** | Insert `event_notes`: event_id, user_id, note. |
| **Notifications** | None. |
| **Next system state** | No event status change; note attached to event. |

**Validation rules:**

- `note`: required, string, max 2000.

**API:** `POST /api/events/{event}/notes`

---

### Step 7 — Transfer Crew

| Item | Detail |
|------|--------|
| **Who** | **Admin** or **Team Leader** for the **source** event. |
| **Required inputs** | `user_id`, `target_event_id`. |
| **Database updates** | Remove `event_user` row for (source event, user). Insert `event_user` for (target event, user) with same role_in_event. |
| **Notifications** | None in current implementation. |
| **Next system state** | User no longer on source event; user on target event (checkin/checkout state not carried over). |

**Validation rules:**

- Caller must be able to manage crew on the **source** event (admin or source event’s team leader).
- Source and target event must be different.
- Source and target event status must **not** be `completed` or `closed`.
- User must be on source event crew.

**API:** `POST /api/events/{event}/transfer-user`

---

### Step 8 — Crew Checkout

| Item | Detail |
|------|--------|
| **Who** | **Crew** (self only). |
| **Required inputs** | `event_id`. |
| **Database updates** | Update `event_user`: set `checkout_time` = now(), `total_hours` = (checkout - checkin) in hours. Update/create `event_meals` for meal eligibility (breakfast/lunch/dinner) based on check-in/checkout times. |
| **Notifications** | None. |
| **Next system state** | Assignment has checkout_time and total_hours set; crew is “checked out”. |

**Validation rules:**

- Event status must **not** be `completed` or `closed`.
- User must have already checked in (checkin_time present).
- Must not already have checkout_time.

**API:** `POST /api/attendance/checkout`

---

### Step 9 — Close Event

| Item | Detail |
|------|--------|
| **Who** | **Team Leader** for the event or **Admin** (super_admin / director). |
| **Required inputs** | `end_comment` (required, string, max 5000). |
| **Database updates** | Update `events`: status = `completed`, ended_at = now(), ended_by_id = user, end_comment = value. |
| **Notifications** | None in current implementation. |
| **Next system state** | Event status = **completed**. No further check-in/checkout, add crew, or transfer. |

**Validation rules:**

- Caller must be event’s team leader or admin.
- Event status must **not** already be `completed` or `closed`.
- `end_comment`: required, string, max 5000.

**API:** `POST /api/events/{event}/end`

---

## 4. Validation rules (summary)

### Event status guards (operational discipline)

- **Add crew:** Event must not be `completed` or `closed`.
- **Manual check-in:** Event must not be `completed` or `closed`.
- **Transfer crew:** Source and target event must not be `completed` or `closed`; source ≠ target.
- **Check-in (self):** Event must not be `completed` or `closed`.
- **Checkout:** Event must not be `completed` or `closed`.
- **End event:** Event must not already be `completed` or `closed`.

### Uniqueness and existence

- One row per (event_id, user_id) in `event_user` (no duplicate crew per event).
- Check-in: user must be on event; checkin_time must be null.
- Checkout: checkin_time must be set; checkout_time must be null.
- Transfer: user must exist on source event; target event must exist and be different from source.

### Geofence (check-in only)

- Event must have `latitude` and `longitude`.
- User’s (latitude, longitude) must be within `geofence_radius` (metres) of event location.

### Authorization (who can do what)

| Action           | Allowed roles                          |
|------------------|----------------------------------------|
| Create event     | Any authenticated (creator stored)     |
| Add / remove crew| Admin, or event’s Team Leader           |
| Assign team leader| Any with event update (e.g. Admin)    |
| Manual check-in  | Admin, or event’s Team Leader           |
| Transfer crew    | Admin, or source event’s Team Leader    |
| End event        | Admin, or event’s Team Leader           |
| Check-in (self)  | Crew (must be on event)                 |
| Checkout (self)  | Crew (must be on event)                 |
| Add note         | Any user who can access the event      |

---

## 5. Implementation status

| Step              | Implemented | API / behaviour |
|-------------------|------------|------------------|
| Create Event      | Yes        | POST /api/events, status=created, creator attached |
| Add Crew          | Yes        | POST assign-user, CrewAddedToEventReminder + ReminderLog |
| Assign Team Leader| Yes        | PUT /api/events or POST with team_leader_id |
| Crew Check-In     | Yes        | POST attendance/checkin (geofence) + manual-checkin |
| Monitor Event     | Yes        | GET event, reports, list crew/attendance |
| Add Notes         | Yes        | POST /api/events/{event}/notes |
| Transfer Crew     | Yes        | POST transfer-user (Admin/Leader only; status guards) |
| Crew Checkout     | Yes        | POST attendance/checkout, total_hours + meals |
| Close Event       | Yes        | POST /api/events/{event}/end → status=completed |

**Enforcement added in codebase:**

- Transfer crew: restricted to Admin or event’s Team Leader; source/target must not be ended; source ≠ target.
- Add crew: event must not be completed/closed.
- Manual check-in: event must not be completed/closed.
- Check-in (self): event must not be completed/closed.
- Checkout: event must not be completed/closed.

This gives a full event lifecycle with clear state transitions and validation rules that prevent inconsistent data (e.g. no check-in or crew changes after the event is ended).
