# Stagepass — Crew Assignment Workflow

This document confirms the **Crew Assignment** workflow: who can assign crew, how assignments are stored, which APIs are used, how crew and leaders see data in the mobile app, and how the leader dashboard integrates.

---

## 1. Requirements (implemented)

| Requirement | Status |
|-------------|--------|
| Admin or HR can assign crew to events | ✅ Admin/director and event team leader can add crew from Event detail (web). |
| Select event | ✅ Events list → open Event detail (`/events/:id`). |
| Add crew members | ✅ “Event crew” section: user dropdown + optional role → “Add to crew”. |
| Assign department | ✅ Implemented as **role in event** (`role_in_event`, max 50 chars), e.g. “Rigger”, “Sound”, “Catering”. No separate departments table. |
| Assign team leader | ✅ Event Details: “Team leader” dropdown (create and on Event detail). |
| Team leaders see their crew list | ✅ Web: Event detail shows full crew table + Arrival checklist. Mobile: Leader sees their events; opening an event loads crew via API (mobile event detail is check-in focused; full crew list is on web). |
| Crew see assigned events in mobile app | ✅ “My events” tab (list of events where user is assigned); Home shows “my event today” when applicable. |

---

## 2. Assignment database structure

### 2.1 Event–crew assignment (pivot)

**Table:** `event_user`

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key. |
| `event_id` | FK → events | Event. |
| `user_id` | FK → users | Crew member. |
| `role_in_event` | varchar(50), nullable | Department/role label (e.g. “Rigger”, “Sound”). |
| `checkin_time` | timestamp, nullable | Set when crew checks in. |
| `checkout_time` | timestamp, nullable | Set when crew checks out. |
| `total_hours` | decimal(8,2), nullable | Computed at checkout. |
| `checkin_latitude`, `checkin_longitude` | decimal, nullable | Optional GPS at check-in. |
| `created_at`, `updated_at` | timestamps | Laravel. |

**Constraint:** `UNIQUE(event_id, user_id)` — one assignment per user per event.

**Relationships:**

- `Event` has many `User` through `event_user` (pivot: `role_in_event`, `checkin_time`, `checkout_time`, `total_hours`, …).
- `User` has many `Event` through `event_user`.
- `EventUser` model: belongs to `Event`, belongs to `User`.

### 2.2 Team leader (on event)

**Table:** `events`

| Column | Description |
|--------|-------------|
| `team_leader_id` | FK → users, nullable. One team leader per event. |

Assigning a team leader is updating `events.team_leader_id` (on create or on Event detail).

### 2.3 “Department” mapping

There is no separate `departments` table. **Department/role** is stored as `event_user.role_in_event` (free text, e.g. “Rigger”, “Catering”). The web “Add to crew” form has an optional “Role in event” field that maps to this. If you later need a fixed list, you can add a `departments` table and store `department_id` on `event_user` or keep using `role_in_event` with a dropdown of allowed values.

---

## 3. Assignment API endpoints

| Action | Method | Endpoint | Body / params | Who |
|--------|--------|----------|----------------|-----|
| List events (for dropdown/list) | GET | `/api/events` | `status`, `page`, `per_page` | Admin: all. Leader: where team_leader_id = me or created_by_id = me or I’m in crew. Crew: where I’m in crew or created_by_id = me. |
| Get event (with crew) | GET | `/api/events/:id` | — | If user can see event (admin, or team leader, or in crew, or creator). |
| Create event (optional team leader) | POST | `/api/events` | `team_leader_id?`, … | Admin/creator. |
| Update event (assign team leader) | PUT | `/api/events/:id` | `team_leader_id?`, … | Admin or event creator. |
| Assign crew member | POST | `/api/events/:event/assign-user` | `user_id`, `role_in_event?` | Admin (super_admin/director) or event’s team leader. |
| Remove crew member | DELETE | `/api/events/:event/crew/:user` | — | Admin or event’s team leader. |
| My event today (crew/leader home) | GET | `/api/my-event-today` | — | Returns today’s event for current user (where user is in crew). |

**Validation (assign-user):**

- Caller must be admin or the event’s team leader (`canManageCrew`).
- Event must not be `completed` or `closed`.
- `user_id`: required, exists in `users`.
- `role_in_event`: optional, string, max 50.
- User must not already be on the event (422 if duplicate).

**Side effects:** On assign, `CrewAddedToEventReminder` notification (email/SMS) and `ReminderLog` entries.

