/**
 * Approve or reject pending earned-allowance requests for this event.
 * Intentionally separate from Event operations (crew, check-in, report, end event).
 */
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { api, type EarnedAllowanceDetail, type Event as EventType, type User } from '~/services/api';
import { canApproveEarnedAllowancesForEvent } from '~/utils/eventCrewPermissions';
import { AppHeader } from '@/components/AppHeader';
import { StagePassButton } from '@/components/StagePassButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useAppRole } from '~/hooks/useAppRole';
import { useNavigationPress } from '@/src/utils/navigationPress';

export default function EventPendingAllowancesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const handleNav = useNavigationPress();
  const role = useAppRole();
  const { colors, isDark } = useStagePassTheme();
  const opsBorder = isDark ? themeYellow + '55' : colors.border;
  const insets = useSafeAreaInsets();
  const currentUser = useSelector((s: { auth: { user: User | null } }) => s.auth.user);

  const eventId = id ? Number(id) : 0;
  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAllowances, setPendingAllowances] = useState<EarnedAllowanceDetail[]>([]);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectAllowanceId, setRejectAllowanceId] = useState<number | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [allowanceActionLoading, setAllowanceActionLoading] = useState(false);

  const isEnded =
    event?.status === 'completed' || event?.status === 'closed' || event?.status === 'done_for_the_day';
  const canApproveAllowances = canApproveEarnedAllowancesForEvent(currentUser, event);
  const canUseScreen = canApproveAllowances && !isEnded;

  const navigateBack = useCallback(() => {
    handleNav(() => {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      const myEventsUsers = role === 'crew' || role === 'team_leader';
      if (myEventsUsers) {
        router.replace('/(tabs)/events');
      } else {
        router.replace('/(tabs)/admin/events');
      }
    });
  }, [handleNav, router, role]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        navigateBack();
        return true;
      });
      return () => sub.remove();
    }, [navigateBack])
  );

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
    void loadEvent();
  }, [loadEvent]);

  const loadPendingAllowances = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await api.payments.earnedAllowances({
        event_id: eventId,
        status: 'pending',
        per_page: 50,
      });
      const flat = Array.isArray(res?.flat) ? res.flat : [];
      setPendingAllowances(flat);
    } catch {
      setPendingAllowances([]);
    }
  }, [eventId]);

  useEffect(() => {
    if (!event || isEnded || !canApproveAllowances) return;
    void loadPendingAllowances();
  }, [event, isEnded, canApproveAllowances, loadPendingAllowances]);

  useFocusEffect(
    useCallback(() => {
      if (!event || isEnded || !canApproveAllowances) return;
      void loadPendingAllowances();
    }, [event, isEnded, canApproveAllowances, loadPendingAllowances])
  );

  const approveAllowance = async (row: EarnedAllowanceDetail) => {
    setAllowanceActionLoading(true);
    try {
      await api.payments.updateAllowanceStatus(row.id, 'approved');
      await loadPendingAllowances();
      Alert.alert('Approved', 'The crew member has been notified.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not approve.');
    } finally {
      setAllowanceActionLoading(false);
    }
  };

  const openReject = (allowanceId: number) => {
    setRejectAllowanceId(allowanceId);
    setRejectComment('');
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (rejectAllowanceId == null) return;
    const c = rejectComment.trim();
    if (!c) {
      Alert.alert('Required', 'Add a comment explaining the rejection.');
      return;
    }
    setAllowanceActionLoading(true);
    try {
      await api.payments.updateAllowanceStatus(rejectAllowanceId, 'rejected', c);
      setRejectModalVisible(false);
      setRejectAllowanceId(null);
      setRejectComment('');
      await loadPendingAllowances();
      Alert.alert('Rejected', 'The crew member has been notified.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not reject.');
    } finally {
      setAllowanceActionLoading(false);
    }
  };

  if (loading || !event) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Pending allowances" showBack onBack={navigateBack} />
        <View style={styles.centered}>
          <ThemedText style={{ color: colors.textSecondary }}>Loading…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!canUseScreen) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="Pending allowances" showBack onBack={navigateBack} />
        <View style={[styles.centered, { paddingHorizontal: Spacing.lg }]}>
          <ThemedText style={{ color: colors.textSecondary, textAlign: 'center' }}>
            You don’t have access to approve allowances for this event, or the event has ended.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Pending allowances" showBack onBack={navigateBack} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[styles.eventTitle, { color: colors.text }]}>{event.name}</ThemedText>
        <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
          Review requests submitted by crew for this event. Approve or reject with a clear reason.
        </ThemedText>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: opsBorder }]}>
          {pendingAllowances.length === 0 ? (
            <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>
              No pending allowance requests for this event.
            </ThemedText>
          ) : (
            pendingAllowances.map((row) => (
              <View
                key={row.id}
                style={[styles.allowRow, { borderBottomColor: opsBorder, paddingHorizontal: Spacing.lg }]}
              >
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ color: colors.text, fontWeight: '700' }}>{row.crew_name}</ThemedText>
                  <ThemedText style={[styles.opsSub, { color: colors.textSecondary }]}>
                    {row.allowance_type} · KES {Number(row.amount).toLocaleString()}
                  </ThemedText>
                  {row.description ? (
                    <ThemedText style={[styles.opsSub, { color: colors.textSecondary, marginTop: 4 }]}>
                      {row.description}
                    </ThemedText>
                  ) : null}
                  {row.recorded_at ? (
                    <ThemedText style={[styles.opsSub, { color: colors.textSecondary }]}>
                      {new Date(row.recorded_at).toLocaleString()}
                    </ThemedText>
                  ) : null}
                </View>
                <View style={{ gap: 8 }}>
                  <StagePassButton
                    title="Approve"
                    onPress={() => approveAllowance(row)}
                    disabled={allowanceActionLoading}
                    style={{ paddingVertical: 8, minHeight: 40, backgroundColor: themeBlue }}
                  />
                  <StagePassButton
                    title="Reject"
                    variant="outline"
                    onPress={() => openReject(row.id)}
                    disabled={allowanceActionLoading}
                    style={{ paddingVertical: 8, minHeight: 40, borderColor: themeYellow }}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => !allowanceActionLoading && setRejectModalVisible(false)}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.background, borderColor: themeYellow }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalTitleStrip, { backgroundColor: themeBlue }]}>
              <View style={[styles.modalTitleAccent, { backgroundColor: themeYellow }]} />
              <ThemedText style={styles.modalTitle}>Reject allowance</ThemedText>
            </View>
            <View style={styles.modalBody}>
              <ThemedText style={[styles.modalSub, { color: colors.textSecondary }]}>
                A comment is required. The crew member will see this in the app.
              </ThemedText>
              <TextInput
                value={rejectComment}
                onChangeText={setRejectComment}
                placeholder="Reason for rejection"
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderWidth: 1,
                    borderColor: opsBorder,
                    borderRadius: BorderRadius.md,
                    padding: Spacing.md,
                    minHeight: 88,
                    textAlignVertical: 'top',
                  },
                ]}
              />
              <View style={styles.modalActions}>
                <StagePassButton
                  title="Cancel"
                  variant="outline"
                  onPress={() => setRejectModalVisible(false)}
                  disabled={allowanceActionLoading}
                  style={styles.modalBtn}
                />
                <StagePassButton
                  title={allowanceActionLoading ? 'Saving…' : 'Reject'}
                  onPress={confirmReject}
                  disabled={allowanceActionLoading || !rejectComment.trim()}
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
  eventTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.sm },
  hint: { fontSize: 14, marginBottom: Spacing.lg, lineHeight: 20 },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  empty: { padding: Spacing.lg, fontSize: 14 },
  opsSub: { fontSize: 12, marginTop: 2 },
  allowRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
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
