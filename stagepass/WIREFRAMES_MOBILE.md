# Stagepass Mobile — Low-Fidelity Wireframes

Low-fidelity wireframe spec for the Stagepass mobile app. Design prioritizes **speed and simplicity** during live events. Interface is minimal and optimized for field use.

**Implementation status:** ✅ = screen implemented in app; 📐 = wireframe only (to build); 🔀 = combined with another screen.

---

## Design principles

- **Minimal UI:** Few taps to check-in/out; large touch targets.
- **Field use:** Readable in sun; works with gloves; no dense forms.
- **Role-based:** Crew → Home + Check-in; Leader → Dashboard + monitoring; Admin → Dashboard + reports.

---

## 1. Crew screens

### 1.1 Login screen

| Item | Spec |
|------|------|
| **Status** | ✅ Implemented (single screen with identifier + PIN). |
| **Layout** | Full-screen; centered card; logo/title at top; inputs stacked; primary button; secondary link. |
| **Components** | (1) App logo / “Stagepass” title. (2) Text input: “Email or Staff ID”. (3) Text input: “PIN” (4 digits, secure). (4) Primary button: “Sign in”. (5) Link: “Forgot password?”. (6) Optional: lockout message if too many failures. |
| **User actions** | Enter identifier → Enter PIN → Tap “Sign in”. Tap “Forgot password?” → Forgot-password screen. |
| **Navigation** | Success → Replace to (tabs) Home. No token → Stay on login; 401 → Redirect to login. |

**Note:** No separate “Enter PIN” screen in current flow; identifier and PIN are on one screen for speed. Optional future: identifier first → then dedicated Enter PIN screen.

---

### 1.2 Enter PIN screen (optional variant)

| Item | Spec |
|------|------|
| **Status** | 📐 Wireframe only. Current app uses combined Login. |
| **Layout** | Full-screen; centered; minimal. |
| **Components** | (1) “Enter your PIN”. (2) PIN input (4 digits, masked). (3) Primary “Confirm”. (4) “Back” / “Use different account”. |
| **User actions** | Enter 4-digit PIN → Tap “Confirm”. |
| **Navigation** | Success → (tabs) Home. Back → Login (identifier). |

---

### 1.3 Crew Home screen

| Item | Spec |
|------|------|
| **Status** | ✅ Implemented. |
| **Layout** | Vertical scroll; event name + meta at top; single primary CTA; then 3 cards in a list. |
| **Components** | (1) Event name (today’s event). (2) Meta line: location, start time. (3) Team leader line. (4) **Large primary button:** “CHECK IN” or “CHECK OUT” or “CHECKED OUT” (state-based). (5) Card: “Event Info” → event detail. (6) Card: “My Tasks” → tasks list. (7) Card: “My Checklists” → checklists. |
| **User actions** | Tap CHECK IN (with location) → check-in API → refresh → show CHECK OUT. Tap CHECK OUT → checkout API → show CHECKED OUT. Tap Event Info → Event Info screen. Tap My Tasks → My Tasks screen. Tap My Checklists → My Checklists screen. |
| **Navigation** | From (tabs) Home. To Event Info: `/events/[id]`. To My Tasks / My Checklists: dedicated screens or events tab (current: events list). |

---

### 1.4 Check-In button screen

| Item | Spec |
|------|------|
| **Status** | ✅ Implemented as the main CTA on Crew Home (and on Event detail). |
| **Layout** | The “screen” is the Crew Home with one dominant action: large Check-In button (min height ~72pt), full-width cap. After check-in: same area becomes Check-Out then CHECKED OUT. |
| **Components** | One large button; optional “Getting location…” when resolving GPS. |
| **User actions** | Tap to check in (if within geofence) or check out. |
| **Navigation** | Same as Crew Home; no separate route. |

---

### 1.5 My Tasks screen

