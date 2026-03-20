import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { api, type Event } from '~/services/api';
import { HomeHeader } from '@/components/HomeHeader';
import { EventCard, type EventDisplayStatus } from '@/components/EventCard';
import { StagepassLoader } from '@/components/StagepassLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Cards, Icons, Typography, UI } from '@/constants/ui';
import { Spacing, StatusColors, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useNavigationPress } from '@/src/utils/navigationPress';
import { useAppRole } from '~/hooks/useAppRole';

const TAB_BAR_HEIGHT = 58;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfWeekLocal(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

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
  const handleNav = useNavigationPress();
  const { colors } = useStagePassTheme();
  const role = useAppRole();
  const userId = useSelector((s: { auth: { user: { id: number } | null } }) => s.auth.user?.id);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [eventFilter, setEventFilter] = useState<'all' | 'upcoming' | 'completed'>('upcoming');
  const [dailyAllowance, setDailyAllowance] = useState<string | number | null>(null);
  const [animateKey, setAnimateKey] = useState(0);
  const scrollBottomPadding = TAB_BAR_HEIGHT;

  useFocusEffect(
    useCallback(() => {
      setAnimateKey((k) => k + 1);
    }, [])
  );
  const isCrewOrTeamLeader = role === 'crew' || role === 'team_leader';
  const canAccessSettings = role === 'super_admin' || role === 'director' || role === 'admin';

  useEffect(() => {
    if (canAccessSettings) {
      api.settings.get().then((s) => {
        const v = s?.daily_allowance ?? s?.default_daily_allowance;
        setDailyAllowance(v != null ? (typeof v === 'number' ? v : Number(v) || v) : null);
      }).catch(() => {});
    }
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

  const dailyAllowanceFromEvents = useMemo(() => {
    if (!isCrewOrTeamLeader || eventsOnSelectedDate.length === 0) return null;
    const firstWithAllowance = eventsOnSelectedDate.find(
      (e) => e.daily_allowance != null && Number(e.daily_allowance) > 0
    );
    const v = firstWithAllowance?.daily_allowance;
    return v != null ? (typeof v === 'number' ? v : Number(v) || null) : null;
  }, [isCrewOrTeamLeader, eventsOnSelectedDate]);

  const displayDailyAllowance = canAccessSettings ? dailyAllowance : dailyAllowanceFromEvents;

  const weekDays = useMemo(() => {
    const start = startOfWeekLocal(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const monthCells = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const monthStartOffset = firstDay.getDay();
    const gridStart = addDays(firstDay, -monthStartOffset);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [visibleMonth]);

  const selectedDateKey = dateKey(selectedDate);

  const selectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    const m = new Date(date);
    m.setDate(1);
    m.setHours(0, 0, 0, 0);
    setVisibleMonth(m);
  }, []);

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
  const isTodaySelected = sectionTitle === "Today's Events";

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="My Events" />
      <Animated.View
        key={animateKey}
        entering={SlideInRight.duration(320)}
        style={{ flex: 1 }}
      >
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        <View style={[styles.dateStripWrap, { backgroundColor: colors.surface }]}>
          <View style={styles.calendarModeRow}>
            <View style={[styles.calendarModeWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {(['week', 'month'] as const).map((mode) => {
                const active = calendarView === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setCalendarView(mode)}
                    style={[
                      styles.calendarModeBtn,
                      active && { backgroundColor: themeYellow + '22', borderColor: themeYellow, borderWidth: 1 },
                    ]}
                  >
                    <ThemedText style={[styles.calendarModeText, { color: active ? colors.text : colors.textSecondary }]}>
                      {mode === 'week' ? 'Week' : 'Month'}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {calendarView === 'week' ? (
            <View style={styles.weekWrap}>
              <View style={styles.calendarHeaderRow}>
                <Pressable
                  onPress={() => selectDate(addDays(selectedDate, -7))}
                  style={[styles.calendarNavBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                >
                  <Ionicons name="chevron-back" size={Icons.medium} color={colors.textSecondary} />
                </Pressable>
                <ThemedText style={[styles.calendarLabel, { color: colors.text }]}>
                  {MONTH_LABELS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                </ThemedText>
                <Pressable
                  onPress={() => selectDate(addDays(selectedDate, 7))}
                  style={[styles.calendarNavBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                >
                  <Ionicons name="chevron-forward" size={Icons.medium} color={colors.textSecondary} />
                </Pressable>
              </View>
              <View style={styles.weekDaysRow}>
                {weekDays.map((d) => {
                  const isSelected = dateKey(d) === selectedDateKey;
                  return (
                    <Pressable
                      key={dateKey(d)}
                      onPress={() => selectDate(d)}
                      style={[
                        styles.weekDayChip,
                        { borderColor: colors.border, backgroundColor: isSelected ? themeYellow : colors.background },
                      ]}
                    >
                      <ThemedText style={[styles.weekDayLabel, { color: isSelected ? themeBlue : colors.textSecondary }]}>
                        {DAY_LABELS[d.getDay()]}
                      </ThemedText>
                      <ThemedText style={[styles.weekDayNum, { color: isSelected ? themeBlue : colors.text }]}>
                        {d.getDate()}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.monthWrap}>
              <View style={styles.calendarHeaderRow}>
                <Pressable
                  onPress={() => setVisibleMonth((m) => addMonths(m, -1))}
                  style={[styles.calendarNavBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                >
                  <Ionicons name="chevron-back" size={Icons.medium} color={colors.textSecondary} />
                </Pressable>
                <ThemedText style={[styles.calendarLabel, { color: colors.text }]}>
                  {MONTH_LABELS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
                </ThemedText>
                <Pressable
                  onPress={() => setVisibleMonth((m) => addMonths(m, 1))}
                  style={[styles.calendarNavBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                >
                  <Ionicons name="chevron-forward" size={Icons.medium} color={colors.textSecondary} />
                </Pressable>
              </View>
              <View style={styles.monthWeekdayRow}>
                {DAY_LABELS.map((label) => (
                  <ThemedText key={label} style={[styles.monthWeekdayText, { color: colors.textSecondary }]}>
                    {label}
                  </ThemedText>
                ))}
              </View>
              <View style={styles.monthGrid}>
                {monthCells.map((d) => {
                  const key = dateKey(d);
                  const isSelected = key === selectedDateKey;
                  const inCurrentMonth = d.getMonth() === visibleMonth.getMonth();
                  return (
                    <Pressable
                      key={key}
                      onPress={() => selectDate(d)}
                      style={[
                        styles.monthCell,
                        {
                          borderColor: colors.border,
                          backgroundColor: isSelected ? themeYellow : colors.background,
                          opacity: inCurrentMonth ? 1 : 0.55,
                        },
                      ]}
                    >
                      <ThemedText style={[styles.monthCellText, { color: isSelected ? themeBlue : colors.text }]}>
                        {d.getDate()}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
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
              <Ionicons name="wallet-outline" size={Icons.header} color={StatusColors.checkedIn} />
            </View>
            <View style={styles.allowanceTextWrap}>
              <ThemedText style={[styles.allowanceValue, { color: colors.text }]}>
                {displayDailyAllowance != null
                  ? `KES ${Number(displayDailyAllowance).toLocaleString()}`
                  : '0.00 KES'}
              </ThemedText>
              <ThemedText style={[styles.allowanceLabel, { color: colors.textSecondary }]}>DAILY ALLOWANCE</ThemedText>
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
          <Ionicons name="calendar" size={Icons.header} color={themeYellow} style={styles.sectionIcon} />
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
            {sectionTitle}
          </ThemedText>
        </View>

        {events.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.surface, borderColor: themeYellow }]}>
              <Ionicons name="calendar-outline" size={Icons.large} color={themeYellow} />
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
              <Ionicons name="today-outline" size={Icons.xl} color={colors.textSecondary} />
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
                borderOnly={isTodaySelected}
                onPress={() => handleNav(() => router.push({ pathname: '/events/[id]', params: { id: String(item.id) } }))}
              />
            ))}
          </ScrollView>
        )}
      </View>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  dateStripWrap: {
    marginHorizontal: -Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(234, 179, 8, 0.2)',
  },
  calendarModeRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  calendarModeWrap: {
    flexDirection: 'row',
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  calendarModeBtn: {
    flex: 1,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Cards.borderRadius,
    alignItems: 'center',
  },
  calendarModeText: {
    fontSize: Typography.label,
    fontWeight: Typography.labelWeight,
  },
  weekWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  monthWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  calendarNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarLabel: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.titleCardWeight,
  },
  weekDaysRow: {
    flexDirection: 'row',
    gap: 6,
  },
  weekDayChip: {
    flex: 1,
    minWidth: 0,
    borderRadius: Cards.borderRadiusSmall,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  weekDayLabel: {
    fontSize: 10,
    fontWeight: Typography.labelWeight,
  },
  weekDayNum: {
    fontSize: 14,
    fontWeight: Typography.titleCardWeight,
    marginTop: 2,
  },
  monthWeekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  monthWeekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: Typography.labelWeight,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  monthCell: {
    width: '13.3%',
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCellText: {
    fontSize: 12,
    fontWeight: Typography.buttonTextWeight,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  filterTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterTabText: {
    fontSize: Typography.label,
    fontWeight: Typography.labelWeight,
  },
  allowanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
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
    fontSize: Typography.body,
    fontWeight: Typography.titleCardWeight,
    letterSpacing: 0.2,
  },
  allowanceLabel: {
    fontSize: Typography.labelSmall,
    fontWeight: Typography.labelSmallWeight,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitleAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  sectionIcon: {
    marginRight: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.titleSection,
    fontWeight: Typography.titleSectionWeight,
    letterSpacing: Typography.titleSectionLetterSpacing,
    textTransform: 'uppercase',
  },
  list: {
    paddingBottom: 0,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: Spacing.lg,
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
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.titleCard,
    fontWeight: Typography.titleCardWeight,
    marginBottom: Spacing.sm,
    letterSpacing: 0.2,
  },
  emptySub: {
    fontSize: Typography.bodySmall,
    textAlign: 'center',
    maxWidth: 260,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  emptyButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Cards.borderRadius,
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
    gap: Spacing.sm,
  },
  emptyButtonText: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.buttonTextWeight,
    color: themeBlue,
  },
});
