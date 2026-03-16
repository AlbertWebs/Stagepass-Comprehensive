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
import { api, type Event } from '~/services/api';
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

const TAB_BAR_HEIGHT = 58;

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

export default function ActivityScreen() {
  const router = useRouter();
  const handleNav = useNavigationPress();
  const { colors, isDark } = useStagePassTheme();
  const role = useAppRole();
  const [eventToday, setEventToday] = useState<Event | null | undefined>(undefined);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollBottomPadding = TAB_BAR_HEIGHT;

  const load = useCallback(async () => {
    try {
      const [todayRes, listRes] = await Promise.all([
        api.events.myEventToday(),
        api.events.list(),
      ]);
      setEventToday(todayRes.event ?? null);
      const list = Array.isArray(listRes?.data) ? listRes.data : [];
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
    if (role === 'admin') {
      setLoading(false);
      return;
    }
    load();
  }, [role, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading && role !== 'admin') {
    return <StagepassLoader message="Loading activities…" fullScreen />;
  }

  const today = eventToday ?? null;
  const checkinStatus = today ? getCheckinStatus(today) : null;
  const upcoming = events.filter((e) => isUpcoming(e.date) && e.id !== today?.id);
  const past = events.filter((e) => !isUpcoming(e.date));
  const hasAnyEvents = today || upcoming.length > 0 || past.length > 0;

  const roleSubtitle =
    role === 'crew'
      ? 'Your check-ins and event schedule'
      : role === 'team_leader'
        ? 'Crew attendance and event activity'
        : 'Recent activity across events';

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="Activities" />
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

          {/* Today's event */}
          {today && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
                <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Today
                </ThemedText>
                <View style={[styles.statusDot, { backgroundColor: themeYellow }]} />
              </View>
              <Pressable
                onPress={() => handleNav(() => router.push({ pathname: '/events/[id]', params: { id: String(today.id) } }))}
                style={({ pressed }) => [
                  styles.todayCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? NAV_PRESSED_OPACITY : 1,
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
                          <Ionicons name="location" size={Icons.xs} color={colors.textSecondary} />
                          <ThemedText style={[styles.todayMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {today.location_name}
                          </ThemedText>
                        </View>
                      ) : null}
                      {today.start_time ? (
                        <View style={styles.todayMetaRow}>
                          <Ionicons name="time" size={Icons.xs} color={colors.textSecondary} />
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
                        <Ionicons name="checkmark-circle" size={Icons.xs} color={colors.success} />
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
                        <ThemedText style={[styles.badgeText, { color: colors.brandText }]}>
                          Tap to check in
                        </ThemedText>
                      </View>
                    )}
                    <ThemedText style={[styles.todayCta, { color: colors.brandText }]}>
                      View details →
                    </ThemedText>
                  </View>
                </View>
              </Pressable>
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
                onPress={() => today && handleNav(() => router.push({ pathname: '/events/[id]', params: { id: String(today.id) } }))}
                style={({ pressed }) => [
                  styles.quickCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? NAV_PRESSED_OPACITY : 1 },
                ]}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: themeYellow + '22' }]}>
                  <Ionicons name="location" size={Icons.header} color={themeYellow} />
                </View>
                <ThemedText style={[styles.quickLabel, { color: colors.text }]}>
                  {today ? 'Today’s event' : 'No event today'}
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Upcoming / Past events */}
          {(upcoming.length > 0 || past.length > 0) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
                <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Your events
                </ThemedText>
              </View>
              {upcoming.slice(0, 5).map((item) => (
                <EventCard
                  key={item.id}
                  event={item}
                  onPress={() => handleNav(() => router.push({ pathname: '/events/[id]', params: { id: String(item.id) } }))}
                />
              ))}
              {past.slice(0, 3).map((item) => (
                <EventCard
                  key={item.id}
                  event={item}
                  onPress={() => handleNav(() => router.push({ pathname: '/events/[id]', params: { id: String(item.id) } }))}
                />
              ))}
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
});