---

## 4. Mobile display logic

### 4.1 Crew members

- **Home tab:**  
  - If role = crew: `GET /api/my-event-today`. If event returned → **CrewHomeScreen** (event name, location, time, large Check-In / Check-Out, cards for Event Info, My Tasks, My Checklists). If null → **NoEventTodayScreen** (“No event today”, link to “View all events”).  
  - So crew **see their assigned event for today** on Home when they have one.

- **Events tab:**  
  - `GET /api/events` (no status filter). Backend filters to events where the user is in crew or creator.  
  - Renders “My events” list; tap → `/events/[id]` (event detail with check-in/out).  
  - So crew **see all their assigned events** in “My events”.

- **Event detail (`/events/[id]`):**  
  - `GET /api/events/:id`. Shows event name, date, location, description, and Check-in / Check-out for the current user (using `event.crew` and pivot to find their assignment).

Crew only see events they are assigned to because the **list** and **my-event-today** APIs are filtered by `event_user` (user in crew or creator).

### 4.2 Team leaders

- **Home tab:**  
  - If role = team_leader: same `my-event-today` is used for “today’s event” when the leader is also in crew; otherwise leader can open events from Events tab. **LeaderHomeScreen** shows “Leader Dashboard”, “Today: [event name]” if they have an event, and “Check in / Event” and “Events” buttons.

- **Events tab:**  
  - `GET /api/events`. Backend includes events where `team_leader_id = current user` (or created by them or they’re in crew). So leaders see **their** events (where they are team leader or otherwise linked).

- **Event detail:**  
  - Same screen as crew: event info + check-in/out for the current user. **Full crew list** for the leader is on the **web** Event detail (Event crew table + Arrival checklist). Mobile event detail does not currently render a crew list; leaders can use the web dashboard to see and manage their crew list.

### 4.3 Admin

- **Home:** Admin dashboard; “Events” links to Events tab.  
- **Events tab:** `GET /api/events` returns all events (admin sees all).  
- **Event detail:** Same as above; on web, admin has full Event crew and Arrival checklist.

---

## 5. Leader dashboard integration

### 5.1 Web (admin dashboard)

- **Events list** (`/events`): Leaders see only events where they are team leader, creator, or crew (backend filter).
- **Event detail** (`/events/:id`):  
  - **Details:** Team leader dropdown (leader or admin can change).  
  - **Event crew:** Table of assigned crew (name, role/department, Remove). “Add crew” modal (user + role in event).  
  - **Arrival checklist:** Crew list with status (Arrived / Not arrived, time, Late) and “Mark arrived”.  
- So the **leader dashboard** for crew assignment and crew list is the **Event detail** page: select event → see and manage crew, assign team leader, see arrival status.

### 5.2 Mobile

- **Leader home:** “Leader Dashboard” with today’s event (if any) and “Check in / Event” / “Events”.  
- **Events tab:** List of events the leader can access (team leader, creator, or crew).  
- **Event detail:** Check-in/out and event info; crew list is not shown on mobile (use web for full crew list and arrival monitoring).

---

## 6. End-to-end workflow summary

| Step | Who | Where | Action |
|------|-----|--------|--------|
| 1. Select event | Admin / HR / Leader | Web: Events → open event | Navigate to Event detail. |
| 2. Assign team leader | Admin / Creator | Web: Create event or Event detail | Set “Team leader” dropdown (or on create). |
| 3. Add crew members | Admin / Leader | Web: Event detail → Event crew | Choose user + optional “Role in event” (department) → “Add to crew”. |
| 4. Assign department | Admin / Leader | Web: Same form | “Role in event” = department/role label (stored in `event_user.role_in_event`). |
| 5. Leader sees crew list | Leader | Web: Event detail | Event crew table + Arrival checklist. |
| 6. Crew see assigned events | Crew | Mobile: Home + Events tab | Home: “my event today”. Events: “My events” list from `GET /api/events`. |

**Assignment database structure:** `event_user` (event_id, user_id, role_in_event, …); `events.team_leader_id`.  
**Assignment API endpoints:** Listed in §3.  
**Mobile display logic:** §4 (crew: my-event-today + events list; leader: events list + event detail; both filtered by backend).  
**Leader dashboard integration:** Web Event detail = crew list and assignment; mobile = events list + event detail (check-in focused; full crew list on web).

This confirms the Crew Assignment workflow as implemented in Stagepass.
