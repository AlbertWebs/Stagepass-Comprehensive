# Stagepass Mobile App Guide

This guide is for crew members and team leaders using Stagepass on a phone. The screens and actions available depend on your role, event assignment, and organisation permissions.

## Sign in

Open Stagepass and sign in with the credentials provided by your organisation. Depending on account setup, sign in may use your email and password or your username and PIN; biometric sign-in may also be offered if it is enabled on your device and account. If you cannot sign in, contact your administrator.

## Home and navigation

The bottom navigation gives access to **Home**, **My Events**, **Activities**, **Tasks**, and **Profile**. Some destinations are opened from menus or event details rather than shown as bottom tabs. Admin and team-leader accounts may see additional management options.

- **Home** shows the event and work information relevant to your account, such as today’s event, assigned work, tasks, or allowances.
- **My Events** shows events assigned to you. Use the week or month calendar, select a date, and filter by **Upcoming**, **All Events**, or **Completed**. Pull down on the list to refresh.
- **Activities** shows event and notification activity available to your account.
- **Tasks** shows assigned tasks and their current status. Open a task to review its details and update it when those actions are available.
- **Profile** contains personal information and account preferences, including password or PIN controls where enabled.

## Event attendance

1. Open an assigned event and review its location and schedule.
2. To check in, allow location access and use **Check in** when you are at the event. The app uses the event’s configured geofence; if your location is outside it or unavailable, follow the message shown and contact the team leader if needed.
3. Use **Check out** when your work session ends. The app records each attendance session.
4. If you have checked out and need to start another work session for the same event on the same day, use **Check in** again when the action is available. Each check-in/check-out pair is a separate session.

If device check-in is not possible, an authorised team leader or administrator can record your arrival manually. A manual arrival is an attendance record; it does not change your device’s location settings.

## Team leader and event management tools

Authorised team leaders and administrators may see **Onboard**, **Operations**, or other event actions on an event card or event details page. The available tools can include:

- Searching for crew and adding selected people to the event. Wait for the success message before closing the onboarding panel.
- Viewing assigned crew and their check-in status, and recording an authorised check-in.
- Opening event operations to manage event work, such as tasks or attendance, according to the account’s permissions.
- Sending a message to event crew. When a single crew member is selected, the app can open WhatsApp with the message ready; review and send it in WhatsApp. Other message options depend on the screen and recipient selection.
- Reviewing event allowances or reports where enabled.

Not every account will have these controls. Ask an administrator if you need access to a management action.

## Tasks

Open **Tasks** to see work assigned to you. A task can include instructions, priority, and a due date. Update its status from the task screen when the app offers that control. If a task is missing, ask the event lead or administrator to confirm the assignment.

## Allowances and payments

Open **Allowances** to review the daily allowance rate for today’s event, allowance records allocated to you, and approved payment records available to your account. A request or record may need review before it appears as approved or paid. Contact your administrator if an expected item is missing or incorrect.

## Time off

Open **Time off** from your profile or the app menu. Submit a request with the dates, reason, notes, and any supporting attachments requested by your organisation. You can return to the page to review your requests and their status. Approval or rejection is handled by an authorised administrator.

## Messages and notifications

Check **Activities** or the message area for in-app notices. Your organisation may also send email or push notifications. Keep notifications enabled if you want to receive them. A message opened in WhatsApp is not sent until you confirm **Send** in WhatsApp.

## Theme and preferences

Use the theme button in the Home header to switch between light and dark mode. You can also choose an appearance from **Profile**. Your selection is saved for future sessions.

## Troubleshooting

- **Event missing:** pull down to refresh My Events and confirm with your team leader that you are assigned to the event and its dates are correct.
- **Check-in unavailable:** check location permission and GPS, then move within the event’s configured geofence. Contact the event lead if the location or assignment is wrong.
- **Task or allowance missing:** refresh the relevant page and ask an administrator to confirm the assignment or record status.
- **Sign-in or network issue:** check your connection and contact your organisation’s administrator. Include the screen name and what you were doing; do not send your password or PIN.

## Keeping this guide current

The Help page loads this guide from the API. Update the canonical file at `docs/guides/mobile-user-guide.md` when a mobile workflow changes, and keep the backend fallback copy in `backend/laravel-api/resources/docs/guides/` in sync.
