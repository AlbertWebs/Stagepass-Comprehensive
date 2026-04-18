/**
 * Tasks list: crew sees assigned tasks, admin sees all. Card layout with status, priority, deadline.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { api, type TaskItem, type TaskStatus } from '~/services/api';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Cards, Icons, Typography } from '@/constants/ui';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';
import { useAppRole } from '~/hooks/useAppRole';

const TAB_BAR_HEIGHT = 58;

const PRIORITY_COLOR: Record<string, string> = {
  low: '#16A34A',
  medium: themeYellow,
  high: '#DC2626',
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
  const { colors, isDark } = useStagePassTheme();
  const role = useAppRole();
  const [animateKey, setAnimateKey] = useState(0);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollBottomPadding = TAB_BAR_HEIGHT;
  const statusColor: Record<TaskStatus, string> = {
    pending: colors.textSecondary,
    in_progress: themeYellow,
    completed: colors.success,
  };
  const accentStrip: Record<TaskStatus, string> = {
    pending: isDark ? '#64748B' : '#94A3B8',
    in_progress: themeYellow,
    completed: colors.success,
  };

  useFocusEffect(
    useCallback(() => {
      setAnimateKey((k) => k + 1);
    }, [])
  );

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

  const summary = useMemo(() => {
    const pending = tasks.filter((t) => t.status === 'pending').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    return { total: tasks.length, pending, inProgress, completed };
  }, [tasks]);

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
      <Animated.View key={animateKey} entering={SlideInRight.duration(320)} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPadding }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeYellow} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.hero,
            {
              backgroundColor: isDark ? '#1E212A' : themeBlue + '12',
              borderColor: isDark ? colors.border : themeBlue + '28',
            },
          ]}
        >
          <View style={[styles.heroIconWrap, { backgroundColor: themeBlue + (isDark ? '24' : '18') }]}>
            <Ionicons name="checkbox" size={Icons.header} color={isDark ? themeYellow : themeBlue} />
          </View>
          <View style={styles.heroTextWrap}>
            <ThemedText style={[styles.heroTitle, { color: colors.text }]}>Tasks</ThemedText>
            <ThemedText style={[styles.heroSub, { color: colors.textSecondary }]}>
              {role === 'admin' ? 'Track and manage team work items' : 'Your assigned tasks and progress'}
            </ThemedText>
          </View>
        </View>

        {tasks.length > 0 && (
          <View style={styles.statsRow}>
            <View style={[styles.statChip, styles.statChipElevated, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.statValue, { color: colors.text }]}>{summary.total}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Total</ThemedText>
            </View>
            <View style={[styles.statChip, styles.statChipElevated, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.statValue, { color: colors.text }]}>{summary.pending}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Pending</ThemedText>
            </View>
            <View style={[styles.statChip, styles.statChipElevated, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.statValue, { color: colors.text }]}>{summary.inProgress}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>In progress</ThemedText>
            </View>
            <View style={[styles.statChip, styles.statChipElevated, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ThemedText style={[styles.statValue, { color: colors.text }]}>{summary.completed}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>Done</ThemedText>
            </View>
          </View>
        )}

        {tasks.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: themeBlue + (isDark ? '22' : '14') }]}>
              <Ionicons name="checkbox-outline" size={36} color={isDark ? themeYellow : themeBlue} />
            </View>
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
              <View style={[styles.cardAccent, { backgroundColor: accentStrip[task.status] }]} />
              <View style={styles.cardInner}>
              <View style={styles.cardRow}>
                <ThemedText style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                  {task.title}
                </ThemedText>
                <View style={[styles.statusBadge, { backgroundColor: statusColor[task.status] + '1F', borderColor: statusColor[task.status] + '55' }]}>
                  <ThemedText style={[styles.statusText, { color: statusColor[task.status] }]}>
                    {STATUS_LABEL[task.status]}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={Icons.small} color={colors.textSecondary} style={styles.cardChevron} />
              </View>
              {task.event?.name ? (
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={Icons.small} color={colors.textSecondary} />
                  <ThemedText style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                  {task.event.name}
                  </ThemedText>
                </View>
              ) : null}
              <View style={styles.footer}>
                <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLOR[task.priority] || themeYellow }]} />
                <ThemedText style={[styles.priorityText, { color: PRIORITY_COLOR[task.priority] || themeYellow }]}>
                  {(task.priority || 'medium').replace('_', ' ')}
                </ThemedText>
                <ThemedText style={[styles.due, { color: colors.textSecondary }]}>
                  Due {formatDueDate(task.due_date)}
                </ThemedText>
                {task.assignees?.length ? (
                  <ThemedText style={[styles.assignees, { color: colors.textSecondary }]} numberOfLines={1}>
                    · {task.assignees.map((a) => a.name).join(', ')}
                  </ThemedText>
                ) : null}
              </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: 15 },
  scroll: { padding: Spacing.lg },
  hero: {
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: { flex: 1 },
  heroTitle: { fontSize: Typography.titleCard, fontWeight: Typography.titleCardWeight },
  heroSub: { fontSize: Typography.bodySmall },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  statChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statChipElevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: { fontSize: Typography.bodySemiBold, fontWeight: Typography.bodySemiBoldWeight },
  statLabel: { fontSize: Typography.titleSection, textTransform: 'uppercase' },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: Spacing.md },
  emptySub: { fontSize: 14, marginTop: Spacing.xs, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardAccent: { width: 4, alignSelf: 'stretch' },
  cardInner: { flex: 1, padding: Spacing.lg, paddingLeft: Spacing.md },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  cardChevron: { marginTop: 2 },
  title: { fontSize: 16, fontWeight: '700', flex: 1, flexShrink: 1 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  meta: { fontSize: 13, flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, gap: 6 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  due: { fontSize: 12 },
  assignees: { fontSize: 12, flex: 1 },
});
