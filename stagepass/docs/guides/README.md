# Stagepass User Guides

This folder contains the **canonical documentation** for:

- **Mobile app** – crew and team leader usage
- **Web admin** – admin and director usage

These guides are shown in the **Help & Documentation** page in the web admin. When you change a feature in the app, update the relevant guide here so the in-app help stays accurate.

## Files

| File | Audience | When to update |
|------|----------|----------------|
| `mobile-user-guide.md` | Mobile app users (crew, team leaders) | New/updated mobile screens, check-in flow, payments, time off, notifications |
| `web-admin-guide.md` | Web admin users (admins, directors) | New/updated sidebar, pages, Events, Clients, Crew, Equipment, Payments, Reports, Settings, Audit Logs |

## Update process

1. **Change a feature** in mobile app or web admin (or API).
2. **Edit the right guide** in this folder so the steps and screens match.
3. **If you add a new section** (e.g. a new module), add a corresponding section to the guide and, if needed, to the Help page (which loads these files).
4. **Commit** the guide changes with your feature change so docs and product stay in sync.

Guides are served to the web admin Help page from the backend; the web app loads them from `GET /api/docs/guides?name=<guide-name>`.
