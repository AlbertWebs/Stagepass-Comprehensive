/**
 * Admin: list all events and create new ones.
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

const TAB_BAR_HEIGHT = 56;

function sortByDateThenTime(a: Event, b: Event): number {
  const d = new Date(a.date).getTime() - new Date(b.date).getTime();
  if (d !== 0) return d;
  const tA = (a.start_time || '').replace(':', '');
  const tB = (b.start_time || '').replace(':', '');
  return tA.localeCompare(tB);
}

export default function AdminEventsListScreen() {
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const bottomPad = insets.bottom + TAB_BAR_HEIGHT + Spacing.lg;

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.events.list({ per_page: 100 });
      const list = Array.isArray(res?.data) ? res.data : [];
      setEvents(list.sort(sortByDateThenTime));
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

  const openEventOps = (id: number) => {
    router.push({ pathname: '/admin/events/[id]/operations', params: { id: String(id) } });
  };

  if (loading) {
    return <StagepassLoader message="Loading events…" fullScreen />;
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Events" />
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        <View style={[styles.heroStrip, { backgroundColor: themeBlue }]}>
          <View style={[styles.heroAccent, { backgroundColor: themeYellow }]} />
          <View style={styles.heroRow}>
            <Ionicons name="calendar" size={20} color={themeYellow} />
            <ThemedText style={styles.heroLabel}>Manage events</ThemedText>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.createBtn,
            { backgroundColor: themeYellow, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => router.push('/admin/events/create')}
        >
          <Ionicons name="add-circle" size={22} color={themeBlue} />
          <ThemedText style={styles.createBtnText}>Create event</ThemedText>
        </Pressable>

        {events.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconWrap, { borderColor: themeYellow, backgroundColor: themeBlue }]}>
              <Ionicons name="calendar-outline" size={44} color={themeYellow} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No events yet</ThemedText>
            <ThemedText style={[styles.emptySub, { color: colors.textSecondary }]}>
              Create your first event to get started.
            </ThemedText>
            <Pressable
              style={({ pressed }) => [styles.emptyBtn, { opacity: pressed ? 0.9 : 1 }]}
              onPress={() => router.push('/admin/events/create')}
            >
              <ThemedText style={styles.emptyBtnText}>Create event</ThemedText>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeYellow} />
            }
          >
            {events.map((item) => (
              <View key={item.id} style={[styles.cardWrap, { borderColor: themeBlue, backgroundColor: colors.surface }]}>
                <View style={[styles.cardBlueBar, { backgroundColor: themeBlue }]} />
                <View style={styles.cardBody}>
                <EventCard
                  event={{
                    id: item.id,
                    name: item.name,
                    date: item.date,
                    start_time: item.start_time,
                    expected_end_time: item.expected_end_time,
                    location_name: item.location_name,
                    status: item.status,
                  }}
                  onPress={() => openEventOps(item.id)}
                />
                  <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                    <Pressable
                      style={({ pressed }) => [styles.linkBtn, styles.linkBtnCrew, pressed && { opacity: 0.8 }]}
                      onPress={() => router.push({ pathname: '/admin/events/[id]/crew', params: { id: String(item.id) } })}
                    >
                      <Ionicons name="people-outline" size={18} color={themeBlue} />
                      <ThemedText style={[styles.linkBtnText, { color: themeBlue }]}>Crew</ThemedText>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.linkBtn, styles.linkBtnOps, pressed && { opacity: 0.8 }]}
                      onPress={() => openEventOps(item.id)}
                    >
                      <Ionicons name="settings-outline" size={18} color={themeYellow} />
                      <ThemedText style={[styles.linkBtnTextOps, { color: themeYellow }]}>Operations</ThemedText>
                    </Pressable>
                  </View>
                </View>
              </View>
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
    paddingHorizontal: Spacing.lg,
  },
  heroStrip: {
    marginHorizontal: -Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAccent: {
    width: 4,
    height: 24,
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: themeYellow,
    letterSpacing: 0.3,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: themeBlue,
    shadowColor: themeBlue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  createBtnText: { fontSize: 16, fontWeight: '700', color: themeBlue },
  list: { paddingBottom: Spacing.xxl },
  cardWrap: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: themeBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  cardBlueBar: {
    width: 5,
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  cardBody: { flex: 1 },
  cardActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkBtnCrew: {},
  linkBtnOps: {},
  linkBtnText: { fontSize: 14, fontWeight: '600' },
  linkBtnTextOps: { fontSize: 14, fontWeight: '600' },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    shadowColor: themeBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  emptyTitle: { fontSize: 19, fontWeight: '800', marginBottom: Spacing.sm, letterSpacing: 0.2 },
  emptySub: {
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  emptyBtn: {
    backgroundColor: themeYellow,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: themeBlue,
  },
  emptyBtnText: { fontSize: 16, fontWeight: '700', color: themeBlue },
});
