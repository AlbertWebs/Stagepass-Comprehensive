/**
 * Team leader / admin: onboard crew onto an event — select people and add them.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { api, type Event as EventType, type User } from '~/services/api';
import { canManageEventCrew } from '~/utils/eventCrewPermissions';
import {
  canLeaderManualCheckIn,
  getLeaderManualCheckInBlockedMessage,
} from '@/src/utils/eventEligibility';
import { AppHeader } from '@/components/AppHeader';
import { TransferCrewModal } from '@/components/TransferCrewModal';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

type CrewMember = {
  id: number;
  name: string;
  pivot?: { checkin_time?: string; checkout_time?: string; role_in_event?: string | null };
};

export default function AdminEventCrewScreen() {
  const { id, openAdd } = useLocalSearchParams<{ id: string; openAdd?: string }>();
  const router = useRouter();
  const { colors, isDark } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<EventType | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferMember, setTransferMember] = useState<CrewMember | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [personSearch, setPersonSearch] = useState('');
  const [roleInEvent, setRoleInEvent] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [checkingInId, setCheckingInId] = useState<number | null>(null);

  const eventId = id ? Number(id) : 0;
  const crew: CrewMember[] = event?.crew ?? [];
  const currentUser = useSelector((s: { auth: { user: User | null } }) => s.auth.user);
  const canManage = canManageEventCrew(currentUser, event);

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    try {
      const e = await api.events.get(eventId);
      setEvent(e);
    } catch {
      Alert.alert('Error', 'Failed to load event.');
    }
  }, [eventId]);

  const loadUsers = useCallback(async (search?: string) => {
    setUsersLoading(true);
    try {
      const res = await api.users.list({
        per_page: 200,
        search: search?.trim() || undefined,
      });
      setUsers(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setUsers([]);
      Alert.alert('Could not load people', 'Check your connection and try again.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([loadEvent(), loadUsers()]).finally(() => setLoading(false));
  }, [eventId, loadEvent, loadUsers]);

  useEffect(() => {
    if (openAdd === '1' && !loading && event && canManage) {
      setAddModalVisible(true);
    }
  }, [openAdd, loading, event, canManage]);

  useEffect(() => {
    if (!addModalVisible) return;
    const t = setTimeout(() => {
      void loadUsers(personSearch);
    }, 280);
    return () => clearTimeout(t);
  }, [personSearch, addModalVisible, loadUsers]);

  const alreadyAssignedIds = useMemo(() => new Set(crew.map((c) => c.id)), [crew]);
  const availableUsers = useMemo(
    () => users.filter((u) => !alreadyAssignedIds.has(u.id)),
    [users, alreadyAssignedIds]
  );

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const closeAddModal = () => {
    setAddModalVisible(false);
    setSelectedUserIds([]);
    setRoleInEvent('');
    setPersonSearch('');
  };

  const handleAddCrew = async () => {
    if (!eventId || selectedUserIds.length === 0) return;
    setAssigning(true);
    const role = roleInEvent.trim() || undefined;
    const failed: string[] = [];
    let added = 0;

    for (const uid of selectedUserIds) {
      if (alreadyAssignedIds.has(uid)) continue;
      try {
        await api.events.assignUser(eventId, uid, role);
        added += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not add';
        const person = users.find((u) => u.id === uid)?.name ?? `User #${uid}`;
        if (/already|overlap|conflict|assigned/i.test(msg)) {
          failed.push(`${person}: ${msg}`);
        } else {
          failed.push(`${person}: ${msg}`);
        }
      }
    }

    await loadEvent();
    setAssigning(false);

    if (added > 0 && failed.length === 0) {
      closeAddModal();
      Alert.alert('Crew onboarded', `${added} ${added === 1 ? 'person was' : 'people were'} added to this event.`);
      return;
    }
    if (added > 0 && failed.length > 0) {
      closeAddModal();
      Alert.alert(
        'Partially added',
        `${added} added. ${failed.length} could not be added:\n${failed.slice(0, 4).join('\n')}`
      );
      return;
    }
    Alert.alert('Could not add crew', failed[0] ?? 'Try again.');
  };

  const handleCheckInOnBehalf = async (userId: number) => {
    if (!eventId || !event) return;
    if (!canLeaderManualCheckIn(event)) {
      Alert.alert(
        'Cannot check in',
        getLeaderManualCheckInBlockedMessage(event) ?? 'This event is no longer open for check-in.'
      );
      return;
    }
    setCheckingInId(userId);
    try {
      await api.attendance.checkinOnBehalf(eventId, userId);
      await loadEvent();
    } catch (e) {
      Alert.alert('Check-in failed', e instanceof Error ? e.message : 'Could not check in.');
    } finally {
      setCheckingInId(null);
    }
  };

  const handleRemove = (userId: number) => {
    if (!eventId) return;
    Alert.alert('Remove from crew', 'Remove this person from the event crew?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingId(userId);
          try {
            await api.events.removeUser(eventId, userId);
            await loadEvent();
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Could not remove.');
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  };

  const openTransferModal = (member: CrewMember) => {
    setTransferMember(member);
    setTransferModalVisible(true);
  };

  const isEnded =
    event?.status === 'completed' || event?.status === 'closed' || event?.status === 'done_for_the_day';
  const canManualCheckIn = event != null && canLeaderManualCheckIn(event);
  const searchBorder = isDark ? colors.border : themeBlue + '33';

  if (loading || !event) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Onboard crew" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeYellow} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>Loading…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title={`Crew: ${event.name}`} showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        {isEnded ? (
          <ThemedText style={[styles.readOnlyHint, { color: colors.textSecondary, borderColor: colors.border }]}>
            This event has ended — crew assignments cannot be changed here.
          </ThemedText>
        ) : !canManage ? (
          <ThemedText style={[styles.readOnlyHint, { color: colors.textSecondary, borderColor: colors.border }]}>
            Only an admin or the team leader assigned to this event can onboard crew. If you lead this event but do
            not see actions, ask an admin to set you as team leader on the event.
          </ThemedText>
        ) : (
          <ThemedText style={[styles.leadHint, { color: colors.textSecondary }]}>
            Select people and add them to this event. You can onboard more than one at a time.
          </ThemedText>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>
              Assigned crew ({crew.length})
            </ThemedText>
            {!isEnded && canManage && (
              <Pressable
                style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => {
                  setSelectedUserIds([]);
                  setPersonSearch('');
                  setAddModalVisible(true);
                  void loadUsers();
                }}
              >
                <Ionicons name="person-add" size={20} color={colors.brandIcon} />
                <ThemedText style={[styles.addBtnText, { color: colors.brandText }]}>Onboard</ThemedText>
              </Pressable>
            )}
          </View>
          {crew.length === 0 ? (
            <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>
              {canManage && !isEnded
                ? 'No crew assigned yet. Tap Onboard to select and add people.'
                : 'No crew assigned yet.'}
            </ThemedText>
          ) : (
            crew.map((member) => (
              <View key={member.id} style={[styles.crewRow, { borderBottomColor: colors.border }]}>
                <View style={styles.crewInfo}>
                  <ThemedText style={[styles.crewName, { color: colors.text }]}>{member.name}</ThemedText>
                  {member.pivot?.role_in_event ? (
                    <ThemedText style={[styles.crewMeta, { color: colors.textSecondary }]}>
                      {member.pivot.role_in_event}
                    </ThemedText>
                  ) : null}
                  {member.pivot?.checkin_time ? (
                    <ThemedText style={[styles.crewMeta, { color: colors.textSecondary }]}>Checked in</ThemedText>
                  ) : null}
                </View>
                {!isEnded && canManage && (
                  <View style={styles.crewActions}>
                    {canManualCheckIn && !member.pivot?.checkin_time && (
                      <Pressable
                        onPress={() => handleCheckInOnBehalf(member.id)}
                        disabled={checkingInId === member.id}
                        style={({ pressed }) => [styles.checkInBtn, pressed && { opacity: 0.8 }]}
                      >
                        {checkingInId === member.id ? (
                          <ActivityIndicator size="small" color={themeYellow} />
                        ) : (
                          <>
                            <Ionicons name="location" size={18} color={themeYellow} />
                            <ThemedText style={[styles.checkInBtnText, { color: themeYellow }]}>Check in</ThemedText>
                          </>
                        )}
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => handleRemove(member.id)}
                      disabled={removingId === member.id}
                      style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
                    >
                      {removingId === member.id ? (
                        <ActivityIndicator size="small" color={colors.error} />
                      ) : (
                        <Ionicons name="person-remove" size={20} color={colors.error} />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => openTransferModal(member)}
                      style={({ pressed }) => [styles.transferBtn, pressed && { opacity: 0.7 }]}
                    >
                      <Ionicons name="swap-horizontal" size={20} color={themeBlue} />
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
        <StagePassButton
          title="Back to event"
          variant="outline"
          onPress={() => router.back()}
          style={styles.backBtn}
        />
      </ScrollView>

      <Modal visible={addModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={closeAddModal}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.background }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Onboard crew</ThemedText>
            <ThemedText style={[styles.modalSub, { color: colors.textSecondary }]}>
              Select one or more people to add to this event.
            </ThemedText>

            <View style={[styles.searchWrap, { borderColor: searchBorder, backgroundColor: colors.surface }]}>
              <Ionicons name="search" size={18} color={colors.textSecondary} />
              <TextInput
                value={personSearch}
                onChangeText={setPersonSearch}
                placeholder="Search by name or email"
                placeholderTextColor={colors.textSecondary}
                style={[styles.searchInput, { color: colors.text }]}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {personSearch ? (
                <Pressable onPress={() => setPersonSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
              People {selectedUserIds.length > 0 ? `· ${selectedUserIds.length} selected` : ''}
            </ThemedText>
            <View style={[styles.pickerWrap, { borderColor: searchBorder }]}>
              {usersLoading ? (
                <View style={styles.pickerLoading}>
                  <ActivityIndicator color={themeYellow} />
                </View>
              ) : (
                <ScrollView style={styles.pickerScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {availableUsers.length === 0 ? (
                    <ThemedText style={[styles.empty, { color: colors.textSecondary, padding: Spacing.md }]}>
                      {personSearch.trim()
                        ? 'No matching people found.'
                        : 'No other users available to add.'}
                    </ThemedText>
                  ) : (
                    availableUsers.map((u) => {
                      const selected = selectedUserIds.includes(u.id);
                      return (
                        <Pressable
                          key={u.id}
                          style={[
                            styles.pickerItem,
                            {
                              backgroundColor: selected ? themeYellow + '33' : 'transparent',
                              borderBottomColor: colors.border,
                            },
                          ]}
                          onPress={() => toggleUser(u.id)}
                        >
                          <View style={styles.pickerCheck}>
                            <Ionicons
                              name={selected ? 'checkbox' : 'square-outline'}
                              size={22}
                              color={selected ? themeYellow : colors.textSecondary}
                            />
                          </View>
                          <View style={styles.pickerTextWrap}>
                            <ThemedText style={[styles.pickerItemText, { color: colors.text }]}>{u.name}</ThemedText>
                            {u.email ? (
                              <ThemedText style={[styles.pickerItemSub, { color: colors.textSecondary }]}>
                                {u.email}
                              </ThemedText>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
              )}
            </View>

            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
              Role for selected (optional)
            </ThemedText>
            <StagePassInput
              value={roleInEvent}
              onChangeText={setRoleInEvent}
              placeholder="e.g. Stagehand"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <StagePassButton title="Cancel" variant="outline" onPress={closeAddModal} style={styles.modalBtn} />
              <StagePassButton
                title={
                  assigning
                    ? 'Adding…'
                    : selectedUserIds.length > 1
                      ? `Add ${selectedUserIds.length}`
                      : 'Add'
                }
                onPress={handleAddCrew}
                disabled={assigning || selectedUserIds.length === 0}
                style={[styles.modalBtn, { backgroundColor: themeYellow }]}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <TransferCrewModal
        visible={transferModalVisible}
        onClose={() => {
          setTransferModalVisible(false);
          setTransferMember(null);
        }}
        sourceEventId={eventId}
        crew={crew}
        member={transferMember}
        onTransferred={async () => {
          await loadEvent();
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: 15 },
  scroll: { padding: Spacing.lg },
  leadHint: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.md },
  readOnlyHint: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  card: { padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.lg },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtnText: { fontSize: 15, fontWeight: '600' },
  empty: { fontSize: 14, marginBottom: Spacing.sm },
  crewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  crewInfo: { flex: 1, minWidth: 0 },
  crewName: { fontSize: 16, fontWeight: '600' },
  crewMeta: { fontSize: 12, marginTop: 2 },
  crewActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.sm,
    backgroundColor: themeYellow + '22',
    borderWidth: 1,
    borderColor: themeYellow,
  },
  checkInBtnText: { fontSize: 13, fontWeight: '600' },
  transferBtn: { padding: Spacing.sm },
  removeBtn: { padding: Spacing.sm },
  backBtn: { marginTop: Spacing.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '88%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.xs },
  modalSub: { fontSize: 13, lineHeight: 18, marginBottom: Spacing.md },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  label: { fontSize: 13, marginBottom: Spacing.xs, fontWeight: '600' },
  pickerWrap: {
    maxHeight: 260,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  pickerScroll: { maxHeight: 260 },
  pickerLoading: { padding: Spacing.xl, alignItems: 'center' },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  pickerCheck: { paddingTop: 1 },
  pickerTextWrap: { flex: 1, minWidth: 0 },
  pickerItemText: { fontSize: 15, fontWeight: '600' },
  pickerItemSub: { fontSize: 12, marginTop: 2 },
  input: { marginBottom: Spacing.md },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  modalBtn: { flex: 1 },
});
