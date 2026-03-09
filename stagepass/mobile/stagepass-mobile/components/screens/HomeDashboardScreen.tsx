/**
 * Home dashboard – event operations. Welcome strip, event overview, tasks, crew, notifications.
 * Pull-to-refresh, theme colors, improved cards and hierarchy.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useAppRole } from '~/hooks/useAppRole';
import type { Event as EventType } from '~/services/api';

const PADDING_H = Spacing.xl;
const CARD_PADDING = Spacing.lg;
const SECTION_GAP = Spacing.lg;
const TAB_BAR_HEIGHT = 56;

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

type Props = {
  eventToday?: EventType | null;
  onRefresh?: () => Promise<void>;
};

export function HomeDashboardScreen({ eventToday, onRefresh }: Props) {
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const role = useAppRole();
  const userName = useSelector((s: { auth: { user: { name?: string } | null } }) => s.auth.user?.name) ?? '';
  const [refreshing, setRefreshing] = useState(false);
  const scrollBottomPadding = insets.bottom + TAB_BAR_HEIGHT + Spacing.lg;
  const heartbeatScale = useRef(new Animated.Value(1)).current;
  const heartbeatGlow = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    if (!eventToday) return;
    const scaleAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(heartbeatScale, { toValue: 1.03, duration: 800, useNativeDriver: true }),
        Animated.timing(heartbeatScale, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    const glowAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(heartbeatGlow, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        Animated.timing(heartbeatGlow, { toValue: 0.2, duration: 800, useNativeDriver: true }),
      ])
    );
    scaleAnim.start();
    glowAnim.start();
    return () => {
      scaleAnim.stop();
      glowAnim.stop();
    };
  }, [eventToday, heartbeatScale, heartbeatGlow]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh?.();
    setRefreshing(false);
  }, [onRefresh]);

  const eventDate = eventToday?.date
    ? new Date(eventToday.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const eventLocation = eventToday?.location_name ?? '';
  const eventTime = eventToday?.start_time ? formatTime(eventToday.start_time) : '';
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <ThemedView style={styles.container}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={themeBlue}
          />
        }
      >
        {/* Welcome strip */}
        <View style={[styles.welcomeStrip, { backgroundColor: themeBlue + '14', borderColor: colors.border }]}>
          <View style={styles.welcomeRow}>
            <View style={[styles.welcomeIconWrap, { backgroundColor: themeBlue }]}>
              <Ionicons name="sunny" size={24} color={themeYellow} />
            </View>
            <View style={styles.welcomeTextWrap}>
              <ThemedText style={[styles.welcomeGreeting, { color: colors.text }]}>
                {getGreeting()}{userName ? `, ${userName.split(/\s+/)[0]}` : ''}
              </ThemedText>
              <ThemedText style={[styles.welcomeDate, { color: colors.textSecondary }]}>
                {todayLabel}
              </ThemedText>
            </View>
          </View>
          <View style={[styles.welcomeAccent, { backgroundColor: themeYellow }]} />
        </View>

        {/* Event overview – prominent when there's an event; heartbeat glow when today or upcoming */}
        <View style={[styles.section, { paddingHorizontal: PADDING_H }]}>
          <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Event overview
          </ThemedText>
          <View style={styles.eventCardWrap}>
            {eventToday && (
              <Animated.View
                style={[styles.eventCardGlow, { backgroundColor: themeBlue, opacity: heartbeatGlow }]}
                pointerEvents="none"
              />
            )}
            <Animated.View style={eventToday ? { transform: [{ scale: heartbeatScale }] } : undefined}>
              <Pressable
                onPress={() => (eventToday ? router.push(`/events/${eventToday.id}`) : router.push('/(tabs)/events'))}
                style={({ pressed }) => [
                  styles.cardWithAccent,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <View style={[styles.cardAccent, { backgroundColor: themeBlue }]} />
                <View style={[styles.cardIconWrap, { backgroundColor: themeBlue + '18' }]}>
                  <Ionicons name="calendar" size={24} color={themeBlue} />
                </View>
                <View style={styles.cardBody}>
                  <ThemedText style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    {eventToday?.name ?? 'No event assigned'}
                  </ThemedText>
                  <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]} numberOfLines={2}>
                    {eventToday
                      ? [eventDate, eventLocation, eventTime].filter(Boolean).join(' · ')
                      : 'Open My Events to see your schedule'}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={22} color={themeYellow} />
              </Pressable>
            </Animated.View>
          </View>
        </View>

        {/* Quick actions */}
        <View style={[styles.section, { paddingHorizontal: PADDING_H }]}>
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
                <Ionicons name="calendar" size={26} color={themeBlue} />
              </View>
              <ThemedText style={[styles.quickLabel, { color: colors.text }]}>My Events</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/activity')}
              style={({ pressed }) => [
                styles.quickCard,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: themeYellow + '22' }]}>
                <Ionicons name="time" size={26} color={themeYellow} />
              </View>
              <ThemedText style={[styles.quickLabel, { color: colors.text }]}>Activities</ThemedText>
            </Pressable>
            {role === 'admin' && (
              <Pressable
                onPress={() => router.push('/admin')}
                style={({ pressed }) => [
                  styles.quickCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: themeBlue + '18' }]}>
                  <Ionicons name="settings" size={26} color={themeBlue} />
                </View>
                <ThemedText style={[styles.quickLabel, { color: colors.text }]}>Admin</ThemedText>
              </Pressable>
            )}
          </View>
        </View>

        {/* Assigned tasks */}
        <View style={[styles.section, { paddingHorizontal: PADDING_H }]}>
          <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Assigned tasks
          </ThemedText>
          <Pressable
            onPress={() => router.push('/(tabs)/events')}
            style={({ pressed }) => [
              styles.cardWithAccent,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <View style={[styles.cardAccent, { backgroundColor: themeYellow }]} />
            <View style={[styles.cardIconWrap, { backgroundColor: themeYellow + '22' }]}>
              <Ionicons name="checkbox" size={22} color={themeBlue} />
            </View>
            <View style={styles.cardBody}>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>My tasks</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
                {eventToday ? 'View and complete your tasks' : 'No tasks for today'}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={themeYellow} />
          </Pressable>
        </View>

        {/* Crew activity */}
        <View style={[styles.section, { paddingHorizontal: PADDING_H }]}>
          <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Crew activity
          </ThemedText>
          <Pressable
            onPress={() => (eventToday ? router.push(`/events/${eventToday.id}`) : router.push('/(tabs)/events'))}
            style={({ pressed }) => [
              styles.cardWithAccent,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <View style={[styles.cardAccent, { backgroundColor: themeBlue }]} />
            <View style={[styles.cardIconWrap, { backgroundColor: themeBlue + '18' }]}>
              <Ionicons name="people" size={22} color={themeBlue} />
            </View>
            <View style={styles.cardBody}>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Check-in & crew</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
                {eventToday ? 'View crew status and check-in' : 'Open an event to see crew'}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={themeYellow} />
          </Pressable>
        </View>

        {/* Notifications */}
        <View style={[styles.section, { paddingHorizontal: PADDING_H }]}>
          <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Notifications
          </ThemedText>
          <Pressable
            onPress={() => router.push('/(tabs)/activity')}
            style={({ pressed }) => [
              styles.cardWithAccent,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <View style={[styles.cardAccent, { backgroundColor: themeYellow }]} />
            <View style={[styles.cardIconWrap, { backgroundColor: themeYellow + '22' }]}>
              <Ionicons name="notifications" size={22} color={themeBlue} />
            </View>
            <View style={styles.cardBody}>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Recent activity</ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
                Alerts and updates
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={themeYellow} />
          </Pressable>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {},
  welcomeStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginHorizontal: PADDING_H,
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  welcomeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  welcomeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeTextWrap: { flex: 1, minWidth: 0 },
  welcomeGreeting: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  welcomeDate: { fontSize: 13 },
  welcomeAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  section: { marginBottom: SECTION_GAP },
  eventCardWrap: { position: 'relative' },
  eventCardGlow: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: BorderRadius.lg + 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  cardWithAccent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: CARD_PADDING,
    paddingLeft: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    minHeight: 76,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardAccent: {
    width: 4,
    marginRight: Spacing.sm,
    borderRadius: 2,
    alignSelf: 'stretch',
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardSub: { fontSize: 13 },
  quickRow: { flexDirection: 'row', gap: Spacing.md },
  quickCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 88,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  quickIconWrap: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  quickLabel: { fontSize: 14, fontWeight: '700' },
  bottomSpacer: { height: Spacing.xl },
});
