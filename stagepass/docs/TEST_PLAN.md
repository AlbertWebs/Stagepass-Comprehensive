# Stagepass Test Plan — Full Application Coverage

This document lists test cases for **Backend API**, **Web Admin**, and **Mobile App** to cover all major functionalities.

---

## 1. Backend API (Laravel / PHPUnit)

Run: `cd stagepass/backend/laravel-api && php artisan test`

### 1.1 Auth
| ID | Test Case | Method | Endpoint / Action |
|----|-----------|--------|-------------------|
| API-A1 | Login with email + password (web) returns token and user | POST | `/api/login` |
| API-A2 | Login with username + PIN (mobile) returns token and user | POST | `/api/login` |
| API-A3 | Login with invalid credentials returns 422 | POST | `/api/login` |
| API-A4 | Login display name by username returns name or 404 | GET | `/api/login-display-name?username=` |
| API-A5 | Forgot password accepts email and returns success | POST | `/api/forgot-password` |
| API-A6 | Logout invalidates token | POST | `/api/logout` (auth) |
| API-A7 | Get current user /me returns user and roles | GET | `/api/me` (auth) |
| API-A8 | Update profile PATCH /me | PATCH | `/api/me` (auth) |
| API-A9 | Upload profile photo POST /me/photo | POST | `/api/me/photo` (auth) |

### 1.2 Users
| ID | Test Case | Method | Endpoint |
|----|-----------|--------|----------|
| API-U1 | List users (index) | GET | `/api/users` |
| API-U2 | Create user | POST | `/api/users` |
| API-U3 | Show user | GET | `/api/users/{id}` |
| API-U4 | Update user | PUT | `/api/users/{id}` |
| API-U5 | Set user PIN | POST | `/api/users/{id}/set-pin` |
| API-U6 | Delete user | DELETE | `/api/users/{id}` |

### 1.3 Events
| ID | Test Case | Method | Endpoint |
|----|-----------|--------|----------|
| API-E1 | My event today | GET | `/api/my-event-today` |
| API-E2 | List events | GET | `/api/events` |
| API-E3 | Create event | POST | `/api/events` |
| API-E4 | Show event | GET | `/api/events/{id}` |
| API-E5 | Update event | PUT | `/api/events/{id}` |
| API-E6 | Delete event | DELETE | `/api/events/{id}` |
| API-E7 | Assign user to event | POST | `/api/events/{id}/assign-user` |
| API-E8 | Crew status | GET | `/api/events/{id}/crew-status` |
| API-E9 | Manual check-in | POST | `/api/events/{id}/attendance/manual-checkin/{user}` |
| API-E10 | Remove crew | DELETE | `/api/events/{id}/crew/{user}` |
| API-E11 | Transfer user | POST | `/api/events/{id}/transfer-user` |
| API-E12 | Event notes index/store | GET/POST | `/api/events/{id}/notes` |
| API-E13 | End event | POST | `/api/events/{id}/end` |

### 1.4 Checklists
| ID | Test Case | Method | Endpoint |
|----|-----------|--------|----------|
| API-C1 | My checklists | GET | `/api/my-checklists` |
| API-C2 | Event checklist index/progress | GET | `/api/events/{id}/checklist`, `.../checklist-progress` |
| API-C3 | Store/update checklist | POST | `/api/events/{id}/checklist`, PATCH `.../checklist/{item}` |

### 1.5 Attendance
| ID | Test Case | Method | Endpoint |
|----|-----------|--------|----------|
| API-AT1 | Attendance stats | GET | `/api/attendance/stats` |
| API-AT2 | Event check-in | POST | `/api/attendance/checkin` |
| API-AT3 | Office check-in / checkout | POST | `/api/attendance/office-checkin`, `office-checkout` |
| API-AT4 | Event checkout | POST | `/api/attendance/checkout` |

### 1.6 Checkins (Admin)
| ID | Test Case | Method | Endpoint |
|----|-----------|--------|----------|
| API-CH1 | Server date | GET | `/api/checkins/server-date` |
| API-CH2 | Checkins index | GET | `/api/checkins` |
| API-CH3 | Daily employee status | GET | `/api/checkins/daily-status` |
| API-CH4 | Set employee off / send push | POST | `/api/checkins/set-employee-off`, `send-push` |

### 1.7 Clients, Equipment, Vehicles, Transport, Communications
| ID | Test Case | Method | Endpoint |
|----|-----------|--------|----------|
| API-R1 | Clients CRUD | GET/POST/GET/PUT/DELETE | `/api/clients`, `/api/clients/{id}` |
| API-R2 | Equipment CRUD + event attach/confirm | GET/POST/.../events/{id}/equipment | |
| API-R3 | Vehicles CRUD | GET/POST/.../vehicles, vehicles/{id} | |
| API-R4 | Transport assignments, store, destroy | GET/POST/DELETE | transport/assignments, events/{id}/transport |
| API-R5 | Communications index/store/show/destroy | GET/POST/GET/DELETE | `/api/communications` |

### 1.8 Reports & Audit
| ID | Test Case | Method | Endpoint |
|----|-----------|--------|----------|
| API-RP1 | Reports index, events, crew-attendance, crew-payments, tasks, financial, export | GET | `/api/reports`, `/api/reports/events`, etc. |
| API-RP2 | Audit logs index | GET | `/api/audit-logs` |
| API-RP3 | Docs guides index/show | GET | `/api/docs/guides`, `/api/docs/guides/{name}` |

