/**
 * Activities – robust, intuitive activity hub with today’s event, event list, and quick actions.
 * Uses theme colors (themeBlue, themeYellow) and semantic colors (success, error).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { api, type Communication, type Event, type Paginated } from '~/services/api';
import { HomeHeader } from '@/components/HomeHeader';
import { EventCard } from '@/components/EventCard';
import { StagepassLoader } from '@/components/StagepassLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Cards, Icons, Typography } from '@/constants/ui';
import { Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';
import { useAppRole } from '~/hooks/useAppRole';
import { canCheckInEligibility, getMobileActivityBadge } from '@/src/utils/eventEligibility';

const TAB_BAR_HEIGHT = 58;

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** YYYY-MM-DD from API event.date */
function eventDateOnly(event: Event): string {
  if (!event.date || typeof event.date !== 'string') return '';
  const s = event.date.trim();
  return s.length >= 10 ? s.substring(0, 10) : s;
}

function endDateYmd(event: Event): string {
  const start = eventDateOnly(event);
  if (!start) return '';
  if (event.end_date && typeof event.end_date === 'string') {
    const s = event.end_date.trim();
    return s.length >= 10 ? s.substring(0, 10) : start;
  }
  return start;
}

/** Same rule as API `spansDate` — the event’s scheduled day range includes this local Y-m-d. */
function eventSpansLocalCalendarDay(event: Event, ymd: string): boolean {
  const start = eventDateOnly(event);
  if (!start) return false;
  const end = endDateYmd(event);
  return start <= ymd && end >= ymd;
}

