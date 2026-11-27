# Stagepass Web Admin Guide

This guide describes the current web admin at **https://admin.stagepass.co.ke**. The modules and actions available to each person depend on their assigned roles and permissions. If a page or action is missing, ask an administrator to review your access.

## Sign in

1. Open the admin URL and sign in with your work email and password.
2. If you cannot sign in, use **Forgot password** or contact your organisation’s administrator.
3. The browser may offer to install the admin as an app for quicker access.

## Navigation and access

Use the sidebar to open Dashboard, Events, Event Operations, Task manager, Crew Management, Equipment, Transport & Logistics, Payments, Allowances, Holidays, Clients, Reports, Daily office check-ins, Time off, Communication, Approvals, Users & Permissions, Roles & Permissions, System Settings, Audit Logs, and Help & Documentation. Links are shown according to your access. The **Approvals** route requires `approvals.manage`; most other modules have their own view or manage permission. Users with system-administrator access can review role permissions in **Roles & Permissions**.

## Dashboard

Dashboard content is tailored to your role and permissions. Use the **From** and **To** date fields to change the reporting period. Available summaries can include people operations and attendance, team operations, or finance and payouts. Select a metric or an item in **Action centre** to open the related module. Some organisation-wide metrics are visible only to users with the relevant permissions.

## Events and event details

### Create or update an event

1. Open **Events** and choose **Create event** or open an existing event.
2. Enter or update the event name, dates, times, location, geofence, team leader, client, and daily allowance where applicable.
3. Save the event. Changing event dates can recalculate attendance and allowance dates; review the confirmation before continuing.

### Manage an event

Open an event to view its details. Depending on your permissions, you can update event information, assign or remove crew, transfer crew, record a manual arrival when a crew member cannot check in on their device, review attendance, manage equipment and notes, and allocate or review payment records. The **Reports** section offers event PDF and CSV exports. The **End event** action records a closing comment; use it when the event is finished.

## Event Operations

**Event Operations** provides event-wide actions without opening each event first. The page supports transferring a crew member between events, manually recording a crew member’s arrival, adding crew to an event, and pausing or resuming a crew member’s event work where your access permits. Open the event details page for its full management tools.

## Crew and tasks

- **Crew Management** is the crew-focused view of user records. Search for people and use the available create, edit, role, and account actions allowed by your permissions.
- **Task manager** lists tasks and supports creating, editing, assigning, and updating task records where permitted. Tasks can include a title, description, priority, due date, notes, and assigned crew. Crew members see their assigned tasks in the mobile app.

## Equipment, transport, clients, and holidays

- **Equipment** manages the inventory. Event-specific equipment is attached from event details.
- **Transport & Logistics** manages vehicles and event vehicle assignments, including optional driver and notes.
- **Clients** manages client contact records and event-client associations.
- **Holidays** maintains the organisation’s holiday dates, which are used by relevant attendance and overtime calculations.

## Payments and allowances

- **Payments** lists payment requests. Use the status and event filters to find records. Depending on permissions, you can create a payment request, approve or reject a pending request, and work with payout actions shown on the page.
- **Earned allowances** are separate from payment requests. The Allowances area supports reviewing allowance records and verifying attendance evidence for roles with `allowances.verify`. Allowance approval and payout actions require their own permissions. Event daily allowance rates are edited on the event.
- **Approvals** combines pending time-off requests and pending payment requests. Filter the queue, approve individual items, select visible items for bulk approval, or reject an item and provide a reason when prompted. Allowance verification and payout processing are handled in their respective areas, not in this queue.

## Attendance and time off

- **Daily office check-ins** shows office and event attendance records for the selected date range and provides CSV reporting. It is different from manual crew arrival on an event.
- **Time off** lists employee requests and records. Use the available filters and actions to review, edit, approve, or reject requests according to your permissions. The Approvals page also provides a combined pending queue.

## Communication

Open **Communication** and choose **Send message**. Enter a subject and message, choose **All staff**, **Crew only**, or **Event crew**, and select an event when required. Choose one or both delivery channels: **In-app** and **Email**. Sent communications appear in the history, where you can view or delete the record. Deleting the record does not recall a message or email already delivered.

## Reports

Open **Reports**, choose the report view and filters, and export the available PDF or CSV. Reports include event, attendance, payment, task, end-of-day, and allowance information. What you can view depends on report permissions; the page is not limited to only super administrators or directors.

## Users, roles, settings, and audit logs

- **Users & Permissions** manages user accounts and assignments where your access permits.
- **Roles & Permissions** lets authorised administrators review and configure role permissions.
- **System Settings** contains organisation and account settings available to your role. The profile area is also used for personal account details.
- **Audit Logs** helps authorised users review recorded API activity, including its source and request details.

## If a page or action is unavailable

Check that you are signed in with the intended account. If the module or control is still unavailable, ask your administrator to check the permission associated with it. For data that looks outdated, use that page’s **Refresh** action or reload the page. Include the page name and the action you were trying when reporting a problem.

## Keeping this guide current

The Help page loads this guide from the API. Update the canonical file at `docs/guides/web-admin-guide.md` when the web admin workflow changes, and keep the backend fallback copy in `backend/laravel-api/resources/docs/guides/` in sync.
