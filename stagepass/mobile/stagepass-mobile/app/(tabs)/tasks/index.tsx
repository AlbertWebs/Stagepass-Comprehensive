/**
 * Tasks list: crew sees assigned tasks, admin sees all. Card layout with status, priority, deadline.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { api, type TaskItem, type TaskStatus } from '~/services/api';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';
import { useAppRole } from '~/hooks/useAppRole';

const TAB_BAR_HEIGHT = 58;

const PRIORITY_COLOR: Record<string, string> = {
  low: '#22c55e',
  medium: themeYellow,
  high: '#ef4444',
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: '#94a3b8',
  in_progress: themeYellow,
  completed: '#22c55e',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
};

function formatDueDate(d?: string | null): string {
  if (!d) return '—';
  try {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
}

export default function TasksListScreen() {
  const router = useRouter();
  const handleNav = useNavigationPress();
  const { colors } = useStagePassTheme();
  const role = useAppRole();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollBottomPadding = TAB_BAR_HEIGHT;

  const load = useCallback(async () => {
    try {
      const res = await api.tasks.list({ per_page: 100 });
      setTasks(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading && tasks.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Tasks" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeYellow} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>Loading tasks…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Tasks" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPadding }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeYellow} />
        }
        showsVerticalScrollIndicator={false}
      >
        {tasks.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="checkbox-outline" size={40} color={colors.textSecondary} />
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No tasks yet</ThemedText>
            <ThemedText style={[styles.emptySub, { color: colors.textSecondary }]}>
              {role === 'admin' ? 'Create tasks from the web admin and assign crew.' : 'Tasks assigned to you will appear here.'}
            </ThemedText>
          </View>
        ) : (
          tasks.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => handleNav(() => router.push(`/(tabs)/tasks/${task.id}`))}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? NAV_PRESSED_OPACITY : 1 },
              ]}
            >
              <View style={styles.cardRow}>
                <ThemedText style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {task.title}
                </ThemedText>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[task.status] + '22' }]}>
                  <ThemedText style={[styles.statusText, { color: STATUS_COLOR[task.status] }]}>
                    {STATUS_LABEL[task.status]}
                  </ThemedText>
                </View>
              </View>
              {task.event?.name ? (
                <ThemedText style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                  {task.event.name}
                </ThemedText>
              ) : null}
              <View style={styles.footer}>
                <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLOR[task.priority] || themeYellow }]} />
                <ThemedText style={[styles.due, { color: colors.textSecondary }]}>
                  Due {formatDueDate(task.due_date)}
                </ThemedText>
                {task.assignees?.length ? (
                  <ThemedText style={[styles.assignees, { color: colors.textSecondary }]} numberOfLines={1}>
                    · {task.assignees.map((a) => a.name).join(', ')}
                  </ThemedText>
                ) : null}
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: 15 },
  scroll: { padding: Spacing.lg },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: Spacing.md },
  emptySub: { fontSize: 14, marginTop: Spacing.xs, textAlign: 'center' },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  title: { fontSize: 16, fontWeight: '700', flex: 1 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  statusText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, gap: 6 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  due: { fontSize: 12 },
  assignees: { fontSize: 12, flex: 1 },
});
