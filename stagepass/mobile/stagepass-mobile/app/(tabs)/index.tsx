import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { HomeDashboardScreen } from '@/components/screens/HomeDashboardScreen';
import { useAppRole } from '~/hooks/useAppRole';
import { api, type Event as EventType, type Payment } from '~/services/api';
import { setUser } from '~/store/authSlice';
import { getDevicePushTokenAsync } from '~/utils/pushToken';

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
  const dispatch = useDispatch();
  const role = useAppRole();
  const [animateKey, setAnimateKey] = useState(0);
  const [eventToday, setEventToday] = useState<EventType | null | undefined>(undefined);
  const [pastEvents, setPastEvents] = useState<EventType[]>([]);
  const [eventsTodayList, setEventsTodayList] = useState<EventType[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [equipmentCount, setEquipmentCount] = useState(0);
  const [approvedAllowances, setApprovedAllowances] = useState<Payment[]>([]);

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
      const [pendingRes, inProgressRes] = await Promise.all([
        api.tasks.list({ status: 'pending', per_page: 1 }),
        api.tasks.list({ status: 'in_progress', per_page: 1 }),
      ]);
      const pendingTotal = 'total' in pendingRes && typeof pendingRes.total === 'number' ? pendingRes.total : 0;
      const inProgressTotal = 'total' in inProgressRes && typeof inProgressRes.total === 'number' ? inProgressRes.total : 0;
      setTaskCount(pendingTotal + inProgressTotal);
    } catch {
      setTaskCount(0);
    }
  }, []);

  const fetchEquipmentCount = useCallback(async () => {
    setEquipmentCount(0);
  }, []);

  const fetchApprovedAllowances = useCallback(async () => {
    try {
      const res = await api.payments.list({ status: 'approved', per_page: 50 });
      const list = Array.isArray(res?.data) ? res.data : [];
      setApprovedAllowances(list);
    } catch {
      setApprovedAllowances([]);
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
    // Refresh user first so office check-in state is correct after login (login response has no office_* fields).
    try {
      const me = await api.auth.me();
      dispatch(setUser(me));
    } catch {
      // keep existing user
    }
    if (role === 'admin') {
      await Promise.all([fetchPastEventsForAdmin(), fetchEventsTodayList()]);
    } else {
      await fetchMyEventToday();
      await fetchEventsTodayList();
    }
    await fetchTaskCount();
    await fetchEquipmentCount();
    await fetchApprovedAllowances();
    getDevicePushTokenAsync().then((token) => {
      if (token) api.auth.updateProfile({ fcm_token: token }).catch(() => {});
    });
  }, [role, dispatch, fetchMyEventToday, fetchPastEventsForAdmin, fetchEventsTodayList, fetchTaskCount, fetchEquipmentCount, fetchApprovedAllowances]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      setAnimateKey((k) => k + 1);
      if (role !== 'admin') {
        fetchMyEventToday();
        fetchEventsTodayList();
        fetchTaskCount();
        fetchEquipmentCount();
        fetchApprovedAllowances();
      }
      // Refresh /me so has_approved_time_off_today and office check-in state are up to date (e.g. after admin adds time off on web).
      api.auth.me().then((me) => dispatch(setUser(me))).catch(() => {});
      getDevicePushTokenAsync().then((token) => {
        if (token) api.auth.updateProfile({ fcm_token: token }).catch(() => {});
      });
    }, [role, dispatch, fetchMyEventToday, fetchEventsTodayList, fetchTaskCount, fetchEquipmentCount, fetchApprovedAllowances])
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
    await fetchEquipmentCount();
    await fetchApprovedAllowances();
    try {
      const me = await api.auth.me();
      dispatch(setUser(me));
    } catch {
      // ignore
    }
    getDevicePushTokenAsync().then((token) => {
      if (token) api.auth.updateProfile({ fcm_token: token }).catch(() => {});
    });
  }, [role, dispatch, fetchMyEventToday, fetchPastEventsForAdmin, fetchEventsTodayList, fetchTaskCount, fetchEquipmentCount, fetchApprovedAllowances]);

  return (
    <Animated.View key={animateKey} entering={SlideInRight.duration(320)} style={{ flex: 1 }}>
      <HomeDashboardScreen
      eventToday={eventToday ?? null}
      allowanceToday={eventToday?.daily_allowance ?? null}
      eventsTodayList={eventsTodayList}
      taskCount={taskCount}
      notificationCount={0}
      onRefresh={onRefresh}
      role={role}
      pastEvents={role === 'admin' ? pastEvents : []}
      equipmentCount={equipmentCount}
      approvedAllowances={approvedAllowances}
    />
    </Animated.View>
  );
}
