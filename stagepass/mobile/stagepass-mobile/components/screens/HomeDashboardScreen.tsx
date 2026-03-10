/**
 * Enterprise home dashboard: minimal header, welcome card, quick actions grid,
 * today's events, role-based visibility. Proportional spacing, soft shadows, clear hierarchy.
 * Enhanced UX: staggered entrance animations, smooth scroll, refined visuals.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import AnimatedReanimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import type { RoleName } from '~/services/api';
import { HomeHeader } from '@/components/HomeHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useGeofence } from '~/hooks/useGeofence';
import { api } from '~/services/api';
import type { Event as EventType } from '~/services/api';

/* Proportional scale: 8, 12, 16, 20, 24, 32 */
const U = { xs: 8, sm: 12, md: 16, lg: 20, xl: 24, section: 32 };
const CARD_RADIUS = 14;
const TAB_BAR_HEIGHT = 58;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: 'Admin',
    team_leader: 'Team Leader',
    accountant: 'Accountant',
    logistics: 'Logistics',
    operations: 'Operations',
    crew: 'Crew',
  };
  return map[role] ?? role;
}

type Props = {
  eventToday?: EventType | null;
  eventsTodayList?: EventType[];
  taskCount?: number;
  notificationCount?: number;
  onRefresh?: () => Promise<void>;
  role: RoleName;
  pastEvents?: EventType[];
};

type QuickAction = { id: string; label: string; icon: keyof typeof Ionicons.glyphMap; href: string; roles?: RoleName[] };

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'create', label: 'Create Event', icon: 'add-circle', href: '/admin/events/create', roles: ['admin'] },
  { id: 'events', label: 'My Events', icon: 'calendar', href: '/(tabs)/events' },
  { id: 'checkin', label: 'Crew Check-in', icon: 'location', href: '/(tabs)/events', roles: ['crew', 'team_leader'] },
  { id: 'activity', label: 'Activities', icon: 'notifications', href: '/(tabs)/activity' },
  { id: 'requestoff', label: 'Request off', icon: 'time-outline', href: '/admin/timeoff' },
  { id: 'managecheckin', label: 'Manage check-in', icon: 'location', href: '/admin/manage-checkin', roles: ['admin', 'team_leader'] },
  { id: 'checklist', label: 'Checklist', icon: 'checkbox', href: '/admin/checklists', roles: ['admin', 'team_leader'] },
  { id: 'equipment', label: 'Equipment', icon: 'cube', href: '/admin/equipment', roles: ['admin', 'logistics'] },
  { id: 'reports', label: 'Reports', icon: 'bar-chart', href: '/admin/reports', roles: ['admin'] },
];

