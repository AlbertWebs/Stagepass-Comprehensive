/**
 * Admin/team leader: create a task for an event and assign to crew.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Event as EventType, type TaskPriority } from '~/services/api';
import { AppHeader } from '@/components/AppHeader';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

type CrewMember = { id: number; name: string };

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CreateTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const eventId = id ? Number(id) : 0;
  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const crew: CrewMember[] = (event?.crew ?? []).map((c) => ({ id: c.id, name: c.name }));

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    try {
      const e = await api.events.get(eventId);
      setEvent(e);
    } catch {
      Alert.alert('Error', 'Failed to load event.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const toggleMember = (userId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleCreate = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Required', 'Please enter a task title.');
      return;
    }
    if (selectedIds.size === 0) {
      Alert.alert('Assign crew', 'Please select at least one crew member to assign this task to.');
      return;
    }
    setSubmitting(true);
    try {
      await api.tasks.create({
        title: trimmedTitle,
        description: description.trim() || undefined,
        event_id: eventId,
        priority,
        due_date: dueDate ? toYMD(dueDate) : undefined,
        assignee_ids: Array.from(selectedIds),
      });
      Alert.alert('Task created', 'The task has been created and assigned to the selected crew.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create task.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !event) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Create task" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeYellow} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>Loading…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title={`Create task: ${event.name}`} showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Task title *</ThemedText>
          <StagePassInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Set up stage, Pack equipment"
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <ThemedText style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.md }]}>Description (optional)</ThemedText>
          <StagePassInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add details…"
            multiline
            numberOfLines={3}
            style={[styles.input, styles.inputMultiline, { color: colors.text, borderColor: colors.border }]}
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Priority</ThemedText>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => (
              <Pressable
                key={p.value}
                onPress={() => setPriority(p.value)}
                style={[
                  styles.priorityBtn,
                  { borderColor: colors.border },
                  priority === p.value && { backgroundColor: themeBlue, borderColor: themeBlue },
                ]}
              >
                <ThemedText style={[styles.priorityLabel, { color: priority === p.value ? themeYellow : colors.text }]}>
                  {p.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <ThemedText style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.md }]}>Due date (optional)</ThemedText>
          <Pressable
            onPress={() => setShowDueDatePicker(true)}
            style={({ pressed }) => [
              styles.datePickerRow,
              { borderColor: colors.border, backgroundColor: colors.surface },
              pressed && styles.datePickerRowPressed,
            ]}
          >
            <ThemedText style={[styles.datePickerRowText, { color: dueDate ? colors.text : colors.textSecondary }]}>
              {dueDate ? formatDisplayDate(dueDate) : 'Select due date'}
            </ThemedText>
            {dueDate ? (
              <Pressable
                onPress={(e) => { e.stopPropagation(); setDueDate(null); }}
                hitSlop={8}
                style={styles.clearDateBtn}
              >
                <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
              </Pressable>
            ) : (
              <Ionicons name="calendar-outline" size={22} color={colors.textSecondary} />
            )}
          </Pressable>
          {showDueDatePicker && (
            <DateTimePicker
              value={dueDate ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_: unknown, selected?: Date) => {
                if (Platform.OS === 'android') setShowDueDatePicker(false);
                if (selected) setDueDate(selected);
              }}
              minimumDate={new Date()}
            />
          )}
          {Platform.OS === 'ios' && showDueDatePicker && (
            <Pressable
              onPress={() => setShowDueDatePicker(false)}
              style={[styles.doneRow, { backgroundColor: colors.surface }]}
            >
              <ThemedText style={[styles.doneText, { color: themeYellow }]}>Done</ThemedText>
            </Pressable>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Assign to crew *</ThemedText>
          </View>
          <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
            Select at least one crew member to assign this task to.
          </ThemedText>
          {crew.length === 0 ? (
            <ThemedText style={[styles.emptyCrew, { color: colors.textSecondary }]}>No crew assigned to this event yet. Add crew first from the event.</ThemedText>
          ) : (
            crew.map((member) => {
              const selected = selectedIds.has(member.id);
              return (
                <Pressable
                  key={member.id}
                  onPress={() => toggleMember(member.id)}
                  style={[styles.memberRow, { borderBottomColor: colors.border }]}
                >
                  <View style={[styles.checkbox, selected && { backgroundColor: themeYellow, borderColor: themeYellow }]}>
                    {selected && <Ionicons name="checkmark" size={16} color={colors.brandIcon} />}
                  </View>
                  <ThemedText style={[styles.memberName, { color: colors.text }]}>{member.name}</ThemedText>
                </Pressable>
              );
            })
          )}
        </View>

        <StagePassButton
          title={submitting ? 'Creating…' : 'Create task'}
          onPress={handleCreate}
          disabled={submitting || !title.trim() || selectedIds.size === 0}
          style={[styles.submitBtn, { backgroundColor: themeYellow }]}
        />

        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <ThemedText style={[styles.cancelBtnText, { color: colors.brandText }]}>Cancel</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: 15 },
  scroll: { padding: Spacing.lg },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  label: { fontSize: 14, fontWeight: '600', marginBottom: Spacing.xs },
  input: {},
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitleAccent: { width: 3, height: 16, borderRadius: 0 },
  sectionTitle: { fontSize: 17, fontWeight: '700', flex: 1 },
  hint: { fontSize: 13, marginBottom: Spacing.sm },
  priorityRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  priorityBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  priorityLabel: { fontSize: 15, fontWeight: '600' },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  datePickerRowPressed: { opacity: 0.85 },
  datePickerRowText: { fontSize: 16 },
  clearDateBtn: { padding: 4 },
  doneRow: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  doneText: { fontSize: 16, fontWeight: '700' },
  emptyCrew: { fontSize: 14, fontStyle: 'italic' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberName: { fontSize: 16, flex: 1 },
  submitBtn: { marginBottom: Spacing.sm },
  cancelBtn: { alignSelf: 'center', paddingVertical: Spacing.md },
  cancelBtnText: { fontSize: 16, fontWeight: '600' },
});
