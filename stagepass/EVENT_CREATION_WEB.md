# Stagepass — Web Event Creation Interface

This document confirms the **web interface for creating events** in Stagepass: UI structure, validation rules, and API integration. The design is kept fast and scalable for admin users.

---

## 1. Admin capabilities (implemented)

| Capability | Implementation |
|------------|----------------|
| **Create new events** | Events page → “Create event” button → modal form; submit → `POST /api/events`. |
| **Define event details** | Form: name, date, start time, end time, location, geofence, description. Edit on Events list or Event detail. |
| **Assign team leaders** | On create (dropdown) and on Event detail (team leader dropdown). |
| **Assign crew members** | Event detail → “Event crew” → “Add crew” (user + role) → “Add to crew”; list with Remove. |
| **Assign equipment** | Event detail → “Event equipment” → select equipment + “Add”; table of assigned items. |

---

## 2. Event fields

| Field | In UI | Validation | Notes |
|-------|--------|------------|--------|
| **Event name** | ✅ Create/Edit form | Required, string, max 255 | |
| **Location** | ✅ `location_name` | Optional, string, max 255 | Venue or address. |
| **Date** | ✅ | Required, date | |
| **Start time** | ✅ | Required, H:i | |
| **End time** | ✅ `expected_end_time` | Optional, H:i | |
| **Departments** | ❌ | — | Not in data model or UI; can be added later (e.g. tag or JSON). |
| **Team leaders** | ✅ | Optional, `team_leader_id` exists in users | Single team leader per event. |
| **Assigned crew** | ✅ | Per-event; user must exist; unique per event | Assigned on Event detail after create. |
| **Equipment list** | ✅ | Per-event; equipment must exist; unique per event | Assigned on Event detail after create. |

Additional fields in the form: **Description** (optional), **Geofence radius** (optional, 50–5000 m, default 100), **Status** (edit only: created, active, completed, closed).

---

## 3. Event creation UI structure

### 3.1 Events list page (`/events`)

- **Layout:** Page header (title, subtitle, “Create event” button); filter bar (status); table/cards of events (name, date, location, start time, status, team leader, links).
- **Component placement:**
  - Header: `PageHeader` with action = “Create event”.
  - Filter: `<select>` status (optional).
  - List: `SectionCard` “Upcoming & past events” with rows; each row: event name (link to detail), date, location, start, status, “Edit” / “Delete”.
- **User actions:** Click “Create event” → open Create modal. Click “Edit” → open Edit modal. Click event name → Event detail. Click “Delete” → confirm → delete.
- **Navigation:** Create/Edit/Delete close modal and refresh list. Event name → `/events/:id`.

### 3.2 Create event modal

- **Layout:** Modal (wide, minimal scroll); single form with grouped fields.
- **Component placement:**
  - Row 1: Event name (full width, required).
  - Row 2: Date (required), Start time (required), End time (optional) — grid 2–3 columns.
  - Row 3: Location (optional), Geofence (m) (optional).
  - Row 4: Description (optional); Edit only: Status dropdown.
  - Actions: Cancel, “Create event” / “Update event”.
- **User actions:** Fill fields → Submit (create or update). Cancel closes modal.
- **Validation (client):** Required: name, date, start_time. Optional: expected_end_time, location_name, geofence_radius, description, team_leader_id.

### 3.3 Event detail page (`/events/:id`)

- **Layout:** Hero (event name, back link); grid: Details card, Event crew card, Event equipment card; full-width: Event checklist, Arrival checklist, Payment requests, End event.
- **Component placement:**
  - **Details:** Status, Team leader (dropdown), Start, End, Geofence, Description.
  - **Event crew:** Count; “Add crew” button; table (Name, Role, Actions); “Add to crew” modal (user select, role, submit).
  - **Event equipment:** Count; dropdown “Add equipment…” + “Add” button; table (Equipment, Serial, Condition).
  - **Event checklist:** Create from crew + equipment; list of items with checkboxes.
  - **Arrival checklist:** Crew list with status (Arrived / Not arrived) and “Mark arrived”.
  - **Payment requests:** Allocate payment, link to Payments page.
  - **End event:** Button + modal (end_comment) for team leader/admin.
