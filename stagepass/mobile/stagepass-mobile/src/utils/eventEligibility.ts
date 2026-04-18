/**
 * Client-side rules aligned with backend `EventAttendanceEligibility` (Laravel).
 * Used for UI: badges, disabling check-in/out, status copy.
 */
import type { Event } from '~/services/api';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function eventDateYmd(event: Event): string {
  const raw = event.date;
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function hmToMins(hm: string | undefined): number | null {
  if (!hm || typeof hm !== 'string') return null;
  const part = hm.trim().slice(0, 5);
  const m = /^(\d{1,2}):(\d{2})$/.exec(part);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

/** Last scheduled instant (local device clock) for the event window. */
export function getScheduledEndMs(event: Event): number {
  const startYmd = eventDateYmd(event);
  if (!startYmd) return 0;
  const [yy, mm, dd] = startYmd.split('-').map((x) => Number(x));
  const startHm = (event.start_time || '00:00').slice(0, 5);
  const endRaw = event.expected_end_time;
  const endHm = endRaw ? endRaw.slice(0, 5) : '23:59';
  const endHasSec = Boolean(endRaw && String(endRaw).length >= 8);
  const endParts = endHasSec
    ? String(endRaw)
        .trim()
        .split(':')
        .map((x) => Number(x))
    : [Number(endHm.split(':')[0]), Number(endHm.split(':')[1]), 59];

  let lastYmd = startYmd;
  if (event.end_date && typeof event.end_date === 'string') {
    const ed = event.end_date.trim();
    lastYmd = ed.length >= 10 ? ed.slice(0, 10) : startYmd;
  } else {
    const sm = hmToMins(startHm);
    const em = hmToMins(endHm);
    if (sm != null && em != null && em < sm) {
      const d = new Date(yy, mm - 1, dd);
      d.setDate(d.getDate() + 1);
      lastYmd = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
  }

  const [ey, emo, edd] = lastYmd.split('-').map((x) => Number(x));
  const th = Number(endParts[0]) || 0;
  const tmin = Number(endParts[1]) || 0;
  const ts = Number(endParts[2]) || 0;
  return new Date(ey, emo - 1, edd, th, tmin, ts, 0).getTime();
}

export function getScheduledStartMs(event: Event): number {
  const ymd = eventDateYmd(event);
  if (!ymd) return 0;
  const [yy, mm, dd] = ymd.split('-').map((x) => Number(x));
  const st = (event.start_time || '00:00').slice(0, 5);
  const [h, m] = st.split(':').map((x) => Number(x));
  return new Date(yy, mm - 1, dd, h || 0, m || 0, 0, 0).getTime();
}

export function isEndedEventStatus(status: string | undefined): boolean {
  const s = String(status || '')
    .trim()
    .toLowerCase();
  return s === 'completed' || s === 'closed' || s === 'done_for_the_day';
}

export function eventTimeHasPassed(event: Event, now: Date = new Date()): boolean {
  const end = getScheduledEndMs(event);
  if (!end) return false;
  return now.getTime() > end;
}

export function userAssignedToEvent(event: Event, userId: number | undefined): boolean {
  if (userId == null) return false;
  return Boolean(event.crew?.some((c) => Number(c.id) === Number(userId)));
}

export function getAssignmentPivot(event: Event, userId: number | undefined) {
  if (userId == null) return null;
  const m = event.crew?.find((c) => Number(c.id) === Number(userId));
  return (m?.pivot ?? null) as {
    checkin_time?: string | null;
    checkout_time?: string | null;
  } | null;
}

export function isActiveNow(event: Event, now: Date = new Date()): boolean {
  if (isEndedEventStatus(event.status)) return false;
  const t = now.getTime();
  const start = getScheduledStartMs(event);
  const end = getScheduledEndMs(event);
  if (!start || !end) return false;
  return t >= start && t <= end;
}

export type MobileActivityBadgeKey =
  | 'upcoming'
  | 'active'
  | 'checked_in'
  | 'checked_out'
  | 'done_for_the_day'
  | 'event_passed'
  | 'closed'
  | 'completed';

export type MobileActivityBadge = { key: MobileActivityBadgeKey; label: string };

const LABEL: Record<MobileActivityBadgeKey, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  checked_in: 'Checked In',
  checked_out: 'Checked out',
  done_for_the_day: 'Done for the Day',
  event_passed: 'Event has already passed',
  closed: 'Closed',
  completed: 'Completed',
};

export function getMobileActivityBadge(event: Event, userId: number | undefined, now: Date = new Date()): MobileActivityBadge {
  const s = String(event.status || '')
    .trim()
    .toLowerCase();
  if (s === 'done_for_the_day') return { key: 'done_for_the_day', label: LABEL.done_for_the_day };
  if (s === 'closed') return { key: 'closed', label: LABEL.closed };
  if (s === 'completed') return { key: 'completed', label: LABEL.completed };

  const pivot = getAssignmentPivot(event, userId);
  if (pivot?.checkout_time) {
    return { key: 'checked_out', label: LABEL.checked_out };
  }
  if (pivot?.checkin_time) {
    return { key: 'checked_in', label: LABEL.checked_in };
  }

  if (eventTimeHasPassed(event, now)) {
    return { key: 'event_passed', label: LABEL.event_passed };
  }

  if (isActiveNow(event, now)) {
    return { key: 'active', label: LABEL.active };
  }

  return { key: 'upcoming', label: LABEL.upcoming };
}

export function canCheckInEligibility(event: Event, userId: number | undefined, now: Date = new Date()): boolean {
  if (!userAssignedToEvent(event, userId)) return false;
  if (isEndedEventStatus(event.status)) return false;
  const pivot = getAssignmentPivot(event, userId);
  if (pivot?.checkin_time) return false;
  if (eventTimeHasPassed(event, now)) return false;
  return true;
}

export function canCheckOutEligibility(event: Event, userId: number | undefined, now: Date = new Date()): boolean {
  if (!userAssignedToEvent(event, userId)) return false;
  if (isEndedEventStatus(event.status)) return false;
  const pivot = getAssignmentPivot(event, userId);
  if (!pivot?.checkin_time || pivot?.checkout_time) return false;
  return true;
}

/** Team leader manual check-in: same time/status gates as self check-in, without assignment to the leader. */
export function canLeaderManualCheckIn(event: Event, now: Date = new Date()): boolean {
  if (isEndedEventStatus(event.status)) return false;
  if (eventTimeHasPassed(event, now)) return false;
  return true;
}
