/**
 * Admin: manage event operations – edit, crew, end event, view details.
 * Vibrant layout with quick nav strip and theme accents.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Event as EventType } from '~/services/api';
import { AppHeader } from '@/components/AppHeader';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';

function formatEventDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatEventTime(start?: string, end?: string): string {
  if (!start) return '';
  try {
    const [sh, sm] = start.slice(0, 5).split(':');
    const hour = parseInt(sh, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    const startStr = `${h12}:${sm || '00'} ${ampm}`;
    if (!end) return startStr;
    const [eh, em] = end.slice(0, 5).split(':');
    const ehour = parseInt(eh, 10);
    const eampm = ehour >= 12 ? 'PM' : 'AM';
    const eh12 = ehour % 12 || 12;
    return `${startStr} – ${eh12}:${em || '00'} ${eampm}`;
  } catch {
    return start + (end ? ` – ${end}` : '');
  }
}

export default function AdminEventOperationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const handleNav = useNavigationPress();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [endModalVisible, setEndModalVisible] = useState(false);
  const [endComment, setEndComment] = useState('');
  const [ending, setEnding] = useState(false);

  const eventId = id ? Number(id) : 0;
  const isEnded = event?.status === 'completed' || event?.status === 'closed';
  const crewCount = event?.crew?.length ?? 0;

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

  const handleEndEvent = async () => {
    const comment = endComment.trim();
    if (!comment) {
      Alert.alert('Required', 'Please enter an end comment.');
      return;
    }
    setEnding(true);
    try {
      await api.events.end(eventId, { end_comment: comment });
      await loadEvent();
      setEndModalVisible(false);
      setEndComment('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not end event.');
    } finally {
      setEnding(false);
    }
  };

  const handleDeleteEvent = () => {
    Alert.alert(
      'Delete event',
      'Are you sure you want to delete this event? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.events.delete(eventId);
              Alert.alert('Deleted', 'Event has been deleted.', [{ text: 'OK', onPress: () => router.replace('/admin/events') }]);
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete event.');
            }
          },
        },
      ]
    );
  };

  if (loading || !event) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Operations" />
        <View style={styles.centered}>
          <ThemedText style={{ color: colors.textSecondary }}>Loading…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const navTo = (pathname: string) => () => handleNav(() => router.push({ pathname, params: { id: String(eventId) } }));

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={event.name} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back to events + quick nav */}
        <Pressable
          style={({ pressed }) => [styles.backStrip, { backgroundColor: themeBlue }, pressed && { opacity: NAV_PRESSED_OPACITY }]}
          onPress={() => handleNav(() => router.replace('/admin/events'))}
        >
          <Ionicons name="arrow-back" size={20} color={themeYellow} />
          <ThemedText style={styles.backStripText}>Back to events</ThemedText>
        </Pressable>

        <View style={[styles.quickNavWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.quickNavTitle, { color: colors.text }]}>Jump to</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickNavScroll}>
            <Pressable style={({ pressed }) => [styles.quickNavPill, { backgroundColor: themeBlue }, pressed && styles.quickNavPillPressed]} onPress={navTo('/admin/events/[id]/crew')}>
              <Ionicons name="people" size={18} color={themeYellow} />
              <ThemedText style={styles.quickNavPillText}>Crew</ThemedText>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.quickNavPill, { backgroundColor: themeBlue }, pressed && styles.quickNavPillPressed]} onPress={navTo('/admin/events/[id]/checklist')}>
              <Ionicons name="checkbox" size={18} color={themeYellow} />
              <ThemedText style={styles.quickNavPillText}>Checklist</ThemedText>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.quickNavPill, { backgroundColor: themeBlue }, pressed && styles.quickNavPillPressed]} onPress={navTo('/admin/events/[id]/message')}>
              <Ionicons name="chatbubble-ellipses" size={18} color={themeYellow} />
              <ThemedText style={styles.quickNavPillText}>Message</ThemedText>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.quickNavPill, { backgroundColor: themeBlue }, pressed && styles.quickNavPillPressed]} onPress={navTo('/admin/events/[id]/manage-checkin')}>
              <Ionicons name="location" size={18} color={themeYellow} />
              <ThemedText style={styles.quickNavPillText}>Check-in</ThemedText>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.quickNavPill, { backgroundColor: themeBlue }, pressed && styles.quickNavPillPressed]} onPress={() => handleNav(() => router.push({ pathname: '/events/[id]', params: { id: String(eventId) } }))}>
              <Ionicons name="calendar" size={18} color={themeYellow} />
              <ThemedText style={styles.quickNavPillText}>View event</ThemedText>
            </Pressable>
          </ScrollView>
        </View>

        <View style={[styles.card, styles.cardWithAccent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.cardAccent, { backgroundColor: themeYellow }]} />
          <View style={styles.cardInner}>
            <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
              {formatEventDate(event.date)}
              {event.start_time ? ` · ${formatEventTime(event.start_time, event.expected_end_time)}` : ''}
            </ThemedText>
            {event.location_name ? (
              <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>{event.location_name}</ThemedText>
            ) : null}
            <View style={[styles.statusBadgeWrap, { backgroundColor: themeBlue }]}>
              <ThemedText style={styles.statusBadge}>Status: {event.status}</ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: themeYellow }]} />
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Manage</ThemedText>
          </View>

          <Pressable
            style={({ pressed }) => [styles.opsRow, { borderBottomColor: colors.border }, pressed && styles.opsRowPressed]}
            onPress={() => handleNav(() => router.push({ pathname: '/admin/events/[id]/edit', params: { id: String(eventId) } }))}
          >
            <View style={[styles.opsIconWrap, { backgroundColor: themeYellow }]}>
              <Ionicons name="pencil" size={20} color={themeBlue} />
            </View>
            <ThemedText style={[styles.opsLabel, { color: colors.text }]}>Edit event</ThemedText>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.opsRow, { borderBottomColor: colors.border }, pressed && styles.opsRowPressed]}
            onPress={navTo('/admin/events/[id]/crew')}
          >
            <View style={[styles.opsIconWrap, { backgroundColor: themeYellow }]}>
              <Ionicons name="people" size={20} color={themeBlue} />
            </View>
            <View style={styles.opsLabelWrap}>
              <ThemedText style={[styles.opsLabel, { color: colors.text }]}>Assign crew</ThemedText>
              <ThemedText style={[styles.opsSub, { color: colors.textSecondary }]}>{crewCount} assigned</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.opsRow, { borderBottomColor: colors.border }, pressed && styles.opsRowPressed]}
            onPress={navTo('/admin/events/[id]/manage-checkin')}
          >
            <View style={[styles.opsIconWrap, { backgroundColor: themeYellow }]}>
              <Ionicons name="location" size={20} color={themeBlue} />
            </View>
            <View style={styles.opsLabelWrap}>
              <ThemedText style={[styles.opsLabel, { color: colors.text }]}>Manage check-in</ThemedText>
              <ThemedText style={[styles.opsSub, { color: colors.textSecondary }]}>Check in crew on their behalf</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.opsRow, { borderBottomColor: colors.border }, pressed && styles.opsRowPressed]}
            onPress={navTo('/admin/events/[id]/checklist')}
          >
            <View style={[styles.opsIconWrap, { backgroundColor: themeYellow }]}>
              <Ionicons name="checkbox" size={20} color={themeBlue} />
            </View>
            <View style={styles.opsLabelWrap}>
              <ThemedText style={[styles.opsLabel, { color: colors.text }]}>Checklist</ThemedText>
              <ThemedText style={[styles.opsSub, { color: colors.textSecondary }]}>View checklist progress</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.opsRow, { borderBottomColor: colors.border }, pressed && styles.opsRowPressed]}
            onPress={navTo('/admin/events/[id]/message')}
          >
            <View style={[styles.opsIconWrap, { backgroundColor: themeYellow }]}>
              <Ionicons name="chatbubble-ellipses" size={20} color={themeBlue} />
            </View>
            <View style={styles.opsLabelWrap}>
              <ThemedText style={[styles.opsLabel, { color: colors.text }]}>Message crew</ThemedText>
              <ThemedText style={[styles.opsSub, { color: colors.textSecondary }]}>Send message to all or selected crew</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.opsRow, { borderBottomColor: colors.border }, pressed && styles.opsRowPressed]}
            onPress={navTo('/admin/events/[id]/create-task')}
          >
            <View style={[styles.opsIconWrap, { backgroundColor: themeYellow }]}>
              <Ionicons name="list" size={20} color={themeBlue} />
            </View>
            <View style={styles.opsLabelWrap}>
              <ThemedText style={[styles.opsLabel, { color: colors.text }]}>Create task</ThemedText>
              <ThemedText style={[styles.opsSub, { color: colors.textSecondary }]}>Create a task and assign to crew</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.opsRow, styles.opsRowLast, { borderBottomColor: colors.border }, pressed && styles.opsRowPressed]}
            onPress={() => handleNav(() => router.push({ pathname: '/events/[id]', params: { id: String(eventId) } }))}
          >
            <View style={[styles.opsIconWrap, { backgroundColor: themeYellow }]}>
              <Ionicons name="calendar" size={20} color={themeBlue} />
            </View>
            <ThemedText style={[styles.opsLabel, { color: colors.text }]}>View event (check-in)</ThemedText>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {!isEnded && (
          <View style={[styles.card, styles.cardWithAccent, { backgroundColor: colors.surface, borderColor: themeYellow }]}>
            <View style={[styles.cardAccent, { backgroundColor: themeYellow }]} />
            <View style={styles.cardInner}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionAccent, { backgroundColor: themeBlue }]} />
                <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>End event</ThemedText>
              </View>
              <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
                Mark this event as completed. Crew will no longer be able to check in.
              </ThemedText>
              <View style={styles.endDeleteRow}>
                <StagePassButton
                  title="End event"
                  variant="outline"
                  onPress={() => setEndModalVisible(true)}
                  style={[styles.endDeleteBtn, { borderColor: themeBlue }]}
                />
                <StagePassButton
                  title="Delete event"
                  variant="destructive"
                  onPress={handleDeleteEvent}
                  style={styles.endDeleteBtn}
                />
              </View>
            </View>
          </View>
        )}

        {isEnded && (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.endedBadge, { backgroundColor: themeBlue }]}>
                <Ionicons name="checkmark-done" size={20} color={themeYellow} />
                <ThemedText style={styles.endedLabel}>This event has been ended.</ThemedText>
              </View>
            </View>
            <StagePassButton
              title="Delete event"
              variant="destructive"
              onPress={handleDeleteEvent}
              style={styles.deleteBtn}
            />
          </>
        )}
      </ScrollView>

      <Modal visible={endModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => !ending && setEndModalVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background, borderColor: themeYellow }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalTitleStrip, { backgroundColor: themeBlue }]}>
              <View style={[styles.modalTitleAccent, { backgroundColor: themeYellow }]} />
              <ThemedText style={styles.modalTitle}>End event</ThemedText>
            </View>
            <View style={styles.modalBody}>
              <ThemedText style={[styles.modalSub, { color: colors.textSecondary }]}>
                Provide a brief comment (required) before ending this event.
              </ThemedText>
              <StagePassInput
                value={endComment}
                onChangeText={setEndComment}
                placeholder="End comment"
                multiline
                numberOfLines={3}
                style={styles.input}
              />
              <View style={styles.modalActions}>
              <StagePassButton
                title="Cancel"
                variant="outline"
                onPress={() => setEndModalVisible(false)}
                disabled={ending}
                style={styles.modalBtn}
              />
              <StagePassButton
                title={ending ? 'Ending…' : 'End event'}
                onPress={handleEndEvent}
                disabled={ending || !endComment.trim()}
                style={[styles.modalBtn, { backgroundColor: themeYellow }]}
              />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.lg },
  backStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: -Spacing.lg,
    marginBottom: Spacing.lg,
  },
  backStripText: { fontSize: 15, fontWeight: '700', color: themeYellow },
  quickNavWrap: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  quickNavTitle: { fontSize: 13, fontWeight: '700', marginBottom: Spacing.sm, letterSpacing: 0.3 },
  quickNavScroll: { flexDirection: 'row', gap: Spacing.sm },
  quickNavPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  quickNavPillPressed: { opacity: NAV_PRESSED_OPACITY },
  quickNavPillText: { fontSize: 13, fontWeight: '600', color: themeYellow },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  cardWithAccent: { flexDirection: 'row' },
  cardAccent: { width: 5, borderTopLeftRadius: BorderRadius.lg, borderBottomLeftRadius: BorderRadius.lg },
  cardInner: { flex: 1, padding: Spacing.lg },
  meta: { fontSize: 14, marginBottom: 4 },
  statusBadgeWrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  statusBadge: { fontSize: 12, fontWeight: '700', color: themeYellow },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  sectionAccent: { width: 4, height: 20, borderRadius: 2, marginRight: Spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  cardSub: { fontSize: 13, marginBottom: Spacing.md },
  opsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  opsRowLast: { borderBottomWidth: 0 },
  opsRowPressed: { opacity: NAV_PRESSED_OPACITY },
  opsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },
  opsLabel: { fontSize: 16, fontWeight: '600', flex: 1 },
  opsLabelWrap: { flex: 1 },
  opsSub: { fontSize: 12, marginTop: 2 },
  endDeleteRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  endDeleteBtn: { flex: 1 },
  endedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  endedLabel: { fontSize: 14, color: themeYellow, fontWeight: '600' },
  deleteBtn: { marginTop: Spacing.lg, marginBottom: Spacing.lg },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: { borderRadius: BorderRadius.xl, padding: 0, borderWidth: 2, overflow: 'hidden' },
  modalTitleStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  modalTitleAccent: { width: 4, height: 22, borderRadius: 2, marginRight: Spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '700', color: themeYellow },
  modalBody: { padding: Spacing.lg },
  modalSub: { fontSize: 14, marginBottom: Spacing.md },
  input: { marginBottom: Spacing.md },
  modalActions: { flexDirection: 'row', gap: Spacing.md },
  modalBtn: { flex: 1 },
});