- **User actions:** Change team leader; add/remove crew; add equipment; create/toggle checklist; mark arrived; allocate payment; end event.
- **Navigation:** “Back to events” → `/events`. List refresh after each mutation.

---

## 4. Validation rules

### 4.1 Backend (Laravel)

**Create event (`POST /api/events`):**

| Field | Rules |
|-------|--------|
| `name` | required, string, max:255 |
| `description` | nullable, string |
| `date` | required, date |
| `start_time` | required, date_format:H:i |
| `expected_end_time` | nullable, date_format:H:i |
| `location_name` | nullable, string, max:255 |
| `latitude` | nullable, numeric |
| `longitude` | nullable, numeric |
| `geofence_radius` | nullable, integer, min:50, max:5000 (default 100) |
| `team_leader_id` | nullable, exists:users,id |

**Update event (`PUT /api/events/:id`):** Same as above; `status` optional, `in:created,active,completed,closed`.

**Assign crew (`POST /api/events/:event/assign-user`):** `user_id` required, exists:users,id; `role_in_event` optional, string, max:50. User must not already be on event. Event must not be completed/closed.

**Attach equipment (`POST /api/events/:event/equipment`):** `equipment_id` required, exists:equipment,id; `notes` optional, string. Unique (event_id, equipment_id) enforced by DB.

### 4.2 Frontend

- **Create/Edit form:** `name`, `date`, `start_time` required (HTML5 + submit guard). Geofence number input min 50, max 5000.
- **Add crew:** User must be selected; optional role. Duplicates prevented by backend (422).
- **Add equipment:** Equipment selected from dropdown; items already assigned are excluded from options.

---

## 5. API integration points

| Action | Method | Endpoint | Body / params |
|--------|--------|----------|----------------|
| List events | GET | `/api/events` | Query: `status`, `page`, `per_page` |
| Create event | POST | `/api/events` | `name`, `date`, `start_time`, `expected_end_time?`, `location_name?`, `geofence_radius?`, `description?`, `team_leader_id?` |
| Get event | GET | `/api/events/:id` | — |
| Update event | PUT | `/api/events/:id` | Same as create + `status?` |
| Delete event | DELETE | `/api/events/:id` | — |
| Assign team leader | PUT | `/api/events/:id` | `team_leader_id` (or part of full update) |
| Assign crew | POST | `/api/events/:event/assign-user` | `user_id`, `role_in_event?` |
| Remove crew | DELETE | `/api/events/:event/crew/:userId` | — |
| Attach equipment | POST | `/api/events/:event/equipment` | `equipment_id`, `notes?` |
| List users | GET | `/api/users` | For crew and team leader dropdowns |
| List equipment | GET | `/api/equipment` | For equipment dropdown |

Event creation flow: **Create event** (POST) → optional **Edit** (PUT) or go to **Event detail** → **Assign team leader** (PUT event) → **Add crew** (POST assign-user) → **Add equipment** (POST equipment). All other actions (checklist, arrival, payments, end event) use their own endpoints as documented in ARCHITECTURE.md.

---

## 6. Speed and scalability

- **Fast:** Single modal for create; no multi-step wizard. Event detail loads one `GET /api/events/:id` with crew and equipment. Pagination on events list (`per_page` up to 100).
- **Scalable:** List is paginated; crew and equipment are loaded with the event (no N+1); dropdowns (users, equipment) loaded once per page. Assignments are one request per add (assign-user, attach equipment). For very large crews, consider lazy-loading or virtualising the crew table in a future iteration.

---

## 7. Summary

| Deliverable | Status |
|-------------|--------|
| Event creation UI structure | ✅ Events list, Create/Edit modal, Event detail with Details, Crew, Equipment, Checklist, Arrival, Payments, End event |
| Validation rules | ✅ Backend and frontend rules as above |
| API integration points | ✅ All create/update/assign endpoints used by the web app |
| Create new events | ✅ |
| Define event details | ✅ |
| Assign team leaders | ✅ |
| Assign crew members | ✅ |
| Assign equipment | ✅ (Event equipment section + `attachEquipment` API) |
| Departments | ❌ Not in schema or UI (optional future field) |

The web event creation interface is implemented and documented as above; the Event equipment section and `api.events.attachEquipment` complete the “assign equipment” requirement.