### 1.9 Payments
| ID | Test Case | Method | Endpoint |
|----|-----------|--------|----------|
| API-P1 | Payments index, initiate, approve, reject | GET/POST | `/api/payments`, `/api/payments/initiate`, etc. |

### 1.10 Time Off
| ID | Test Case | Method | Endpoint |
|----|-----------|--------|----------|
| API-T1 | Time off index, store, update, request, attachments, approve, reject | GET/POST/PUT/POST | `/api/timeoff`, etc. |

### 1.11 Tasks
| ID | Test Case | Method | Endpoint |
|----|-----------|--------|----------|
| API-TK1 | Tasks CRUD, update status, comments | GET/POST/GET/PUT/DELETE, PATCH status, GET/POST comments | `/api/tasks` |

### 1.12 Settings, Backup, Danger Zone
| ID | Test Case | Method | Endpoint |
|----|-----------|--------|----------|
| API-S1 | Office checkin config, settings get/update | GET/PUT/POST | `/api/settings/office-checkin-config`, `/api/settings` |
| API-S2 | Backup | GET | `/api/backup` |
| API-S3 | Danger zone wipe | POST | `/api/danger-zone/wipe-non-user-data` |

### 1.13 Roles
| ID | Test Case | Method | Endpoint |
|----|-----------|--------|----------|
| API-RL1 | Roles index | GET | `/api/roles` |

---

## 2. Web Admin (Vitest + React Testing Library)

Run: `cd stagepass/web/admin-dashboard && npm run test`

### 2.1 Auth
| ID | Test Case |
|----|-----------|
| WA-A1 | Login page renders email and password fields and submit button |
| WA-A2 | Login form submission calls login with email and password |
| WA-A3 | When user is authenticated, redirect to dashboard (or home) |
| WA-A4 | Preloader shows while checking session |

### 2.2 Layout & Navigation
| ID | Test Case |
|----|-----------|
| WA-N1 | Admin layout shows sidebar/nav with links (Dashboard, Events, Users, etc.) |
| WA-N2 | Unauthenticated access to protected route redirects to login |

### 2.3 Dashboard
| ID | Test Case |
|----|-----------|
| WA-D1 | Dashboard page renders without crash |
| WA-D2 | Dashboard shows key sections (e.g. stats, recent activity) when data present |

### 2.4 Events
| ID | Test Case |
|----|-----------|
| WA-E1 | Events list page renders and can fetch/list events |
| WA-E2 | Event detail page shows event info and tabs (crew, checklist, etc.) |
| WA-E3 | Create/edit event form validation and submit |

### 2.5 Users, Checkins, Reports, Tasks, Payments, Time Off, Settings
| ID | Test Case |
|----|-----------|
| WA-U1 | Users page renders and lists users |
| WA-C1 | Checkins page renders and shows daily status / list |
| WA-R1 | Reports page renders and report type selection works |
| WA-T1 | Tasks page renders and task list/filters work |
| WA-P1 | Payments page renders and list/actions work |
| WA-TO1 | Time off page renders; request/approve flows |
| WA-S1 | Settings page renders and save updates |

### 2.6 Other Pages
| ID | Test Case |
|----|-----------|
| WA-O1 | Clients, Equipment, Transport, Communication, Audit logs, Help, Danger zone pages render |

---

## 3. Mobile App (Jest + React Native Testing Library)

Run: `cd stagepass/mobile/stagepass-mobile && npm install --legacy-peer-deps && npm test`

**Note:** If you see `Object.defineProperty called on non-object` from jest-expo, the React Native / Expo test environment may need a version bump or Node/Jest compatibility fix. The test cases and structure are in place; you can run Backend and Web Admin tests for CI and run mobile tests locally when the environment is fixed.

### 3.1 Auth
| ID | Test Case |
|----|-----------|
| M-A1 | Login screen renders username and PIN inputs (or appropriate fields) |
| M-A2 | Login submit sends credentials to API (mocked) |
| M-A3 | On success, navigates to home/dashboard |
| M-A4 | Session restore: if token exists, show home instead of login |

### 3.2 Home / Dashboard
| ID | Test Case |
|----|-----------|
| M-H1 | Home screen renders without crash |
| M-H2 | My event today section shows when user has event |
| M-H3 | Quick actions and recent activity render |

### 3.3 Tabs & Navigation
| ID | Test Case |
|----|-----------|
| M-N1 | Bottom tab navigation (Home, Activities, Tasks, Profile) works |
| M-N2 | Activities tab shows list or empty state |
| M-N3 | Tasks tab shows task list |
| M-N4 | Profile tab shows user info and logout |

### 3.4 Event & Check-in
| ID | Test Case |
|----|-----------|
| M-E1 | Event detail screen shows event info and check-in button when applicable |
| M-E2 | Check-in flow (event check-in) calls API and updates UI |
| M-E3 | Office check-in/checkout flow |

### 3.5 Tasks, Allowances, Profile
| ID | Test Case |
|----|-----------|
| M-T1 | Task list and task detail render; status update (mocked) |
| M-T2 | Allowances section displays when applicable |
| M-P1 | Profile shows user name, photo, and update profile / logout |

### 3.6 Offline / Error Handling
| ID | Test Case |
|----|-----------|
| M-O1 | Network error shows user-friendly message |
| M-O2 | 401 response triggers logout or re-login |

---

## 4. E2E (Optional — Playwright / Detox)

- **Web Admin**: Playwright for full flow: login → dashboard → create event → add crew.
- **Mobile**: Detox or Maestro for: login → home → event check-in.

These can be added later; the test plan above focuses on unit/feature and component tests for full coverage of functionalities.
