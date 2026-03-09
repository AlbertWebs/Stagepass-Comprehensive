import { useCallback, useEffect, useState } from 'react';
import { HomeDashboardScreen } from '@/components/screens/HomeDashboardScreen';
import { StagepassLoader } from '@/components/StagepassLoader';
import { api, type Event as EventType } from '~/services/api';

function isTodayOrUpcoming(dateStr: string): boolean {
  try {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() >= today.getTime();
  } catch {
    return true;
  }
}

function sortByDate(a: EventType, b: EventType): number {
  try {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  } catch {
    return 0;
  }
}

/** Resolve event to show: today's assigned event, or next upcoming assigned event. */
function resolveDisplayEvent(todayEvent: EventType | null, listEvents: EventType[]): EventType | null {
  if (todayEvent) return todayEvent;
  const upcoming = listEvents.filter((e) => isTodayOrUpcoming(e.date)).sort(sortByDate);
  return upcoming[0] ?? null;
}

export default function HomeScreen() {
  const [eventToday, setEventToday] = useState<EventType | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const [todayRes, listRes] = await Promise.all([
        api.events.myEventToday(),
        api.events.list().catch(() => ({ data: [] as EventType[] })),
      ]);
      const list = Array.isArray(listRes?.data) ? listRes.data : [];
      const display = resolveDisplayEvent(todayRes.event ?? null, list);
      setEventToday(display);
    } catch {
      setEventToday(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (loading) {
    return <StagepassLoader message="Loading…" fullScreen />;
  }

  return (
    <HomeDashboardScreen
      eventToday={eventToday ?? null}
      onRefresh={fetchEvents}
    />
  );
}
