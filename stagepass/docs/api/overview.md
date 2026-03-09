# Stagepass API Overview

Base URL: `/api` (e.g. `http://localhost:8000/api`).

Authentication: Laravel Sanctum. Send `Authorization: Bearer {token}` for protected routes. Obtain token via `POST /api/login`.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /login | No | Login; returns `token` and `user` |
| POST | /logout | Yes | Revoke current token |
| GET | /me | Yes | Current user + roles |
| GET | /events | Yes | List events (paginated) |
| POST | /events | Yes | Create event |
| GET | /events/{id} | Yes | Event detail |
| PUT | /events/{id} | Yes | Update event |
| DELETE | /events/{id} | Yes | Delete event |
| POST | /events/{id}/assign-user | Yes | Assign crew (user_id, role_in_event) |
| POST | /events/{id}/transfer-user | Yes | Transfer user to another event |
| GET/POST | /events/{id}/notes | Yes | List / add notes |
| POST | /attendance/checkin | Yes | Check in (event_id, latitude, longitude) |
| POST | /attendance/checkout | Yes | Check out (event_id) |
| GET | /equipment | Yes | List equipment |
| POST | /events/{id}/equipment | Yes | Attach equipment |
| POST | /events/{id}/equipment/confirm | Yes | Confirm equipment (team leader) |
| POST | /payments/initiate | Yes | Create payment record |
| POST | /payments/approve | Yes | Approve payment |
| POST | /payments/reject | Yes | Reject payment |
| POST | /timeoff/request | Yes | Request leave |
| POST | /timeoff/approve | Yes | Approve time off |
| POST | /timeoff/reject | Yes | Reject time off |

Geofence: check-in is allowed only when the user’s (latitude, longitude) is within the event’s `geofence_radius` (meters) of the event’s (latitude, longitude).
