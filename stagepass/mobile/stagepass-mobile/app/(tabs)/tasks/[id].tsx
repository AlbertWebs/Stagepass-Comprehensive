/**
 * Task detail: view task, update status (crew), add comments.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type TaskItem, type TaskStatus } from '~/services/api';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useAppRole } from '~/hooks/useAppRole';

const STATUS_OPTIONS: TaskStatus[] = ['pending', 'in_progress', 'completed'];
const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
};
const PRIORITY_LABEL: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' };

function formatDueDate(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
}

function formatCommentTime(s?: string): string {
  if (!s) return '';
  try {
    const d = new Date(s);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return s;
  }
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const role = useAppRole();
  const taskId = id ? Number(id) : 0;
  const [task, setTask] = useState<TaskItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const canManageTask = role === 'admin' || role === 'team_leader';

  const load = useCallback(async () => {
    if (!taskId) return;
    try {
      const t = await api.tasks.get(taskId);
      setTask(t);
    } catch {
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const handleStatusChange = useCallback(
    async (status: TaskStatus) => {
      if (!taskId || task?.status === status) return;
      setUpdatingStatus(true);
      try {
        const updated = await api.tasks.updateStatus(taskId, status);
        setTask(updated);
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Could not update status.');
      } finally {
        setUpdatingStatus(false);
      }
    },
    [taskId, task?.status]
  );

  const handleAddComment = useCallback(async () => {
    const body = commentText.trim();
    if (!body || !taskId) return;
    setSubmittingComment(true);
    try {
      await api.tasks.addComment(taskId, body);
      setCommentText('');
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not add comment.');
    } finally {
      setSubmittingComment(false);
    }
  }, [taskId, commentText, load]);

  if (loading || !task) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Task" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeYellow} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            {loading ? 'Loading…' : 'Task not found'}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title={task.title} showBack />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl + 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.body, { color: colors.text }]}>
              {task.description || 'No description.'}
            </ThemedText>
            {task.notes ? (
              <ThemedText style={[styles.notes, { color: colors.textSecondary }]}>{task.notes}</ThemedText>
            ) : null}
            <View style={styles.metaRow}>
              <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
                Priority: {PRIORITY_LABEL[task.priority] ?? task.priority}
              </ThemedText>
              <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
                Due: {formatDueDate(task.due_date)}
              </ThemedText>
            </View>
            {task.event?.name ? (
              <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>Event: {task.event.name}</ThemedText>
            ) : null}
            {task.assignees?.length ? (
              <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
                Assigned: {task.assignees.map((a) => a.name).join(', ')}
              </ThemedText>
            ) : null}
          </View>

          {/* Status actions (crew + admin) */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                {canManageTask ? 'Status control' : 'Status'}
              </ThemedText>
            </View>
            {canManageTask && task.status !== 'completed' && (
              <Pressable
                onPress={() => handleStatusChange('completed')}
                disabled={updatingStatus}
                style={({ pressed }) => [
                  styles.completeBtn,
                  {
                    backgroundColor: themeYellow,
                    opacity: updatingStatus ? 0.7 : pressed ? NAV_PRESSED_OPACITY : 1,
                  },
                ]}
              >
                <Ionicons name="checkmark-done" size={16} color={themeBlue} />
                <ThemedText style={[styles.completeBtnText, { color: themeBlue }]}>
                  {updatingStatus ? 'Updating…' : 'Mark as completed'}
                </ThemedText>
              </Pressable>
            )}
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((status) => (
                <Pressable
                  key={status}
                  onPress={() => handleStatusChange(status)}
                  disabled={updatingStatus || task.status === status}
                  style={[
                    styles.statusBtn,
                    {
                      backgroundColor: task.status === status ? themeYellow + '22' : colors.background,
                      borderColor: task.status === status ? themeYellow : colors.border,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.statusBtnText,
                      { color: task.status === status ? themeYellow : colors.textSecondary },
                    ]}
                  >
                    {STATUS_LABEL[status]}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Comments */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                Comments {task.comments?.length ? `(${task.comments.length})` : ''}
              </ThemedText>
            </View>
            {(task.comments ?? []).map((c) => (
              <View key={c.id} style={[styles.comment, { borderBottomColor: colors.border }]}>
                <ThemedText style={[styles.commentBody, { color: colors.text }]}>{c.body}</ThemedText>
                <ThemedText style={[styles.commentMeta, { color: colors.textSecondary }]}>
                  {c.user?.name ?? 'User'} · {formatCommentTime(c.created_at)}
                </ThemedText>
              </View>
            ))}
            <View style={styles.commentInputRow}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Add a comment or update…"
                placeholderTextColor={colors.textSecondary}
                style={[styles.commentInput, { color: colors.text, borderColor: colors.border }]}
                multiline
                maxLength={2000}
                editable={!submittingComment}
              />
              <Pressable
                onPress={handleAddComment}
                disabled={!commentText.trim() || submittingComment}
                style={[
                  styles.commentSubmit,
                  {
                    backgroundColor: commentText.trim() ? themeYellow : colors.border,
                    opacity: submittingComment ? 0.7 : 1,
                  },
                ]}
              >
                <ThemedText style={[styles.commentSubmitText, { color: themeBlue }]}>
                  {submittingComment ? '…' : 'Post'}
                </ThemedText>
              </Pressable>
            </View>
            <ThemedText style={[styles.commentHint, { color: colors.textSecondary }]}>
              {canManageTask
                ? 'As admin/team leader, use comments for updates and handover notes.'
                : 'Add updates or blockers for your team.'}
            </ThemedText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: 15 },
  scroll: { padding: Spacing.lg },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitleAccent: { width: 3, height: 16, borderRadius: 0 },
  sectionTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  body: { fontSize: 15, lineHeight: 22 },
  notes: { fontSize: 13, marginTop: Spacing.sm, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm },
  meta: { fontSize: 13, marginTop: 4 },
  statusRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  completeBtn: {
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completeBtnText: { fontSize: 14, fontWeight: '700' },
  statusBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  statusBtnText: { fontSize: 14, fontWeight: '600' },
  comment: { paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  commentBody: { fontSize: 14 },
  commentMeta: { fontSize: 11, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, marginTop: Spacing.md },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 40,
    maxHeight: 100,
  },
  commentSubmit: { paddingVertical: 10, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md },
  commentSubmitText: { fontSize: 14, fontWeight: '700' },
  commentHint: { fontSize: 12, marginTop: Spacing.xs },
});
