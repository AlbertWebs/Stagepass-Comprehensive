/**
 * Admin/team leader: list events to manage check-in.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Event } from '~/services/api';
import { AppHeader } from '@/components/AppHeader';
import { StagepassLoader } from '@/components/StagepassLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';

const todayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function isToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) === todayDateString();
}

function sortEvents(a: Event, b: Event): number {
  const aToday = isToday(a.date) ? 0 : 1;
  const bToday = isToday(b.date) ? 0 : 1;
  if (aToday !== bToday) return aToday - bToday;
  const d = new Date(a.date).getTime() - new Date(b.date).getTime();
  if (d !== 0) return d;
  const tA = (a.start_time || '').replace(':', '');
  const tB = (b.start_time || '').replace(':', '');
  return tA.localeCompare(tB);
}

export default function ManageCheckInListScreen() {
  const router = useRouter();
  const handleNav = useNavigationPress();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const bottomPad = insets.bottom + Spacing.xl * 2;

  const loadEvents = useCallback(async () => {
    try {
      const res = await api.events.list({ per_page: 100 });
      const list = Array.isArray(res?.data) ? res.data : [];
      setEvents(list.filter((e) => e.status !== 'closed').sort(sortEvents));
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

  if (loading) return <StagepassLoader message="Loading events…" fullScreen />;

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Manage check-in" showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEvents(); }} tintColor={themeYellow} />
        }
      >
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          Select an event to check in crew on their behalf.
        </ThemedText>
        {events.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>No active events.</ThemedText>
          </View>
        ) : (
          events.map((event) => (
            <Pressable
              key={event.id}
              onPress={() => handleNav(() => router.push({ pathname: '/admin/events/[id]/manage-checkin', params: { id: String(event.id) } }))}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && { opacity: NAV_PRESSED_OPACITY },
              ]}
            >
              <View style={styles.cardRow}>
                <View style={[styles.iconWrap, { backgroundColor: themeYellow + '22' }]}>
                  <Ionicons name="location" size={24} color={themeYellow} />
                </View>
                <View style={styles.cardBody}>
                  <ThemedText style={[styles.eventName, { color: colors.text }]} numberOfLines={1}>{event.name}</ThemedText>
                  <ThemedText style={[styles.eventMeta, { color: colors.textSecondary }]}>
                    {event.date}{event.start_time ? ` · ${event.start_time}` : ''}{event.location_name ? ` · ${event.location_name}` : ''}
                  </ThemedText>
                  {isToday(event.date) && (
                    <View style={[styles.todayBadge, { backgroundColor: themeYellow + '33' }]}>
                      <ThemedText style={[styles.todayBadgeText, { color: themeYellow }]}>Today</ThemedText>
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.lg },
  subtitle: { fontSize: 14, marginBottom: Spacing.lg },
  card: { padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWrap: { width: 48, height: 48, borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1, minWidth: 0 },
  eventName: { fontSize: 16, fontWeight: '700' },
  eventMeta: { fontSize: 13, marginTop: 2 },
  todayBadge: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.sm },
  todayBadgeText: { fontSize: 11, fontWeight: '700' },
  empty: { fontSize: 14 },
});