function useCurrentTime(intervalMs: number = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function HomeDashboardScreen({
  eventToday,
  eventsTodayList = [],
  taskCount = 0,
  notificationCount = 0,
  onRefresh,
  role,
  pastEvents = [],
}: Props) {
  const router = useRouter();
  const { colors, isDark } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const iconColor = isDark ? themeYellow : themeBlue;
  const iconOutlineColor = isDark ? themeYellow : themeBlue;
  const user = useSelector((s: { auth: { user: { name?: string } | null } }) => s.auth.user);
  const userName = (user?.name ?? '').trim();
  const displayName = userName ? userName.split(/\s+/)[0] : '';
  const currentTime = useCurrentTime();
  const timeLabel = currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const scrollBottomPadding = insets.bottom + TAB_BAR_HEIGHT + U.sm;
  const { checkCanCheckIn } = useGeofence();

  const myAssignment = eventToday?.crew?.find((c: { pivot?: unknown }) => c.pivot);
  const hasCheckedIn = !!(myAssignment && typeof myAssignment === 'object' && 'pivot' in myAssignment && (myAssignment.pivot as { checkin_time?: string })?.checkin_time);

  useEffect(() => {
    if (!eventToday || hasCheckedIn) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {
        // ignore
      }
    })();
  }, [eventToday?.id, hasCheckedIn]);

  const handleCheckIn = useCallback(async () => {
    if (!eventToday || checkInLoading) return;
    const eventLat = eventToday.latitude ?? null;
    const eventLon = eventToday.longitude ?? null;
    const radius = eventToday.geofence_radius ?? 100;
    let location = userLocation;
    if (!location) {
      setCheckInLoading(true);
      try {
        const loc = await Location.getCurrentPositionAsync({});
        location = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(location);
      } catch {
        Alert.alert('Location needed', 'Enable location access to check in.');
        setCheckInLoading(false);
        return;
      }
      setCheckInLoading(false);
    }
    if (!location) return;
    const { allowed, message } = checkCanCheckIn(location, eventLat, eventLon, radius);
    if (!allowed) {
      Alert.alert('Check-in not allowed', message);
      return;
    }
    setCheckInLoading(true);
    try {
      await api.attendance.checkin(eventToday.id, location.latitude, location.longitude);
      await onRefresh?.();
    } catch (e: unknown) {
      Alert.alert('Check-in failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setCheckInLoading(false);
    }
  }, [eventToday, userLocation, checkInLoading, checkCanCheckIn, onRefresh]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh?.();
    setRefreshing(false);
  }, [onRefresh]);

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const eventsTodayCount = eventsTodayList.length;

  const visibleQuickActions = QUICK_ACTIONS.filter((a) => {
    if (!a.roles) return true;
    if (a.id === 'checkin' && eventToday && !hasCheckedIn) return a.roles.includes(role);
    return a.roles.includes(role);
  });

  return (
    <ThemedView style={styles.container}>
      <HomeHeader />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="normal"
        {...(Platform.OS === 'android' && { overScrollMode: 'always' as const })}
        bounces={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={themeYellow}
            colors={[themeYellow]}
          />
        }
      >
        {/* Welcome / Status card */}
        <AnimatedReanimated.View
          entering={FadeInDown.duration(420).delay(0)}
          style={[styles.welcomeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <ThemedText style={[styles.welcomeGreeting, { color: colors.text }]}>
            {getGreeting()}{displayName ? `, ${displayName}` : ''}
          </ThemedText>
          <ThemedText style={[styles.welcomeMeta, { color: colors.textSecondary }]}>
            {roleLabel(role)} · {todayLabel} · {timeLabel}
          </ThemedText>
          <View style={styles.statusRow}>
            <View style={[styles.statusChip, { backgroundColor: themeBlue + '14', borderWidth: 1, borderColor: iconOutlineColor }]}>
              <Ionicons name="calendar" size={12} color={iconColor} />
              <ThemedText style={[styles.statusChipText, { color: iconColor }]} numberOfLines={1}>
                {eventsTodayCount} event{eventsTodayCount !== 1 ? 's' : ''} today
              </ThemedText>
            </View>
            <View style={[styles.statusChip, { backgroundColor: themeYellow + '22', borderWidth: 1, borderColor: iconOutlineColor }]}>
              <Ionicons name="checkbox" size={12} color={iconColor} />
              <ThemedText style={[styles.statusChipText, { color: colors.text }]} numberOfLines={1}>
                {taskCount} task{taskCount !== 1 ? 's' : ''}
              </ThemedText>
            </View>
            <View style={[styles.statusChip, { backgroundColor: themeBlue + '14', borderWidth: 1, borderColor: iconOutlineColor }]}>
              <Ionicons name="notifications-outline" size={12} color={iconColor} />
              <ThemedText style={[styles.statusChipText, { color: iconColor }]} numberOfLines={1}>
                {notificationCount} notice{notificationCount !== 1 ? 's' : ''}
              </ThemedText>
            </View>
          </View>
        </AnimatedReanimated.View>

        {/* Check-in CTA (crew/leader, event today, not checked in) – clean primary button */}
        {eventToday && !hasCheckedIn && (
          <AnimatedReanimated.View entering={FadeInDown.duration(380).delay(60)} style={styles.checkInBannerWrap}>
            <Pressable
              onPress={handleCheckIn}
              disabled={checkInLoading}
              style={({ pressed }) => [
                styles.checkInBanner,
                {
                  backgroundColor: themeYellow,
                  opacity: checkInLoading ? 0.85 : pressed ? 0.92 : 1,
                },
              ]}
            >
              <View style={styles.checkInIconWrap}>
                <Ionicons name="location" size={22} color={themeBlue} />
              </View>
              <View style={styles.checkInTextWrap}>
                <ThemedText style={styles.checkInBannerTitle}>
                  {checkInLoading ? 'Checking in…' : userLocation ? 'Check in at venue' : 'Getting location…'}
                </ThemedText>
                {!checkInLoading && userLocation && (
                  <ThemedText style={styles.checkInBannerSub}>Tap when you arrive</ThemedText>
                )}
              </View>
            </Pressable>
          </AnimatedReanimated.View>
        )}

        {/* Quick Actions – 2-column grid */}
        <AnimatedReanimated.View entering={FadeInDown.duration(400).delay(120)} style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Quick actions
            </ThemedText>
          </View>
          <View style={styles.quickGrid}>
            {visibleQuickActions.map((action, index) => {
              const href = action.id === 'checkin' && eventToday ? `/events/${eventToday.id}` : action.href;
              return (
                <AnimatedReanimated.View
                  key={action.id}
                  entering={FadeIn.delay(120 + index * 40).duration(320)}
                  style={styles.quickCardWrap}
                >
                  <Pressable
                    onPress={() => href && router.push(href as any)}
                    style={({ pressed }) => [
                      styles.quickCard,
                      { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
                    ]}
                  >
                    <View style={[styles.quickIconWrap, { backgroundColor: themeBlue + '12', borderWidth: 1, borderColor: iconOutlineColor }]}>
                      <Ionicons name={action.icon as any} size={24} color={iconColor} />
                    </View>
                    <ThemedText style={[styles.quickLabel, { color: colors.text }]} numberOfLines={1}>
                      {action.label}
                    </ThemedText>
                  </Pressable>
                </AnimatedReanimated.View>
              );
            })}
          </View>
        </AnimatedReanimated.View>

        {/* Today's Events */}
        <AnimatedReanimated.View entering={FadeInDown.duration(400).delay(180)} style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
            <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Today&apos;s events
            </ThemedText>
          </View>
          {eventsTodayList.length === 0 ? (
            <AnimatedReanimated.View
              entering={FadeIn.delay(220).duration(360)}
              style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="calendar-outline" size={32} color={iconColor} />
              <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No events today</ThemedText>
              <ThemedText style={[styles.emptySub, { color: colors.textSecondary }]}>
                Open My Events to see your schedule
              </ThemedText>
              <Pressable onPress={() => router.push('/(tabs)/events')} style={styles.emptyLink}>
                <ThemedText style={[styles.emptyLinkText, { color: themeBlue }]}>My Events</ThemedText>
                <Ionicons name="chevron-forward" size={16} color={iconColor} />
              </Pressable>
            </AnimatedReanimated.View>
          ) : (
            eventsTodayList.map((event, index) => {
              const timeStr = event.start_time ? formatTime(event.start_time) : '';
              const venue = event.location_name ?? '';
              const status = (event.status || 'Scheduled').trim();
              return (
                <AnimatedReanimated.View
                  key={event.id}
                  entering={FadeIn.delay(220 + index * 55).duration(300)}
                >
                  <Pressable
                    onPress={() => router.push(`/events/${event.id}`)}
                    style={({ pressed }) => [
                      styles.eventCard,
                      { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
                    ]}
                  >
                    <View style={styles.eventCardMain}>
                      <ThemedText style={[styles.eventCardTitle, { color: colors.text }]} numberOfLines={1}>
                        {event.name}
                      </ThemedText>
                      <ThemedText style={[styles.eventCardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                        {[venue, timeStr].filter(Boolean).join(' · ') || '—'}
                      </ThemedText>
                    </View>
                    <View style={[styles.eventBadge, { backgroundColor: themeYellow + '28' }]}>
                      <ThemedText style={[styles.eventBadgeText, { color: themeBlue }]}>{status}</ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={iconColor} />
                  </Pressable>
                </AnimatedReanimated.View>
              );
            })
          )}
        </AnimatedReanimated.View>

        {/* Admin: Past events */}
        {role === 'admin' && pastEvents.length > 0 && (
          <AnimatedReanimated.View entering={FadeIn.duration(400).delay(220)} style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionTitleAccent, { backgroundColor: themeBlue }]} />
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Past events
              </ThemedText>
            </View>
            {pastEvents.slice(0, 6).map((event) => {
              const evDate = event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
              const evTime = event.start_time ? formatTime(event.start_time) : '';
              const loc = event.location_name ?? '';
              return (
                <Pressable
                  key={event.id}
                  onPress={() => router.push({ pathname: '/admin/events/[id]/operations', params: { id: String(event.id) } })}
                  style={({ pressed }) => [
                    styles.eventCard,
                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
                  ]}
                >
                  <View style={styles.eventCardMain}>
                    <ThemedText style={[styles.eventCardTitle, { color: colors.text }]} numberOfLines={1}>
                      {event.name}
                    </ThemedText>
                    <ThemedText style={[styles.eventCardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                      {[evDate, loc, evTime].filter(Boolean).join(' · ')}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={iconColor} />
                </Pressable>
              );
            })}
            {pastEvents.length > 6 && (
              <Pressable onPress={() => router.push('/admin/events')} style={styles.viewAll}>
                <ThemedText style={[styles.viewAllText, { color: themeBlue }]}>View all ({pastEvents.length})</ThemedText>
                <Ionicons name="chevron-forward" size={16} color={iconColor} />
              </Pressable>
            )}
          </AnimatedReanimated.View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: U.md,
    paddingTop: U.section,
  },
  welcomeCard: {
    padding: U.lg,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    marginBottom: U.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  welcomeGreeting: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  welcomeMeta: {
    fontSize: 13,
    marginBottom: U.sm,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: U.xs,
  },
  statusChip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: BorderRadius.lg,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  checkInBannerWrap: {
    marginBottom: U.lg,
  },
  checkInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: U.md,
    paddingHorizontal: U.lg,
    borderRadius: CARD_RADIUS,
    gap: U.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  checkInIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15,24,56,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkInTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  checkInBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: themeBlue,
  },
  checkInBannerSub: {
    fontSize: 13,
    fontWeight: '500',
    color: themeBlue,
    opacity: 0.85,
    marginTop: 2,
  },
  section: {
    marginBottom: U.section,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: U.md,
    gap: U.sm,
  },
  sectionTitleAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    flex: 1,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: U.sm,
  },
  quickCardWrap: {
    width: '48%',
    minWidth: '48%',
    maxWidth: '48%',
  },
  quickCard: {
    padding: U.lg,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 96,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  quickIconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: U.sm,
  },
  quickLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyCard: {
    padding: U.xl,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: U.sm,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    marginBottom: U.sm,
  },
  emptyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyLinkText: {
    fontSize: 14,
    fontWeight: '700',
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: U.md,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    marginBottom: U.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  eventCardMain: {
    flex: 1,
    minWidth: 0,
  },
  eventCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  eventCardMeta: {
    fontSize: 12,
  },
  eventBadge: {
    paddingHorizontal: U.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginRight: U.sm,
  },
  eventBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: U.md,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
  },
  bottomSpacer: { height: U.xl },
});