function sortByStartTimeThenName(a: Event, b: Event): number {
  const ta = (a.start_time || '').slice(0, 5);
  const tb = (b.start_time || '').slice(0, 5);
  const c = ta.localeCompare(tb);
  if (c !== 0) return c;
  return (a.name || '').localeCompare(b.name || '');
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return '';
  try {
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m || '00'} ${ampm}`;
  } catch {
    return timeStr;
  }
}

export default function ActivityScreen() {
  const router = useRouter();
  const handleNav = useNavigationPress();
  const { colors, isDark } = useStagePassTheme();
  const role = useAppRole();
  const authUser = useSelector((s: { auth: { user: { id?: number } | null } }) => s.auth.user);
  const viewerId = authUser?.id;
  const [animateKey, setAnimateKey] = useState(0);
  const [todayEvents, setTodayEvents] = useState<Event[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPaged, setActivityPaged] = useState<Paginated<Event> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [nowTick, setNowTick] = useState(0);
  const scrollBottomPadding = TAB_BAR_HEIGHT;
  const eligibilityNow = useMemo(() => new Date(), [nowTick]);

  useFocusEffect(
    useCallback(() => {
      setAnimateKey((k) => k + 1);
    }, [])
  );

  useEffect(() => {
    const t = setInterval(() => setNowTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const fetchActivityData = useCallback(async (page: number) => {
    if (role === 'admin') {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const localToday = todayDateString();
      const [todayRes, pageRes, myToday] = await Promise.all([
        api.events.list({
          on_date: localToday,
          per_page: 50,
          activities_view: true,
          refresh: true,
        }),
        api.events.list({
          exclude_spanning_date: localToday,
          page,
          per_page: 5,
          activities_view: true,
          refresh: true,
        }),
        api.events.myEventToday(localToday),
      ]);

      const fromApi = Array.isArray(todayRes?.data) ? todayRes.data : [];
      const merged: Event[] = [];
      const seen = new Set<number>();
      for (const e of fromApi) {
        if (myToday?.event?.id === e.id) {
          merged.push(myToday.event);
        } else {
          merged.push(e);
        }
        seen.add(e.id);
      }
      if (myToday?.event && !seen.has(myToday.event.id)) {
        merged.push(myToday.event);
      }
      const byId = new Map<number, Event>();
      for (const e of merged) {
        if (!byId.has(e.id)) byId.set(e.id, e);
      }
      const forToday = [...byId.values()].filter((e) => eventSpansLocalCalendarDay(e, localToday));
      forToday.sort(sortByStartTimeThenName);
      setTodayEvents(forToday);
      setActivityPaged(pageRes);
    } catch {
      setTodayEvents([]);
      setActivityPaged(null);
    }
    try {
      const commRes = await api.communications.list();
      const commList = Array.isArray(commRes?.data) ? commRes.data : [];
      setCommunications(commList.slice(0, 8));
    } catch {
      setCommunications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role]);

  useEffect(() => {
    if (role === 'admin') {
      setLoading(false);
      return;
    }
    void fetchActivityData(activityPage);
  }, [role, activityPage, fetchActivityData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (activityPage <= 1) {
      void fetchActivityData(1);
    } else {
      setActivityPage(1);
    }
  }, [activityPage, fetchActivityData]);

  const pagedRows = activityPaged?.data ?? [];
  const lastPage = activityPaged?.last_page ?? 1;
  const currentPage = activityPaged?.current_page ?? activityPage;
  const totalAssignedPages = activityPaged?.total ?? 0;

  const hasAnyEvents = todayEvents.length > 0 || pagedRows.length > 0 || totalAssignedPages > 0;

  if (loading && role !== 'admin') {
    return <StagepassLoader message="Loading activities…" fullScreen />;
  }

  const roleSubtitle =
    role === 'crew'
      ? 'Your check-ins and event schedule'
      : role === 'team_leader'
        ? 'Crew attendance and event activity'
        : 'Recent activity across events';

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="Activities" />
      <Animated.View key={animateKey} entering={SlideInRight.duration(320)} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? themeYellow : themeBlue} />
        }
      >
        <View style={styles.content}>
          {/* Hero */}
          <View style={[styles.hero, { backgroundColor: themeBlue + '14', borderColor: colors.border }]}>
            <View style={[styles.heroIconWrap, { backgroundColor: themeBlue }]}>
              <Ionicons name="time" size={Icons.xl} color="#fff" />
            </View>
            <View style={styles.heroTextWrap}>
              <ThemedText style={[styles.heroTitle, { color: colors.text }]}>
                Activities
              </ThemedText>
              <ThemedText style={[styles.heroSub, { color: colors.textSecondary }]}>
                {roleSubtitle}
              </ThemedText>
            </View>
          </View>

          {/* Today: only events whose calendar date is today (local) */}
          {todayEvents.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
                <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Today
                </ThemedText>
                <View style={[styles.statusDot, { backgroundColor: themeYellow }]} />
              </View>
              {todayEvents.map((ev) => {
                const activityBadge =
                  viewerId != null ? getMobileActivityBadge(ev, viewerId, eligibilityNow) : null;
                const canIn = viewerId != null && canCheckInEligibility(ev, viewerId, eligibilityNow);
                const showTapCheckIn =
                  activityBadge?.key !== 'checked_in' &&
                  activityBadge?.key !== 'checked_out' &&
                  activityBadge?.key !== 'event_passed' &&
                  canIn;
                return (
                  <Pressable
                    key={ev.id}
                    onPress={() => handleNav(() => router.push({ pathname: '/(tabs)/events/[id]', params: { id: String(ev.id) } }))}
                    style={({ pressed }) => [
                      styles.todayCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        opacity: pressed ? NAV_PRESSED_OPACITY : 1,
                        marginBottom: Spacing.sm,
                      },
                    ]}
                  >
                    <View style={[styles.todayAccent, { backgroundColor: themeBlue }]} />
                    <View style={styles.todayBody}>
                      <ThemedText style={[styles.todayName, { color: colors.text }]} numberOfLines={2}>
                        {ev.name}
                      </ThemedText>
                      {(ev.location_name || ev.start_time) && (
                        <View style={styles.todayMeta}>
                          {ev.location_name ? (
                            <View style={styles.todayMetaRow}>
                              <Ionicons name="location" size={Icons.xs} color={colors.textSecondary} />
                              <ThemedText style={[styles.todayMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
                                {ev.location_name}
                              </ThemedText>
                            </View>
                          ) : null}
                          {ev.start_time ? (
                            <View style={styles.todayMetaRow}>
                              <Ionicons name="time" size={Icons.xs} color={colors.textSecondary} />
                              <ThemedText style={[styles.todayMetaText, { color: colors.textSecondary }]}>
                                {formatTime(ev.start_time)}
                              </ThemedText>
                            </View>
                          ) : null}
                        </View>
                      )}
                      <View style={styles.todayFooter}>
                        {activityBadge ? (
                          <View
                            style={[
                              styles.badge,
                              {
                                backgroundColor:
                                  activityBadge.key === 'event_passed' || activityBadge.key === 'closed' || activityBadge.key === 'completed'
                                    ? colors.textSecondary + '22'
                                    : activityBadge.key === 'checked_in'
                                      ? colors.success + '22'
                                      : themeYellow + '22',
                              },
                            ]}
                          >
                            {activityBadge.key === 'checked_in' ? (
                              <Ionicons name="checkmark-circle" size={Icons.xs} color={colors.success} />
                            ) : null}
                            <ThemedText
                              style={[
                                styles.badgeText,
                                {
                                  color:
                                    activityBadge.key === 'event_passed' || activityBadge.key === 'closed' || activityBadge.key === 'completed'
                                      ? colors.textSecondary
                                      : activityBadge.key === 'checked_in'
                                        ? colors.success
                                        : colors.brandText,
                                },
                              ]}
                            >
                              {activityBadge.label}
                            </ThemedText>
                          </View>
                        ) : null}
                        {showTapCheckIn ? (
                          <View style={[styles.badge, { backgroundColor: themeYellow + '22' }]}>
                            <ThemedText style={[styles.badgeText, { color: colors.brandText }]}>Tap to check in</ThemedText>
                          </View>
                        ) : null}
                        <ThemedText style={[styles.todayCta, { color: colors.brandText }]}>
                          View details →
                        </ThemedText>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Quick actions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Quick actions
              </ThemedText>
            </View>
            <View style={styles.quickRow}>
              <Pressable
                onPress={() => handleNav(() => router.push('/(tabs)/events'))}
                style={({ pressed }) => [
                  styles.quickCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? NAV_PRESSED_OPACITY : 1 },
                ]}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '18' }]}>
                  <Ionicons name="calendar" size={Icons.header} color={colors.brandIcon} />
                </View>
                <ThemedText style={[styles.quickLabel, { color: colors.text }]}>My Events</ThemedText>
              </Pressable>
              <Pressable
                onPress={() =>
                  todayEvents[0] &&
                  handleNav(() =>
                    router.push({ pathname: '/(tabs)/events/[id]', params: { id: String(todayEvents[0].id) } })
                  )
                }
                style={({ pressed }) => [
                  styles.quickCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? NAV_PRESSED_OPACITY : 1 },
                ]}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: themeYellow + '22' }]}>
                  <Ionicons name="location" size={Icons.header} color={themeYellow} />
                </View>
                <ThemedText style={[styles.quickLabel, { color: colors.text }]}>
                  {todayEvents.length > 1
                    ? 'Today’s events'
                    : todayEvents.length === 1
                      ? 'Today’s event'
                      : 'No event today'}
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Assigned events (server-paginated; excludes today’s calendar rows) */}
          {role !== 'admin' && (pagedRows.length > 0 || (activityPaged?.total ?? 0) > 0) ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
                <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Your events
                </ThemedText>
              </View>
              {pagedRows.map((item) => (
                <EventCard
                  key={item.id}
                  event={item}
                  viewerUserId={viewerId}
                  eligibilityNow={eligibilityNow}
                  onPress={() => handleNav(() => router.push({ pathname: '/(tabs)/events/[id]', params: { id: String(item.id) } }))}
                />
              ))}
              {lastPage > 1 ? (
                <View style={[styles.pagerRow, { borderColor: colors.border }]}>
                  <Pressable
                    onPress={() => setActivityPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    style={({ pressed }) => [
                      styles.pagerBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                        opacity: currentPage <= 1 ? 0.45 : pressed ? NAV_PRESSED_OPACITY : 1,
                      },
                    ]}
                  >
                    <ThemedText style={[styles.pagerBtnText, { color: colors.text }]}>Previous</ThemedText>
                  </Pressable>
                  <ThemedText style={[styles.pagerInfo, { color: colors.textSecondary }]}>
                    Page {currentPage} of {lastPage}
                  </ThemedText>
                  <Pressable
                    onPress={() => setActivityPage((p) => Math.min(lastPage, p + 1))}
                    disabled={currentPage >= lastPage}
                    style={({ pressed }) => [
                      styles.pagerBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                        opacity: currentPage >= lastPage ? 0.45 : pressed ? NAV_PRESSED_OPACITY : 1,
                      },
                    ]}
                  >
                    <ThemedText style={[styles.pagerBtnText, { color: colors.text }]}>Next</ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Crew messages */}
          {(role === 'crew' || role === 'team_leader') && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
                <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Crew messages
                </ThemedText>
              </View>
              {communications.length === 0 ? (
                <View style={[styles.messageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ThemedText style={[styles.messageBody, { color: colors.textSecondary }]}>
                    No crew messages yet.
                  </ThemedText>
                </View>
              ) : (
                communications.map((msg) => (
                  <View key={msg.id} style={[styles.messageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <ThemedText style={[styles.messageSubject, { color: colors.text }]} numberOfLines={1}>
                      {msg.subject || 'Message'}
                    </ThemedText>
                    <ThemedText style={[styles.messageBody, { color: colors.textSecondary }]} numberOfLines={3}>
                      {msg.body || ''}
                    </ThemedText>
                    {!!msg.created_at && (
                      <ThemedText style={[styles.messageTime, { color: colors.textSecondary }]}>
                        {new Date(msg.created_at).toLocaleString()}
                      </ThemedText>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          {/* Empty state */}
          {!hasAnyEvents && (
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="time-outline" size={Icons.large} color={colors.textSecondary} />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
                No activity yet
              </ThemedText>
              <ThemedText style={[styles.emptySub, { color: colors.textSecondary }]}>
                Your events and check-ins will appear here. Open My Events to see your schedule.
              </ThemedText>
              <Pressable
                onPress={() => handleNav(() => router.push('/(tabs)/events'))}
                style={({ pressed }) => [
                  styles.emptyButton,
                  { backgroundColor: themeBlue, opacity: pressed ? NAV_PRESSED_OPACITY : 1 },
                ]}
              >
                <ThemedText style={styles.emptyButtonText}>Go to My Events</ThemedText>
              </Pressable>
            </View>
          )}
        </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
  },
  heroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Cards.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTextWrap: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: Typography.titleLarge, fontWeight: Typography.titleLargeWeight, marginBottom: 2 },
  heroSub: { fontSize: Typography.bodySmall },
  section: { marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitleAccent: {
    width: 3,
    height: 16,
    borderRadius: 0,
  },
  sectionTitle: {
    fontSize: Typography.label,
    fontWeight: Typography.labelWeight,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  todayCard: {
    flexDirection: 'row',
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  todayAccent: { width: 4 },
  todayBody: { flex: 1, padding: Spacing.lg, paddingLeft: Spacing.md },
  todayName: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.xs },
  todayMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.sm },
  todayMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  todayMetaText: { fontSize: 12 },
  todayFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  badgeText: { fontSize: Typography.titleSection, fontWeight: Typography.labelWeight },
  todayCta: { fontSize: Typography.bodySmall, fontWeight: '600' },
  quickRow: { flexDirection: 'row', gap: Spacing.md },
  quickCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Cards.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  quickLabel: { fontSize: Typography.label, fontWeight: '600', textAlign: 'center' },
  messageCard: {
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  messageSubject: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.buttonTextWeight,
    marginBottom: 4,
  },
  messageBody: {
    fontSize: Typography.bodySmall,
    lineHeight: 18,
  },
  messageTime: {
    marginTop: 6,
    fontSize: Typography.titleSection,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyIconWrap: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  emptyTitle: { fontSize: Typography.body, fontWeight: Typography.buttonTextWeight, marginBottom: Spacing.sm },
  emptySub: { fontSize: Typography.bodySmall, textAlign: 'center', marginBottom: Spacing.lg, maxWidth: 260 },
  emptyButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Cards.borderRadius,
  },
  emptyButtonText: { fontSize: Typography.bodySmall, fontWeight: Typography.buttonTextWeight, color: '#fff' },
  bottomSpacer: { height: Spacing.lg },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
  },
  pagerBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
  },
  pagerBtnText: { fontSize: Typography.bodySmall, fontWeight: '600' },
  pagerInfo: { fontSize: Typography.titleSection, fontWeight: '600' },
});
