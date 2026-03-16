/**
 * Builds the list of recent check-in activities (office + event) for display on home and Recent Activity page.
 */
import { useMemo } from 'react';
import type { User } from '~/services/api';
import type { Event as EventType } from '~/services/api';

export type ActivityType = 'office_checkin' | 'office_checkout' | 'event_checkin' | 'event_checkout';

export type RecentActivityItem = {
  key: string;
  title: string;
  sub: string;
  time: string;
  timeIso: string;
  icon: 'location' | 'exit' | 'checkmark-circle';
  type: ActivityType;
  relativeTime: string;
};

function formatRelativeTime(timeIso: string): string {
  try {
    const then = new Date(timeIso);
    if (Number.isNaN(then.getTime())) return '—';
    const now = new Date();
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24 && then.getDate() === now.getDate()) return `${diffHours}h ago`;
    if (diffDays === 0) return then.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

export function useRecentCheckinActivities(
  user: User | null,
  eventToday: EventType | null,
  optimisticOfficeCheckinTime: string | null
): RecentActivityItem[] {
  return useMemo(() => {
    const items: RecentActivityItem[] = [];
    const officeCheckinTime = user?.office_checkin_time ?? optimisticOfficeCheckinTime;

    if (officeCheckinTime) {
      try {
        const t = new Date(officeCheckinTime);
        const timeStr = Number.isNaN(t.getTime()) ? '—' : t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        items.push({
          key: 'office-checkin',
          title: 'Office check-in',
          sub: 'Daily shift started',
          time: timeStr,
          timeIso: officeCheckinTime,
          icon: 'location',
          type: 'office_checkin',
          relativeTime: formatRelativeTime(officeCheckinTime),
        });
      } catch {
        items.push({ key: 'office-checkin', title: 'Office check-in', sub: 'Daily shift started', time: '—', timeIso: officeCheckinTime, icon: 'location', type: 'office_checkin', relativeTime: '—' });
      }
    }

    if (user?.office_checkout_time) {
      try {
        const t = new Date(user.office_checkout_time);
        items.push({
          key: 'office-checkout',
          title: 'Office checkout',
          sub: 'Shift ended',
          time: t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          timeIso: user.office_checkout_time,
          icon: 'exit',
          type: 'office_checkout',
          relativeTime: formatRelativeTime(user.office_checkout_time),
        });
      } catch {
        items.push({ key: 'office-checkout', title: 'Office checkout', sub: 'Shift ended', time: '—', timeIso: user.office_checkout_time, icon: 'exit', type: 'office_checkout', relativeTime: '—' });
      }
    }

    const myAssignment = eventToday?.crew?.find((c: { pivot?: unknown }) => c.pivot);
    const pivotData = myAssignment && typeof myAssignment === 'object' && 'pivot' in myAssignment
      ? (myAssignment.pivot as { checkin_time?: string; checkout_time?: string })
      : undefined;

    if (pivotData?.checkin_time && eventToday?.name) {
      try {
        const t = new Date(pivotData.checkin_time);
        items.push({
          key: 'event-checkin',
          title: `Checked in: ${eventToday.name}`,
          sub: 'Event',
          time: t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          timeIso: pivotData.checkin_time,
          icon: 'checkmark-circle',
          type: 'event_checkin',
          relativeTime: formatRelativeTime(pivotData.checkin_time),
        });
      } catch {
        items.push({ key: 'event-checkin', title: `Checked in: ${eventToday.name}`, sub: 'Event', time: '—', timeIso: pivotData.checkin_time, icon: 'checkmark-circle', type: 'event_checkin', relativeTime: '—' });
      }
    }

    if (pivotData?.checkout_time && eventToday?.name) {
      try {
        const t = new Date(pivotData.checkout_time);
        items.push({
          key: 'event-checkout',
          title: `Checked out: ${eventToday.name}`,
          sub: 'Event',
          time: t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          timeIso: pivotData.checkout_time,
          icon: 'exit',
          type: 'event_checkout',
          relativeTime: formatRelativeTime(pivotData.checkout_time),
        });
      } catch {
        items.push({ key: 'event-checkout', title: `Checked out: ${eventToday.name}`, sub: 'Event', time: '—', timeIso: pivotData.checkout_time, icon: 'exit', type: 'event_checkout', relativeTime: '—' });
      }
    }

    items.sort((a, b) => new Date(b.timeIso).getTime() - new Date(a.timeIso).getTime());
    return items;
  }, [user?.office_checkin_time, user?.office_checkout_time, optimisticOfficeCheckinTime, eventToday?.name, eventToday?.crew]);
}

export function getActivityAccentColor(type: ActivityType, isDark: boolean): string {
  const themeBlue = '#0f1838';
  const sky = '#0ea5e9';
  const checkedIn = '#16A34A';
  if (isDark) {
    switch (type) {
      case 'office_checkin': return sky;
      case 'office_checkout': return '#A1A1AA';
      case 'event_checkin': return checkedIn;
      case 'event_checkout': return '#A1A1AA';
      default: return '#f59e0b';
    }
  }
  switch (type) {
    case 'office_checkin': return sky;
    case 'office_checkout': return '#64748B';
    case 'event_checkin': return checkedIn;
    case 'event_checkout': return '#64748B';
    default: return themeBlue;
  }
}