| Item | Spec |
|------|------|
| **Status** | 📐 Wireframe. Currently Crew Home has a card that links to events tab. |
| **Layout** | Header “My Tasks”; list of tasks for today’s event (or “No event today” / empty state). |
| **Components** | (1) Title: “My Tasks”. (2) Optional: event name/subtitle. (3) List: each item = task title, optional due/time, status (e.g. todo/done). (4) Empty: “No tasks” or “No event today”. |
| **User actions** | Tap task → mark complete or view detail (if needed). Pull-to-refresh. |
| **Navigation** | From Crew Home “My Tasks” card or tab. Back → Home. |

---

### 1.6 My Checklists screen

| Item | Spec |
|------|------|
| **Status** | 📐 Wireframe. Currently Crew Home has a card that links to events tab. |
| **Layout** | Header “My Checklists”; list of checklist items for today’s event (or empty). |
| **Components** | (1) Title: “My Checklists”. (2) Optional: event name. (3) List: each row = checkbox + label; optional “Checked at” time. (4) Empty: “No checklist items” or “No event today”. |
| **User actions** | Tap row to toggle checked. Pull-to-refresh. |
| **Navigation** | From Crew Home “My Checklists” card or tab. Back → Home. |

---

### 1.7 Event Info screen

| Item | Spec |
|------|------|
| **Status** | ✅ Implemented as `/events/[id]`. |
| **Layout** | Scroll; title; meta; description; then check-in/out actions if user is crew. |
| **Components** | (1) Event name (title). (2) Meta: date, location. (3) Description (optional). (4) For crew: Check in / Check out buttons (same logic as Home). (5) Optional: link to tasks/checklists. |
| **User actions** | View details. Check in / Check out if crew. |
| **Navigation** | From Crew Home “Event Info” or Events list. Back → previous screen. |

---

## 2. Leader screens

### 2.1 Leader Dashboard

| Item | Spec |
|------|------|
| **Status** | ✅ Implemented (LeaderHomeScreen). |
| **Layout** | Title “Leader Dashboard”; today’s event line; primary CTA; “Operations” section; list of actions. |
| **Components** | (1) “Leader Dashboard”. (2) “Today: [Event name]” or “No event assigned for today”. (3) Primary: “Check in / Event”. (4) “Operations”. (5) “Events” (outline). |
| **User actions** | Tap “Check in / Event” → event detail or today’s event. Tap “Events” → Events tab. |
| **Navigation** | Shown on (tabs) Home when role = team_leader. To event: `/events/[id]`. To Events: `/(tabs)/events`. |

---

### 2.2 Crew Attendance Monitor

| Item | Spec |
|------|------|
| **Status** | 📐 Wireframe. Web admin has Event detail “Arrival checklist”; mobile leader does not yet have this. |
| **Layout** | Header “Crew Attendance”; event selector or “Today’s event”; list of crew with status. |
| **Components** | (1) Title: “Crew Attendance”. (2) Event name (or picker). (3) List: rows = crew name, role, status (Not arrived / Arrived [time], optional “Late”). (4) Optional: “Mark arrived” per row (manual check-in). (5) Refresh. |
| **User actions** | View who’s in/out. Tap “Mark arrived” for a crew member. Pull-to-refresh. |
| **Navigation** | From Leader Dashboard or event detail. Back → Dashboard or Event. |

---

### 2.3 Issue Reporting

| Item | Spec |
|------|------|
| **Status** | 📐 Wireframe only. Not implemented. |
| **Layout** | Header “Report issue”; short form or list of quick options; optional comment; submit. |
| **Components** | (1) “Report issue”. (2) Event context (today’s event or picker). (3) Issue type (e.g. Safety, Equipment, Other) or free text. (4) Comment (optional). (5) Primary “Submit”. |
| **User actions** | Select type / enter text → Submit. |
| **Navigation** | From Leader Dashboard or Event. Back → previous. |

---

### 2.4 Event Checklist Progress

| Item | Spec |
|------|------|
| **Status** | 📐 Wireframe only. Not implemented on mobile. |
| **Layout** | Header “Checklist progress”; event; list of checklist items with progress (e.g. 3/10 checked). |
| **Components** | (1) “Checklist progress”. (2) Event name. (3) Progress summary: “X / Y complete”. (4) List: item label, checked/unchecked, optional who/when. |
| **User actions** | View progress; optionally toggle items (if leader can complete). Refresh. |
| **Navigation** | From Leader Dashboard or Event. Back → previous. |

