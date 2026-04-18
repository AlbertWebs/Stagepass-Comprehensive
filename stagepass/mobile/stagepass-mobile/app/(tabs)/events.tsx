import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import { api, type Event, type RoleName } from '~/services/api';
import { useAppRole } from '~/hooks/useAppRole';
import { HomeHeader } from '@/components/HomeHeader';
import { EventCard, type EventDisplayStatus } from '@/components/EventCard';
import { StagepassLoader } from '@/components/StagepassLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Cards, Icons, Typography, UI } from '@/constants/ui';
import { Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useNavigationPress } from '@/src/utils/navigationPress';

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

/** Accept API date as string or rare wrapped/object shapes. */
function eventDateInputToString(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    const t = input.trim();
    return t.length ? t : null;
  }
  if (typeof input === 'object' && input !== null && 'date' in input) {
    const inner = (input as { date?: unknown }).date;
    if (typeof inner === 'string' && inner.trim()) return inner.trim();
  }
  return null;
}

function parseEventDateLocal(input: string | undefined | null | unknown): Date | null {
  const trimmed = eventDateInputToString(input);
  if (!trimmed) return null;
  const ymd = trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) {
    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/** Minutes from midnight for HH:mm or HH:mm:ss */
function timeStringToMinutes(t?: string | null): number | null {
  if (!t || typeof t !== 'string') return null;
  const part = t.trim().slice(0, 5);
  const m = /^(\d{1,2}):(\d{2})$/.exec(part);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

/** e.g. 10:30 → 03:30 next calendar day — end time is "earlier" than start on a 24h clock */
function isOvernightTimeRange(event: Event): boolean {
  const s = timeStringToMinutes(event.start_time);
  const e = timeStringToMinutes(event.expected_end_time);
  if (s == null || e == null) return false;
  return e < s;
}

/**
 * For overnight shifts, `end_date` is often the *next calendar day* while the shift is still one
 * "work day" starting on `date`. For the My Events calendar, show that event only on `date`, not on `end_date`.
 * True multi-day events (range > 1 day or non-overnight times) keep the full [date, end_date] range.
 */
function effectiveCalendarEndDate(event: Event, startDate: Date): Date {
  const endFromApi = parseEventDateLocal(event.end_date);
  const startKey = dateKey(startDate);
  if (!endFromApi) {
    return new Date(startDate.getTime());
  }
  const endKey = dateKey(endFromApi);
  if (startKey === endKey) {
    return new Date(startDate.getTime());
  }
  const dayAfterStart = new Date(startDate.getTime());
  dayAfterStart.setDate(dayAfterStart.getDate() + 1);
  if (dateKey(dayAfterStart) === endKey && isOvernightTimeRange(event)) {
    return new Date(startDate.getTime());
  }
  return endFromApi;
}

function eventMatchesDate(event: Event, date: Date): boolean {
  const startDate = parseEventDateLocal(event.date);
  if (!startDate) return false;
  const endDate = effectiveCalendarEndDate(event, startDate);
  startDate.setHours(0, 0, 0, 0);
  const end = new Date(endDate.getTime());
  end.setHours(0, 0, 0, 0);
  const selected = new Date(date);
  selected.setHours(0, 0, 0, 0);
  return selected.getTime() >= startDate.getTime() && selected.getTime() <= end.getTime();
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

/** Event-level ended states (align with event detail / backend `Event` model). */
function isEventEndedStatus(status: string | undefined): boolean {
  const s = String(status ?? '')
    .trim()
    .toLowerCase();
  return s === 'completed' || s === 'closed' || s === 'done_for_the_day';
}

/** Start-of-day for `event.date` (crew assignment day), local. */
function eventStartDay(event: Event): Date | null {
  const d = parseEventDateLocal(event.date);
  if (!d) return null;
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Upcoming = not ended and event start date is today or in the future (past starts → All Events only). */
function isUpcomingTabEvent(event: Event, todayStart: Date): boolean {
  if (isEventEndedStatus(event.status)) return false;
  const start = eventStartDay(event);
  if (!start) return false;
  return start.getTime() >= todayStart.getTime();
}

/** Same rules as event detail `canManageEventCrew` — team leader (or assigned leader id) may open operations. */
function canManageEventOperations(event: Event, userId: number | undefined, role: RoleName): boolean {
  if (userId == null) return false;
  if (role === 'admin') return true;
  const teamLeader = event.team_leader ?? event.teamLeader;
  const assignedLeaderId = event.team_leader_id ?? teamLeader?.id;
  if (assignedLeaderId != null && Number(assignedLeaderId) === userId) {
    return true;
  }
  if (role !== 'team_leader') return false;
  if (event.team_leader_id != null && event.team_leader_id !== undefined) {
    return false;
  }
  if (Number(event.created_by_id) === userId) return true;
  return Boolean(event.crew?.some((c) => c.id === userId));
}

/** My Events: show Created | Checked in | Checked out | Completed from event status + current user's crew pivot */
function getEventDisplayStatus(event: Event, userId: number | undefined): EventDisplayStatus {
  if (isEventEndedStatus(event.status)) return 'completed';
  if (userId == null || !event.crew?.length) return 'created';
  const me = event.crew.find((c) => Number(c.id) === Number(userId));
  if (!me?.pivot) return 'created';
  if (me.pivot.checkout_time) return 'checked_out';
  if (me.pivot.checkin_time) return 'checked_in';
  return 'created';
}

/** Laravel paginator returns `{ data: Event[] }`; tolerate a bare array if a proxy changes the shape. */
function extractEventsFromListResponse(body: unknown): Event[] {
  if (!body || typeof body !== 'object') return [];
  if (Array.isArray(body)) return body as Event[];
  const o = body as Record<string, unknown>;
  if (Array.isArray(o.data)) return o.data as Event[];
  return [];
}

export default function EventsTab() {
  const router = useRouter();
  const handleNav = useNavigationPress();
  const { colors, isDark } = useStagePassTheme();
  const userId = useSelector((s: { auth: { user: { id: number } | null } }) => s.auth.user?.id);
  const role = useAppRole();
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
  const [animateKey, setAnimateKey] = useState(0);
  const scrollBottomPadding = TAB_BAR_HEIGHT;

  const loadEvents = useCallback(async () => {
    try {
      const today = dateKey(new Date());
      const [listRes, todayRes] = await Promise.allSettled([
        api.events.list({ per_page: 100, refresh: true }),
        api.events.myEventToday(today),
      ]);

      const list = listRes.status === 'fulfilled' ? extractEventsFromListResponse(listRes.value) : [];
      const assignedToday: Event[] =
        todayRes.status === 'fulfilled' && todayRes.value?.event ? [todayRes.value.event] : [];

      const merged = [...list, ...assignedToday];
      const dedupedById = new Map<number, Event>();
      for (const event of merged) {
        const id = event?.id;
        if (id != null && Number.isFinite(Number(id))) {
          dedupedById.set(Number(id), event);
        }
      }

      setEvents(Array.from(dedupedById.values()).sort(sortByTime));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setAnimateKey((k) => k + 1);
      loadEvents();
    }, [loadEvents])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEvents();
  }, [loadEvents]);

  const eventsForSelectedDateOnly = useMemo(
    () => events.filter((e) => eventMatchesDate(e, selectedDate)),
    [events, selectedDate]
  );

  const eventsOnSelectedDate = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let list = eventsForSelectedDateOnly;
    if (eventFilter === 'upcoming') {
      list = list.filter((e) => isUpcomingTabEvent(e, todayStart));
    } else if (eventFilter === 'completed') {
      list = list.filter((e) => isEventEndedStatus(e.status));
    }
    return list;
  }, [eventsForSelectedDateOnly, eventFilter]);

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
  /** Hide "Today's Events" row when today is selected but nothing is scheduled this calendar day. */
  const showTodaySectionHeader = !isTodaySelected || eventsForSelectedDateOnly.length > 0;
  const selectedChipTextColor = isDark ? '#111827' : themeBlue;

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
                      <ThemedText style={[styles.weekDayLabel, { color: isSelected ? selectedChipTextColor : colors.textSecondary }]}>
                        {DAY_LABELS[d.getDay()]}
                      </ThemedText>
                      <ThemedText style={[styles.weekDayNum, { color: isSelected ? selectedChipTextColor : colors.text }]}>
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
                      <ThemedText style={[styles.monthCellText, { color: isSelected ? selectedChipTextColor : colors.text }]}>
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

        {showTodaySectionHeader ? (
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
            <Ionicons name="calendar" size={Icons.header} color={themeYellow} style={styles.sectionIcon} />
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              {sectionTitle}
            </ThemedText>
          </View>
        ) : null}

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
                  <ActivityIndicator size="small" color={selectedChipTextColor} />
                  <ThemedText style={styles.emptyButtonText}>Refreshing…</ThemedText>
                </View>
              ) : (
                <ThemedText style={styles.emptyButtonText}>Refresh events</ThemedText>
              )}
            </Pressable>
          </View>
        ) : eventsForSelectedDateOnly.length === 0 ? (
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
        ) : eventsOnSelectedDate.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconWrapSmall, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="funnel-outline" size={Icons.xl} color={colors.textSecondary} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              {eventFilter === 'upcoming'
                ? 'No upcoming events on this day'
                : 'No completed events on this day'}
            </ThemedText>
            <ThemedText style={[styles.emptySub, { color: colors.textSecondary }]}>
              {eventFilter === 'upcoming'
                ? 'Upcoming only lists events whose start date is today or later and that are not ended yet. Past start dates and finished shifts are under All Events or Completed.'
                : 'Nothing finished or closed on this day yet. Try All Events or Upcoming.'}
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
                onPress={() => handleNav(() => router.push({ pathname: '/(tabs)/events/[id]', params: { id: String(item.id) } }))}
                extraActions={
                  canManageEventOperations(item, userId, role)
                    ? [
                        {
                          label: 'Operations',
                          icon: 'briefcase-outline',
                          onPress: () =>
                            handleNav(() =>
                              router.push({
                                pathname: '/(tabs)/admin/events/[id]/operations',
                                params: { id: String(item.id) },
                              })
                            ),
                        },
                      ]
                    : undefined
                }
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
    color: '#111827',
  },
});
