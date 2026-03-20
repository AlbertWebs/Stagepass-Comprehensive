/**
 * Recent Activity – full-page timeline of office and event check-ins.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import { HomeHeader } from '@/components/HomeHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { themeBlue, themeYellow, VibrantColors } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { getActivityAccentColor, useRecentCheckinActivities } from '~/hooks/useRecentCheckinActivities';
import { useAppRole } from '~/hooks/useAppRole';
import { api, type Event as EventType } from '~/services/api';
import { setUser } from '~/store/authSlice';

const U = { sm: 8, md: 12, lg: 16, xl: 20, section: 24 };
const CARD_RADIUS = 16;
const TAB_BAR_HEIGHT = 58;

export default function RecentActivityScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const role = useAppRole();
  const { colors, isDark } = useStagePassTheme();
  const user = useSelector((s: { auth: { user: unknown } }) => s.auth.user) as { office_checkin_time?: string; office_checkout_time?: string } | null;
  const [animateKey, setAnimateKey] = useState(0);
  const [eventToday, setEventToday] = useState<EventType | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { setAnimateKey((k) => k + 1); }, []));

  const recentCheckinActivities = useRecentCheckinActivities(user, eventToday, null);

  const load = useCallback(async () => {
    try {
      const [me, todayRes] = await Promise.all([
        api.auth.me(),
        role === 'crew' || role === 'team_leader' ? api.events.myEventToday(new Date().toISOString().slice(0, 10)) : Promise.resolve({ event: null }),
      ]);
      dispatch(setUser(me));
      setEventToday(todayRes?.event ?? null);
    } catch {
      setEventToday(null);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, role]);

  useEffect(() => {
    load();
  }, [load]);

  if (role !== 'crew' && role !== 'team_leader') {
    return (
      <ThemedView style={styles.container}>
        <HomeHeader title="Recent activity" showBack onBack={() => router.back()} />
        <Animated.View key={animateKey} entering={SlideInRight.duration(320)} style={{ flex: 1 }}>
        <View style={styles.centered}>
          <ThemedText style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            Recent activity is available for crew and team leaders.
          </ThemedText>
        </View>
        </Animated.View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="Recent activity" showBack onBack={() => router.back()} />
      <Animated.View key={animateKey} entering={SlideInRight.duration(320)} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + U.section }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={isDark ? themeYellow : themeBlue}
          />
        }
      >
        <View style={[styles.card, { backgroundColor: isDark ? '#1E212A' : '#F5F7FC', borderColor: colors.border }]}>
          {recentCheckinActivities.length === 0 ? (
            <View style={styles.activityItem}>
              <View style={[styles.activityDotLarge, { backgroundColor: (isDark ? VibrantColors.amber : themeBlue) + '22', borderColor: isDark ? VibrantColors.amber : themeBlue }]}>
                <Ionicons name="pulse-outline" size={18} color={isDark ? VibrantColors.amber : themeBlue} />
              </View>
              <View style={styles.activityContent}>
                <ThemedText style={[styles.activityTitle, { color: colors.text }]}>Your activity</ThemedText>
                <ThemedText style={[styles.activitySub, { color: colors.textSecondary }]}>
                  Office and event check-ins will appear here. Pull to refresh after checking in.
                </ThemedText>
              </View>
            </View>
          ) : (
            <View style={styles.timeline}>
              {recentCheckinActivities.map((item, index) => {
                const accent = getActivityAccentColor(item.type, isDark);
                const isLast = index === recentCheckinActivities.length - 1;
                return (
                  <View key={item.key} style={[styles.activityItem, index > 0 && styles.activityItemNotFirst]}>
                    <View style={styles.activityLeftColumn}>
                      <View style={[styles.activityDotLarge, { backgroundColor: accent + '28', borderColor: accent }]}>
                        <Ionicons name={item.icon} size={14} color={accent} />
                      </View>
                      {!isLast && <View style={[styles.timelineLine, { backgroundColor: isDark ? colors.border : '#E4E4E7' }]} />}
                    </View>
                    <View style={styles.activityContent}>
                      <ThemedText style={[styles.activityTitle, { color: colors.text }]}>{item.title}</ThemedText>
                      <ThemedText style={[styles.activitySub, { color: colors.textSecondary }]}>{item.sub}</ThemedText>
                      <View style={styles.activityTimeRow}>
                        <ThemedText style={[styles.activityTime, { color: accent }]}>{item.time}</ThemedText>
                        {item.relativeTime !== item.time && item.relativeTime !== '—' && (
                          <ThemedText style={[styles.activityTimeAgo, { color: colors.textSecondary }]}> · {item.relativeTime}</ThemedText>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: U.lg, paddingTop: U.section },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: U.xl },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    padding: U.xl,
    overflow: 'hidden',
  },
  timeline: { flexDirection: 'column' },
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', gap: U.md },
  activityItemNotFirst: { marginTop: U.lg },
  activityLeftColumn: { alignItems: 'center', width: 28 },
  activityDotLarge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: U.lg,
    marginTop: 4,
    borderRadius: 1,
  },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  activitySub: { fontSize: 13, marginBottom: 4 },
  activityTimeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 2 },
  activityTime: { fontSize: 11 },
  activityTimeAgo: { fontSize: 11 },
  emptyTitle: { fontSize: 15, textAlign: 'center' },
});
