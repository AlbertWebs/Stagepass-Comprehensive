/**
 * Activities – robust, intuitive activity hub with today’s event, event list, and quick actions.
 * Uses theme colors (themeBlue, themeYellow) and semantic colors (success, error).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Event } from '~/services/api';
import { AppHeader } from '@/components/AppHeader';
import { EventCard } from '@/components/EventCard';
import { StagepassLoader } from '@/components/StagepassLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

function isUpcoming(dateStr: string): boolean {
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

/** True when event date is the user's local today */
function isEventToday(dateStr: string): boolean {
  try {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  } catch {
    return false;
  }
}

/** Resolve today's event: API result, or from list when date is local today (fallback if API misses it) */
function resolveTodayEvent(apiToday: Event | null, list: Event[]): Event | null {
  if (apiToday) return apiToday;
  const todayFromList = list.find((e) => isEventToday(e.date));
  return todayFromList ?? null;
}

function sortByDate(a: Event, b: Event): number {
  try {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  } catch {
    return 0;
  }
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

function getCheckinStatus(event: Event): 'checked_in' | 'checked_out' | 'pending' | null {
  const crew = event.crew ?? [];
  const me = crew.find((c) => c.pivot);
  if (!me?.pivot) return null;
  if (me.pivot.checkout_time) return 'checked_out';
  if (me.pivot.checkin_time) return 'checked_in';
  return 'pending';
}

const TAB_BAR_HEIGHT = 56;

export default function ActivityScreen() {
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const [eventToday, setEventToday] = useState<Event | null | undefined>(undefined);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollBottomPadding = insets.bottom + TAB_BAR_HEIGHT + Spacing.lg;

  const load = useCallback(async () => {
    try {
      const [todayRes, listRes] = await Promise.all([
        api.events.myEventToday(),
        api.events.list().catch(() => ({ data: [] as Event[] })),
      ]);
      const list = Array.isArray(listRes?.data) ? listRes.data : [];
      const todayEvent = resolveTodayEvent(todayRes.event ?? null, list);
      setEventToday(todayEvent);
      setEvents(list.sort(sortByDate));
    } catch {
      setEventToday(null);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading) {
    return <StagepassLoader message="Loading activities…" fullScreen />;
  }

  const today = eventToday ?? null;
  const checkinStatus = today ? getCheckinStatus(today) : null;
  const upcoming = events.filter((e) => isUpcoming(e.date) && e.id !== today?.id);
  const past = events.filter((e) => !isUpcoming(e.date));
  const hasAnyEvents = today || upcoming.length > 0 || past.length > 0;

  const roleSubtitle = 'Your check-ins and event schedule';

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeBlue} />
        }
      >
        <View style={styles.content}>
          {/* Hero */}
          <View style={[styles.hero, { backgroundColor: themeBlue + '14', borderColor: colors.border }]}>
            <View style={[styles.heroIconWrap, { backgroundColor: themeBlue }]}>
              <Ionicons name="time" size={28} color="#fff" />
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

          {/* Today's event */}
          {today && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Today
                </ThemedText>
                <View style={[styles.statusDot, { backgroundColor: themeYellow }]} />
              </View>
              <Pressable
                onPress={() => router.push({ pathname: '/events/[id]', params: { id: String(today.id) } })}
                style={({ pressed }) => [
                  styles.todayCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <View style={[styles.todayAccent, { backgroundColor: themeBlue }]} />
                <View style={styles.todayBody}>
                  <ThemedText style={[styles.todayName, { color: colors.text }]} numberOfLines={2}>
                    {today.name}
                  </ThemedText>
                  {(today.location_name || today.start_time) && (
                    <View style={styles.todayMeta}>
                      {today.location_name ? (
                        <View style={styles.todayMetaRow}>
                          <Ionicons name="location" size={14} color={colors.textSecondary} />
                          <ThemedText style={[styles.todayMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {today.location_name}
                          </ThemedText>
                        </View>
                      ) : null}
                      {today.start_time ? (
                        <View style={styles.todayMetaRow}>
                          <Ionicons name="time" size={14} color={colors.textSecondary} />
                          <ThemedText style={[styles.todayMetaText, { color: colors.textSecondary }]}>
                            {formatTime(today.start_time)}
                          </ThemedText>
                        </View>
                      ) : null}
                    </View>
                  )}
                  <View style={styles.todayFooter}>
                    {checkinStatus === 'checked_in' && (
                      <View style={[styles.badge, { backgroundColor: colors.success + '22' }]}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <ThemedText style={[styles.badgeText, { color: colors.success }]}>
                          Checked in
                        </ThemedText>
                      </View>
                    )}
                    {checkinStatus === 'checked_out' && (
                      <View style={[styles.badge, { backgroundColor: colors.textSecondary + '22' }]}>
                        <ThemedText style={[styles.badgeText, { color: colors.textSecondary }]}>
                          Checked out
                        </ThemedText>
                      </View>
                    )}
                    {checkinStatus === 'pending' && (
                      <View style={[styles.badge, { backgroundColor: themeYellow + '22' }]}>
                        <ThemedText style={[styles.badgeText, { color: themeBlue }]}>
                          Tap to check in
                        </ThemedText>
                      </View>
                    )}
                    <ThemedText style={[styles.todayCta, { color: themeBlue }]}>
                      View details →
                    </ThemedText>
                  </View>
                </View>
              </Pressable>
            </View>
          )}

          {/* Quick actions */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Quick actions
            </ThemedText>
            <View style={styles.quickRow}>
              <Pressable
                onPress={() => router.push('/(tabs)/events')}
                style={({ pressed }) => [
                  styles.quickCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: themeBlue + '18' }]}>
                  <Ionicons name="calendar" size={22} color={themeBlue} />
                </View>
                <ThemedText style={[styles.quickLabel, { color: colors.text }]}>My Events</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => today && router.push({ pathname: '/events/[id]', params: { id: String(today.id) } })}
                style={({ pressed }) => [
                  styles.quickCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: themeYellow + '22' }]}>
                  <Ionicons name="location" size={22} color={themeYellow} />
                </View>
                <ThemedText style={[styles.quickLabel, { color: colors.text }]}>
                  {today ? 'Today’s event' : 'No event today'}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => router.push('/request-time-off')}
                style={({ pressed }) => [
                  styles.quickCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: themeBlue + '18' }]}>
                  <Ionicons name="calendar-outline" size={22} color={themeBlue} />
                </View>
                <ThemedText style={[styles.quickLabel, { color: colors.text }]}>Time off</ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Upcoming / Past events */}
          {(upcoming.length > 0 || past.length > 0) && (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Your events
              </ThemedText>
              {upcoming.slice(0, 5).map((item) => (
                <EventCard
                  key={item.id}
                  event={item}
                  onPress={() => router.push({ pathname: '/events/[id]', params: { id: String(item.id) } })}
                />
              ))}
              {past.slice(0, 3).map((item) => (
                <EventCard
                  key={item.id}
                  event={item}
                  onPress={() => router.push({ pathname: '/events/[id]', params: { id: String(item.id) } })}
                />
              ))}
            </View>
          )}

          {/* Empty state */}
          {!hasAnyEvents && (
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="time-outline" size={44} color={colors.textSecondary} />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
                No activity yet
              </ThemedText>
              <ThemedText style={[styles.emptySub, { color: colors.textSecondary }]}>
                Your events and check-ins will appear here. Open My Events to see your schedule.
              </ThemedText>
              <Pressable
                onPress={() => router.push('/(tabs)/events')}
                style={({ pressed }) => [
                  styles.emptyButton,
                  { backgroundColor: themeBlue, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <ThemedText style={styles.emptyButtonText}>Go to My Events</ThemedText>
              </Pressable>
            </View>
          )}
        </View>
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTextWrap: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  heroSub: { fontSize: 14 },
  section: { marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  todayCard: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  todayAccent: { width: 4 },
  todayBody: { flex: 1, padding: Spacing.lg, paddingLeft: Spacing.md },
  todayName: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.xs },
  todayMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.sm },
  todayMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  todayMetaText: { fontSize: 13 },
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
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  todayCta: { fontSize: 14, fontWeight: '600' },
  quickRow: { flexDirection: 'row', gap: Spacing.md },
  quickCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  quickLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.sm },
  emptySub: { fontSize: 15, textAlign: 'center', marginBottom: Spacing.lg, maxWidth: 280 },
  emptyButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  emptyButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  bottomSpacer: { height: Spacing.xl },
});
