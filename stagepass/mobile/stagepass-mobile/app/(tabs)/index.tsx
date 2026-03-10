import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { HomeDashboardScreen } from '@/components/screens/HomeDashboardScreen';
import { StagepassLoader } from '@/components/StagepassLoader';
import { useAppRole } from '~/hooks/useAppRole';
import { api, type Event as EventType } from '~/services/api';

const todayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Normalize event date to YYYY-MM-DD (handles "2026-03-10" or "2026-03-10T00:00:00.000Z"). */
function eventDateOnly(event: EventType): string {
  if (!event.date || typeof event.date !== 'string') return '';
  const s = event.date.trim();
  return s.length >= 10 ? s.substring(0, 10) : s;
}

function isEventToday(event: EventType, today: string): boolean {
  const d = eventDateOnly(event);
  return d !== '' && d === today;
}

function isPastEvent(event: EventType): boolean {
  if (event.status === 'completed' || event.status === 'closed') return true;
  const eventDate = eventDateOnly(event);
  return eventDate !== '' && eventDate < todayDateString();
}

export default function HomeScreen() {
  const role = useAppRole();
  const [eventToday, setEventToday] = useState<EventType | null | undefined>(undefined);
  const [pastEvents, setPastEvents] = useState<EventType[]>([]);
  const [eventsTodayList, setEventsTodayList] = useState<EventType[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchMyEventToday = useCallback(async () => {
    const today = todayDateString();
    try {
      const res = await api.events.myEventToday(today);
      let event = res.event ?? null;
      if (!event) {
        const listRes = await api.events.list({ per_page: 100 });
        const list = Array.isArray(listRes?.data) ? listRes.data : [];
        const todayEvent = list.find((e) => isEventToday(e, today));
        if (todayEvent) {
          const full = await api.events.get(todayEvent.id);
          event = full;
        }
      }
      setEventToday(event);
    } catch {
      setEventToday(null);
    }
  }, []);

  const fetchEventsTodayList = useCallback(async () => {
    const today = todayDateString();
    try {
      const res = await api.events.list({ per_page: 100 });
      const list = Array.isArray(res?.data) ? res.data : [];
      const todayList = list.filter((e) => isEventToday(e, today));
      todayList.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      setEventsTodayList(todayList);
    } catch {
      setEventsTodayList([]);
    }
  }, []);

  const fetchTaskCount = useCallback(async () => {
    try {
      const res = await api.tasks.list({ per_page: 1 });
      const total = 'total' in res && typeof res.total === 'number' ? res.total : 0;
      setTaskCount(total);
    } catch {
      setTaskCount(0);
    }
  }, []);

  const fetchPastEventsForAdmin = useCallback(async () => {
    try {
      const res = await api.events.list({ per_page: 50 });
      const list = Array.isArray(res?.data) ? res.data : [];
      const past = list.filter(isPastEvent);
      past.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setPastEvents(past.slice(0, 20));
    } catch {
      setPastEvents([]);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      if (role === 'admin') {
        await Promise.all([fetchPastEventsForAdmin(), fetchEventsTodayList()]);
      } else {
        await fetchMyEventToday();
        await fetchEventsTodayList();
      }
      await fetchTaskCount();
    } finally {
      setLoading(false);
    }
  }, [role, fetchMyEventToday, fetchPastEventsForAdmin, fetchEventsTodayList, fetchTaskCount]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      if (role !== 'admin') {
        fetchMyEventToday();
        fetchEventsTodayList();
        fetchTaskCount();
      }
    }, [role, fetchMyEventToday, fetchEventsTodayList, fetchTaskCount])
  );

  const onRefresh = useCallback(async () => {
    if (role === 'admin') {
      await fetchPastEventsForAdmin();
      await fetchEventsTodayList();
    } else {
      await fetchMyEventToday();
      await fetchEventsTodayList();
    }
    await fetchTaskCount();
  }, [role, fetchMyEventToday, fetchPastEventsForAdmin, fetchEventsTodayList, fetchTaskCount]);

  if (loading) {
    return <StagepassLoader message="Loading…" fullScreen />;
  }

  return (
    <HomeDashboardScreen
      eventToday={eventToday ?? null}
      eventsTodayList={eventsTodayList}
      taskCount={taskCount}
      notificationCount={0}
      onRefresh={onRefresh}
      role={role}
      pastEvents={role === 'admin' ? pastEvents : []}
    />
  );
}
