/**
 * Admin/team leader: list events with checklist progress (tap to open checklist for that event).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type ChecklistProgressItem, type Event } from '~/services/api';
import { AppHeader } from '@/components/AppHeader';
import { StagepassLoader } from '@/components/StagepassLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

const todayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function isToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) === todayDateString();
}

type EventWithProgress = Event & { progress?: ChecklistProgressItem[]; total?: number; completed?: number };

export default function ChecklistsListScreen() {
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<EventWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const bottomPad = insets.bottom + Spacing.xl * 2;

  const loadData = useCallback(async () => {
    try {
      const res = await api.events.list({ per_page: 100 });
      const list = Array.isArray(res?.data) ? res.data : [];
      const active = list.filter((e) => e.status !== 'completed' && e.status !== 'closed');
      const withProgress: EventWithProgress[] = await Promise.all(
        active.map(async (e) => {
          try {
            const prog = await api.events.eventChecklistProgress(e.id);
            const data = Array.isArray(prog?.data) ? prog.data : [];
            const total = data.reduce((s, p) => s + p.total, 0);
            const completed = data.reduce((s, p) => s + p.completed, 0);
            return { ...e, progress: data, total, completed };
          } catch {
            return { ...e, progress: [], total: 0, completed: 0 };
          }
        })
      );
      withProgress.sort((a, b) => {
        const aToday = isToday(a.date) ? 0 : 1;
        const bToday = isToday(b.date) ? 0 : 1;
        if (aToday !== bToday) return aToday - bToday;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      setEvents(withProgress);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <StagepassLoader message="Loading checklists…" fullScreen />;
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Checklists" showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={themeYellow} />
        }
      >
        <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
          View checklist progress by event.
        </ThemedText>
        {events.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>No active events with checklists.</ThemedText>
          </View>
        ) : (
          events.map((event) => {
            const total = event.total ?? 0;
            const completed = event.completed ?? 0;
            const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
            return (
              <Pressable
                key={event.id}
                onPress={() => router.push({ pathname: '/admin/events/[id]/checklist', params: { id: String(event.id) } })}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.iconWrap, { backgroundColor: themeYellow + '22' }]}>
                    <Ionicons name="checkbox" size={24} color={themeYellow} />
                  </View>
                  <View style={styles.cardBody}>
                    <ThemedText style={[styles.eventName, { color: colors.text }]} numberOfLines={1}>
                      {event.name}
                    </ThemedText>
                    <ThemedText style={[styles.eventMeta, { color: colors.textSecondary }]}>
                      {event.date}
                      {event.start_time ? ` · ${event.start_time}` : ''}
                    </ThemedText>
                    {total > 0 && (
                      <View style={[styles.progressWrap, { backgroundColor: colors.border }]}>
                        <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: themeYellow }]} />
                      </View>
                    )}
                    <ThemedText style={[styles.percentText, { color: colors.textSecondary }]}>
                      {total > 0 ? `${completed}/${total} items (${percent}%)` : 'No checklist items'}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.lg },
  subtitle: { fontSize: 14, marginBottom: Spacing.lg },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: { flex: 1, minWidth: 0 },
  eventName: { fontSize: 16, fontWeight: '700' },
  eventMeta: { fontSize: 13, marginTop: 2 },
  progressWrap: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  percentText: { fontSize: 12, marginTop: 4 },
  empty: { fontSize: 14 },
});