---

## 3. Admin screens

### 3.1 Admin Dashboard

| Item | Spec |
|------|------|
| **Status** | ✅ Implemented (AdminDashboardScreen). |
| **Layout** | Title “Admin Dashboard”; subtitle; primary actions. |
| **Components** | (1) “Admin Dashboard”. (2) Subtitle: e.g. “Today’s events · Active events · Crew & check-in · Reported issues”. (3) Primary “Events”. (4) Optional: “Reports”, “Event monitoring”. |
| **User actions** | Tap “Events” → Events tab. (Future: Reports, Event monitoring.) |
| **Navigation** | Shown on (tabs) Home when role = admin. To Events: `/(tabs)/events`. |

---

### 3.2 Event Monitoring

| Item | Spec |
|------|------|
| **Status** | 📐 Wireframe. Admin can open Events list and event detail; no dedicated “monitoring” summary. |
| **Layout** | Header “Event monitoring”; date filter; list of events with key metrics. |
| **Components** | (1) “Event monitoring”. (2) Date range or “Today”. (3) List: event name, date, status, crew count, arrived count, optional alert. (4) Tap row → event detail. |
| **User actions** | Filter by date. Tap event → detail. Refresh. |
| **Navigation** | From Admin Dashboard. To event: `/events/[id]`. |

---

### 3.3 Reports overview

| Item | Spec |
|------|------|
| **Status** | 📐 Wireframe. Reports exist on web admin only; not in mobile app. |
| **Layout** | Header “Reports”; date range; summary cards; optional list or charts. |
| **Components** | (1) “Reports”. (2) From / To date. (3) Cards: e.g. Total check-ins, Total hours, Events count, Payment summary. (4) Optional: by-day list or simple chart. |
| **User actions** | Set date range. View summary. Optional drill-down. |
| **Navigation** | From Admin Dashboard. Back → Dashboard. |

---

## 4. Navigation flow (summary)

```
Login (identifier + PIN)
  → Success → (tabs) Home [role-based content]
  → Forgot password → Forgot-password screen

(tabs)
  Home (Crew: Crew Home | Leader: Leader Dashboard | Admin: Admin Dashboard)
  Events (list) → tap → Event detail (/events/[id])
  Explore (placeholder)

Crew Home
  → Event Info → /events/[id]
  → My Tasks → My Tasks screen (to build)
  → My Checklists → My Checklists screen (to build)

Leader Dashboard
  → Check in / Event → /events/[id]
  → Events → (tabs)/events
  → Crew Attendance Monitor (to build)
  → Issue Reporting (to build)
  → Event Checklist Progress (to build)

Admin Dashboard
  → Events → (tabs)/events
  → Event Monitoring (to build)
  → Reports overview (to build)
```

---

## 5. Implementation status summary

| Screen | Role | Status |
|--------|------|--------|
| Login | All | ✅ Implemented (identifier + PIN on one screen) |
| Enter PIN | All | 📐 Optional; combined with Login |
| Crew Home | Crew | ✅ Implemented |
| Check-In button | Crew | ✅ On Crew Home + Event Info |
| My Tasks | Crew | 📐 Wireframe; card links to events |
| My Checklists | Crew | 📐 Wireframe; card links to events |
| Event Info | Crew/Leader | ✅ Implemented (`/events/[id]`) |
| Leader Dashboard | Leader | ✅ Implemented |
| Crew Attendance Monitor | Leader | 📐 Wireframe; web has equivalent |
| Issue Reporting | Leader | 📐 Wireframe |
| Event Checklist Progress | Leader | 📐 Wireframe |
| Admin Dashboard | Admin | ✅ Implemented |
| Event Monitoring | Admin | 📐 Wireframe |
| Reports overview | Admin | 📐 Wireframe; web has reports |

This document is the **low-fidelity wireframe spec**: layout structure, component placement, user actions, and navigation flow for each required screen. Implemented screens already follow a minimal, field-optimized style; wireframe-only screens can be built from this spec.
