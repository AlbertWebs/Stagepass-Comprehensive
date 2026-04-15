# Stagepass Web Admin – Complete Procedures Guide

This guide covers end-to-end procedures for admins, directors, and team leads using the Stagepass web admin.

Use this as the operating SOP for daily work.

---

## 1) Access and login

1. Open the admin URL (example: `https://app.stagepass.co.ke` or your local URL).
2. Sign in with admin credentials (email + password).
3. Confirm you can see the left sidebar modules.
4. If login fails:
   - verify email/password,
   - use **Forgot Password**,
   - confirm backend API and mail settings are active.

---

## 2) Daily startup checklist (recommended)

1. Open **Dashboard** and review:
   - today’s active/ongoing events,
   - team count and pending items.
2. Open **Events** and verify today’s event assignments.
3. Open **Approvals** and clear pending items (time off + payments).
4. Open **Payments → Earned Allowances** and confirm new allocations.
5. Open **Communication** to send any daily crew notices.

---

## 3) Users and role management

Go to **Users & Crew**:

1. Create user with required fields (name, email, username, phone if needed).
2. Assign correct role:
   - `super_admin`, `director`, `admin` for management access,
   - `team_leader` for field operations,
   - `crew` for normal staff.
3. Set/reset PIN if mobile PIN login is used.
4. Send/resend welcome email where needed.
5. Deactivate/delete users only when no longer active.

---

## 4) Event lifecycle procedure

### A. Create event

1. Go to **Events → Create event**.
2. Fill event data:
   - name, date (and end date for multi-day),
   - start time and expected end time,
   - location + geofence,
   - team leader,
   - optional client and daily allowance.
3. Save event.

### B. Staff and setup

1. Open event details.
2. Assign crew members.
3. Assign equipment and checklist items.
4. Add notes/instructions for team.

### C. During event

1. Monitor attendance/check-ins.
2. Team lead/admin can:
   - manual check-in for crew,
   - pause/resume crew where required,
   - record transport details.
3. Use communication tools to message event crew.

### D. Close event

1. Team lead checks out.
2. Use **Done for the Day** with required closing comment.
3. Verify closure timestamp and closure comment are saved.

---

## 5) Time off management (with notification flow)

### Crew side

- Crew submits time-off request from mobile.

### Admin side

1. Open **Approvals** or **Time Off** list.
2. Review request dates, reason, notes, and attachments.
3. Approve or reject.
4. Ensure request status updates correctly.

### Notification behavior

- On submission, admins receive email notification.
- Keep admin emails valid to avoid missed requests.

---

## 6) Payments procedure

1. Go to **Payments**.
2. Create payment request for a crew member if required.
3. Include:
   - event,
   - user,
   - purpose,
   - hours/per diem/allowances.
4. Move through statuses:
   - `pending` → `approved` or `rejected`.
5. Track rejection reason when rejecting.

---

## 7) Earned allowances procedure (allocation + visibility)

Go to **Payments → Earned Allowances**.

### A. Configure allowance types

1. Create allowance types (e.g., Transport, Meal, Overtime Allowance).
2. Activate/deactivate types as needed.

### B. Allocate to user

1. Use **Allocate allowance to crew** form.
2. Select event.
3. Select crew member from event crew.
4. Select allowance type.
5. Enter amount and optional description.
6. Click **Allocate**.

### C. Post-allocation checks

1. Confirm allocation appears in earned allowances table.
2. Confirm crew member sees allocation in mobile **Allowances** page.
3. Update status to `approved` / `paid` as processing continues.

---

## 8) Holidays and overtime procedures

### Holidays

1. Go to **Holidays**.
2. Add/edit/delete holidays in `YYYY-MM-DD`.
3. Keep holiday list current before payroll cycles.

### Overtime/extra hours

- System auto-calculates extra hours:
  - normal day: beyond 8 hours,
  - Sunday/holiday: all worked time counts as extra hours.
- Verify totals in reports and attendance detail screens.

---

## 9) Team lead operational controls

From event operations screens, authorized users can:

1. Pause/resume crew sessions.
2. Record transport type and amount.
3. Close event for the day with comment.
4. Check crew attendance states in real time.

Access is restricted to team lead/admin roles.

---

## 10) Reports and reconciliation

Use **Reports** to review:

- events,
- crew attendance,
- crew payments,
- financial summaries,
- tasks and operational details.

Monthly close recommendations:

1. Verify attendance totals and extra hours.
2. Verify allowances and payment statuses.
3. Verify transport and closure comments.
4. Export report snapshots for audit records.

---

## 11) Communication procedures

1. Open **Communication**.
2. Draft message subject/body.
3. Select target:
   - all staff,
   - crew,
   - event crew.
4. Select channels:
   - in-app,
   - email.
5. Send and verify sent record.

Use this for shift updates, alerts, and urgent notices.

---

## 12) Audit, safety, and data controls

### Audit logs

- Use **Audit Logs** to trace actions (who, when, endpoint, status).

### Backup

- Use backup tools before major bulk operations.

### Role safety

- Only grant high-privilege roles when required.
- Review stale admin accounts regularly.

---

## 13) Troubleshooting quick guide

### A. Crew cannot see assigned event in mobile

1. Confirm user is assigned to event.
2. Confirm event date range includes today.
3. Refresh mobile events list.
4. Check API response and assignment records.

### B. Push/email not received

1. Verify device token/email exists.
2. Check notification channel and mail configuration.
3. Check queue/worker and logs.

### C. Allowance not visible in mobile

1. Confirm allowance allocated under **Earned Allowances**.
2. Confirm allocation uses correct crew user.
3. Refresh mobile allowances page.

---

## 14) Help maintenance procedure

When features change:

1. Update this markdown file in `resources/docs/guides/web-admin-guide.md`.
2. Ensure section names match sidebar/module names.
3. Add or adjust step-by-step SOPs (not just summaries).
4. Verify `/help` renders updated content correctly.

This keeps Help aligned with real operations.
