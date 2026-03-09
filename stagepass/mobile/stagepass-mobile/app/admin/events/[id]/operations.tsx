/**
 * Admin: event operations – task status and checklist item toggles.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, type Event, type MyChecklist, type MyTask } from '~/services/api';

export default function AdminEventOperationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useStagePassTheme();
  const [event, setEvent] = useState<Event | null>(null);
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [checklists, setChecklists] = useState<MyChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<number | string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const eventRes = await api.events.get(Number(id));
      setEvent(eventRes);
      try {
        const [tasksRes, checkRes] = await Promise.all([
          api.eventTasks(Number(id)),
          api.eventChecklists(Number(id)),
        ]);
        setTasks(Array.isArray(tasksRes?.data) ? tasksRes.data : []);
        setChecklists(Array.isArray(checkRes?.data) ? checkRes.data : []);
      } catch {
        setTasks([]);
        setChecklists([]);
      }
    } catch {
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTaskToggle = async (task: MyTask) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    setToggling(task.id);
    try {
      await api.taskComplete(task.id, {});
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update task.');
    } finally {
      setToggling(null);
    }
  };

  const handleChecklistToggle = async (itemId: number, isChecked: boolean) => {
    setToggling(`c-${itemId}`);
    try {
      await api.checklistUpdate(itemId, { is_checked: !isChecked });
      setChecklists((prev) =>
        prev.map((cl) => ({
          ...cl,
          items: cl.items.map((it) =>
            it.id === itemId ? { ...it, is_checked: !isChecked } : it
          ),
        }))
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update item.');
    } finally {
      setToggling(null);
    }
  };

  if (loading || !event) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Operations" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeBlue} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title={`Operations: ${event.name}`} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Tasks</ThemedText>
          {tasks.length === 0 ? (
            <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>No tasks for this event.</ThemedText>
          ) : (
            tasks.map((task) => (
              <View key={task.id} style={[styles.row, { borderColor: colors.border }]}>
                <ThemedText style={[styles.taskTitle, { color: colors.text }]} numberOfLines={2}>
                  {task.title}
                </ThemedText>
                <Switch
                  value={task.status === 'completed'}
                  onValueChange={() => handleTaskToggle(task)}
                  disabled={toggling === task.id}
                  trackColor={{ false: colors.border, true: themeYellow + '99' }}
                  thumbColor={task.status === 'completed' ? themeBlue : colors.textSecondary}
                />
              </View>
            ))
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Checklist</ThemedText>
          {checklists.length === 0 ? (
            <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>
              No checklists for this event.
            </ThemedText>
          ) : (
            checklists.flatMap((cl) =>
              cl.items.map((item) => (
                <View key={item.id} style={[styles.row, { borderColor: colors.border }]}>
                  <ThemedText
                    style={[
                      styles.taskTitle,
                      { color: colors.text, textDecorationLine: item.is_checked ? 'line-through' : 'none' },
                    ]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </ThemedText>
                  <Switch
                    value={item.is_checked}
                    onValueChange={() => handleChecklistToggle(item.id, item.is_checked)}
                    disabled={toggling === `c-${item.id}`}
                    trackColor={{ false: colors.border, true: themeYellow + '99' }}
                    thumbColor={item.is_checked ? themeBlue : colors.textSecondary}
                  />
                </View>
              ))
            )
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.lg },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: Spacing.md },
  empty: { fontSize: 14, fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  taskTitle: { flex: 1, fontSize: 15, marginRight: Spacing.md },
});
