import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { api, type Event } from '~/services/api';
import { HomeHeader } from '@/components/HomeHeader';
import { DateStrip } from '@/components/DateStrip';
import { EventCard, type EventDisplayStatus } from '@/components/EventCard';
import { StagepassLoader } from '@/components/StagepassLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StatusColors, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useAppRole } from '~/hooks/useAppRole';

const TAB_BAR_HEIGHT = 58;
const U = { xs: 6, sm: 8, md: 12, lg: 14, xl: 16, section: 24 };
const CARD_RADIUS = 12;

function eventMatchesDate(event: Event, date: Date): boolean {
  try {
    const d = new Date(event.date);
    d.setHours(0, 0, 0, 0);
    const sel = new Date(date);
    sel.setHours(0, 0, 0, 0);
    return d.getTime() === sel.getTime();
  } catch {
    return false;
  }
}

function sortByTime(a: Event, b: Event): number {
  try {
    const tA = (a.start_time || '').replace(':', '');
    const tB = (b.start_time || '').replace(':', '');
    return tA.localeCompare(tB) || new Date(a.date).getTime() - new Date(b.date).getTime();
  } catch {
    return 0;
  }
}

/** My Events: show Created | Checked in | Checked out | Completed from event status + current user's crew pivot */
function getEventDisplayStatus(event: Event, userId: number | undefined): EventDisplayStatus {
  if (event.status === 'completed' || event.status === 'closed') return 'completed';
  if (userId == null || !event.crew?.length) return 'created';
  const me = event.crew.find((c) => c.id === userId);
  if (!me?.pivot) return 'created';
  if (me.pivot.checkout_time) return 'checked_out';
  if (me.pivot.checkin_time) return 'checked_in';
  return 'created';
}

