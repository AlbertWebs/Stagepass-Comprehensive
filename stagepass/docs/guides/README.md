# Stagepass User Guides

These are the canonical guides shown in the web admin’s **Help & Documentation** page:

| File | Audience |
| --- | --- |
| `mobile-user-guide.md` | Crew and team leaders using the mobile app |
| `web-admin-guide.md` | Administrators and other authorised web admin users |

## How Help loads the guides

The web admin calls `GET /api/docs/guides` to list guides and `GET /api/docs/guides/{guide-id}` to load each Markdown file. The API first serves files from this directory. Its fallback copies are in `backend/laravel-api/resources/docs/guides/` for deployments where the canonical docs directory is not present.

When a product workflow changes, update the corresponding guide here and copy the same Markdown into the backend fallback directory. Keep steps and permission notes aligned with the current app; do not promise actions that are hidden or unavailable to some roles.
