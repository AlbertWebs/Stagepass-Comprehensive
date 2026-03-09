# Stagepass Web Admin – User Guide

Guide for admins and directors using the Stagepass web admin at **app.stagepass.co.ke** (or your deployment URL).

---

## 1. Logging in

- Open the web admin URL (e.g. `https://app.stagepass.co.ke`).
- Enter your **email** and **password**.
- You can optionally **install the app** as a PWA when prompted for quicker access.

---

## 2. Dashboard

- **Dashboard** gives a quick snapshot: today’s date, greeting, and at-a-glance stats:
  - Total events, ongoing now, upcoming, team members, equipment count.
- **Crew on active events** shows how many people are on live events.
- **Ongoing** and **Upcoming** event tables with links to event details.
- **Recent events** and **Quick actions** (Create event, Add team member, Equipment, Payments, Time off).

Use the sidebar to move to any section.

---

## 3. Event Management

### Events list

- **Events** in the sidebar opens the events list.
- Filter by **status** (All, Created, Active, Completed, Closed).
- Create a new event with **Create event**; edit or delete from the table.

### Creating an event

- Click **Create event**.
- Fill: **Name**, **Date**, **Start time**, **Expected end time**, **Location**, **Geofence radius** (for mobile check-in), **Team leader**, and optionally **Client** (select from existing clients).
- Save. The event appears in the list with status **Created**.

### Event detail (single event)

- Click **View** on an event to open **Event detail**.
- Here you can:
  - **Assign or change client** (Client dropdown in Details); assign **team leader**.
  - **Assign crew** (Add crew, remove, transfer to another event).
  - **Mark crew as arrived** (manual check-in) if they can’t use the app.
  - **Attach equipment** and confirm.
  - **Add notes**, manage **checklist**, **allocate payments** for crew.
  - **End event** (team leader or admin) with an end comment.

---

## 4. Crew Management

- **Crew** in the sidebar lists all crew/staff (same as Users with a “Crew” lens).
- **Add crew**, search, and edit or delete.
- Assign **roles** (e.g. team_leader, crew). Crew are then available to assign to events under Event detail.

---

## 5. Event Operations

- **Event Operations** (sidebar) is a hub for event management actions without opening each event.
- **Transfer crew between events**: choose *From event*, *Crew member*, and *To event*; click **Transfer**. The crew member is removed from the source event and added to the target (both must be created or active).
- **Manual check-in (mark as arrived)**: choose an event and a crew member who has not yet checked in; click **Mark as arrived**. Use this when someone cannot check in via the app.
- **Add crew to event**: choose an event and a user (and optional role); click **Add to event**. The user receives a notification.
- **Events – full management**: table of events with **View & manage** linking to Event detail for crew, equipment, checklist, notes, payments, and ending the event.

---

## 6. Equipment

- **Equipment** lists all equipment (inventory).
- **Create** new items (name, serial number, condition).
- **Assign equipment** to an event from the **Event detail** page (attach and confirm).

---

## 7. Transport & Logistics

- **Transport & Logistics** (sidebar → **Transport**) lets you manage vehicles and assign them to events.
- **Vehicles:** View all vehicles in a table. Use the search box to filter by name or registration, and the status filter (All / Available / In use / Maintenance). Click **Add vehicle** to create one: enter **Name** (required), optional **Registration**, **Capacity** (seats), **Status**, and **Notes**. Use **Edit** or **Delete** on each row as needed.
- **Event assignments:** The table lists which vehicles are assigned to which events, with optional driver and notes. Filter by **event** using the dropdown. Click **Assign vehicle to event** to add an assignment: choose an **Event**, a **Vehicle**, optionally a **Driver** (from existing users), and **Notes**. Each event–vehicle pair can only be assigned once. Use **Remove** on a row to unassign a vehicle from an event.
- All transport management is done from this single page; events do not need to be opened to assign or remove vehicles.

---

## 8. Payments

- **Payments** lists all payment records. Filter by status or event.
- **Create payment** (initiate) from Event detail for a crew member (hours, per diem, allowances).
- **Approve** or **Reject** payments from the Payments list or from **Approvals**.

---

## 9. Clients

- **Clients** in the sidebar lists all clients (companies or organisations you run events for).
- **Create client**: name (required), contact name, email, phone, address, notes.
- **Search** by name, contact, email or phone.
- **View** to see full details; **Edit** to update; **Delete** to remove (events linked to that client will have their client assignment cleared).
- **Assign client to an event**: when creating or editing an event (Events list), choose a **Client** in the form; or open **Event detail** and use the **Client** dropdown in the Details section to assign or change the client.

---

## 10. Reports & Analytics

- **Reports** (sidebar) opens the reports page.
- Choose **From** and **To** dates and click **Apply**.
- You get:
  - **Financial report** – payments, amounts, by status and by day.
  - **Attendance report** – check-ins, total hours, by day.
  - **Events report** – event counts by status and day.
  - **Arrival report** – arrivals by day and by event.

Only **super_admin** and **director** roles can access Reports.

---

## 11. Communication

- **Communication** lets you send internal messages and/or emails to staff.
- Click **Send message** to compose: **Subject**, **Message**, **Send to** (All staff, Crew only, or Event crew – if Event crew, pick an event).
- Under **Delivery channels**, select at least one:
  - **In-app message** – recipients see it in their app notifications.
  - **Email** – recipients receive an email.
- Click **Send**. The communication is stored and listed under **Sent communications**.
- **View** to see full details; **Delete** to remove the record (already-delivered messages/emails are not recalled).

---

## 12. Approvals

- **Approvals** shows **Pending time off** and **Pending payments** in one place.
- **Approve** or **Reject** time off requests and payments from the same page.
- Reject actions open a confirmation modal.

---

## 13. Users & Permissions

- **Users & Permissions** lists all users. Create, edit, delete, and assign **roles** (e.g. super_admin, director, team_leader, crew).
- Restrict sensitive actions (e.g. Reports, Audit Logs, Settings) by role.

---

## 14. System Settings

- **System Settings** (or **Settings** in the sidebar) includes:
  - **Profile** – your name, email, password.
  - **Application settings** – timezone, date/time format, geofence default, notifications, payment currency, etc. (for admins/directors).
  - **Backup** – export of users, events, equipment (admin/director).

---

## 15. Audit Logs

- **Audit Logs** (Support & System) shows all API requests: who made them, from **Web** or **Mobile**, method, path, status, IP, user agent.
- Use filters: date range, source (Web/Mobile), method, user, path.
- Only **super_admin** and **director** can access.

---

## 16. Help & Documentation

- **Help & Documentation** in the sidebar opens this guide and the mobile guide so you can share or follow the same steps.

---

## Updating this guide

When you add or change a feature in the web admin (or API that affects admin flows), update the relevant section in **web-admin-guide.md** and commit it with your change. The Help page loads these guides from the server so users always see the latest version.