export default function EventsTab() {
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const role = useAppRole();
  const userId = useSelector((s: { auth: { user: { id: number } | null } }) => s.auth.user?.id);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [eventFilter, setEventFilter] = useState<'all' | 'upcoming' | 'completed'>('upcoming');
  const [dailyAllowance, setDailyAllowance] = useState<string | number | null>(null);
  const scrollBottomPadding = TAB_BAR_HEIGHT;
  const isCrewOrTeamLeader = role === 'crew' || role === 'team_leader';
  const canAccessSettings = role === 'super_admin' || role === 'director' || role === 'admin';

  useEffect(() => {
    if (!canAccessSettings) return;
    api.settings.get().then((s) => {
      const v = s?.daily_allowance ?? s?.default_daily_allowance;
      setDailyAllowance(v != null ? (typeof v === 'number' ? v : Number(v) || v) : null);
    }).catch(() => {});
  }, [canAccessSettings]);

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.events.list();
      const list = Array.isArray(res?.data) ? res.data : [];
      setEvents(list.sort(sortByTime));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEvents();
  }, [loadEvents]);

  const eventsOnSelectedDate = useMemo(() => {
    let list = events.filter((e) => eventMatchesDate(e, selectedDate));
    if (eventFilter === 'upcoming') {
      list = list.filter((e) => e.status !== 'completed' && e.status !== 'closed');
    } else if (eventFilter === 'completed') {
      list = list.filter((e) => e.status === 'completed' || e.status === 'closed');
    }
    return list;
  }, [events, selectedDate, eventFilter]);

  if (loading) {
    return <StagepassLoader message="Loading events…" fullScreen />;
  }

  const sectionTitle = (() => {
    const d = new Date(selectedDate);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return "Today's Events";
    return 'Events';
  })();

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="My Events" />
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        <View style={[styles.dateStripWrap, { backgroundColor: colors.surface }]}>
          <DateStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </View>

        <View style={styles.filterRow}>
          {(['upcoming', 'all', 'completed'] as const).map((filter) => {
            const isActive = eventFilter === filter;
            return (
              <Pressable
                key={filter}
                onPress={() => setEventFilter(filter)}
                style={[
                  styles.filterTab,
                  { borderColor: isActive ? themeYellow : colors.border },
                  isActive && { backgroundColor: themeYellow + '1c', borderWidth: 1.5 },
                ]}
              >
                <ThemedText
                  style={[
                    styles.filterTabText,
                    { color: isActive ? colors.text : colors.textSecondary },
                  ]}
                >
                  {filter === 'all' ? 'All Events' : filter === 'upcoming' ? 'Upcoming' : 'Completed'}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {isCrewOrTeamLeader && (
          <View style={[styles.allowanceCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: StatusColors.checkedIn }]}>
            <View style={[styles.allowanceIconWrap, { backgroundColor: StatusColors.checkedIn + '18', borderColor: StatusColors.checkedIn + '35' }]}>
              <Ionicons name="wallet-outline" size={18} color={StatusColors.checkedIn} />
            </View>
            <View style={styles.allowanceTextWrap}>
              <ThemedText style={[styles.allowanceValue, { color: colors.text }]}>
                {dailyAllowance != null
                  ? (typeof dailyAllowance === 'number' ? `KES ${dailyAllowance}` : String(dailyAllowance))
                  : '0.00 KES'}
              </ThemedText>
              <ThemedText style={[styles.allowanceLabel, { color: colors.textSecondary }]}>DAILY ALLOWANCE</ThemedText>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
          <Ionicons name="calendar" size={18} color={themeYellow} style={styles.sectionIcon} />
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            {sectionTitle}
          </ThemedText>
        </View>

        {events.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.surface, borderColor: themeYellow }]}>
              <Ionicons name="calendar-outline" size={36} color={themeYellow} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              No events yet
            </ThemedText>
            <ThemedText style={[styles.emptySub, { color: colors.textSecondary }]}>
              Your assigned events will appear here. Pull down to refresh.
            </ThemedText>
            <Pressable
              onPress={onRefresh}
              disabled={refreshing}
              style={({ pressed }) => [
                styles.emptyButton,
                { opacity: refreshing ? 0.85 : pressed ? 0.9 : 1, backgroundColor: themeYellow },
              ]}
            >
              {refreshing ? (
                <View style={styles.emptyButtonContent}>
                  <ActivityIndicator size="small" color={themeBlue} />
                  <ThemedText style={styles.emptyButtonText}>Refreshing…</ThemedText>
                </View>
              ) : (
                <ThemedText style={styles.emptyButtonText}>Refresh events</ThemedText>
              )}
            </Pressable>
          </View>
        ) : eventsOnSelectedDate.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconWrapSmall, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="today-outline" size={26} color={colors.textSecondary} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              No events on this day
            </ThemedText>
            <ThemedText style={[styles.emptySub, { color: colors.textSecondary }]}>
              Select another date or pull down to refresh.
            </ThemedText>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.list, { paddingBottom: scrollBottomPadding }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={themeYellow}
              />
            }
          >
            {eventsOnSelectedDate.map((item) => (
              <EventCard
                key={item.id}
                event={{
                  id: item.id,
                  name: item.name,
                  date: item.date,
                  start_time: item.start_time,
                  expected_end_time: item.expected_end_time,
                  location_name: item.location_name,
                  status: item.status,
                }}
                displayStatus={getEventDisplayStatus(item, userId)}
                onPress={() => router.push({ pathname: '/events/[id]', params: { id: String(item.id) } })}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: U.lg,
  },
  dateStripWrap: {
    marginHorizontal: -U.lg,
    paddingBottom: U.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(234, 179, 8, 0.2)',
  },
  filterRow: {
    flexDirection: 'row',
    gap: U.sm,
    marginTop: U.md,
    marginBottom: U.sm,
  },
  filterTab: {
    flex: 1,
    paddingVertical: U.sm,
    paddingHorizontal: U.xs,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  allowanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: U.md,
    padding: U.lg,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginTop: U.md,
    marginBottom: U.lg,
  },
  allowanceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  allowanceTextWrap: {
    flex: 1,
  },
  allowanceValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  allowanceLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: U.lg,
    marginBottom: U.md,
  },
  sectionTitleAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    marginRight: U.sm,
  },
  sectionIcon: {
    marginRight: U.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  list: {
    paddingBottom: 0,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: U.section * 2,
  },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: U.lg,
    shadowColor: themeYellow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyIconWrapSmall: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: U.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: U.sm,
    letterSpacing: 0.2,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
    marginBottom: U.lg,
    lineHeight: 20,
  },
  emptyButton: {
    paddingVertical: U.md,
    paddingHorizontal: U.xl,
    borderRadius: CARD_RADIUS,
    shadowColor: themeBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: U.sm,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: themeBlue,
  },
});
