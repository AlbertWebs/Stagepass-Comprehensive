/**
 * Admin: assign and remove crew for an event.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Event as EventType, type User } from '~/services/api';
import { AppHeader } from '@/components/AppHeader';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

type CrewMember = { id: number; name: string; pivot?: { checkin_time?: string; checkout_time?: string } };

export default function AdminEventCrewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<EventType | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [roleInEvent, setRoleInEvent] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [checkingInId, setCheckingInId] = useState<number | null>(null);

  const eventId = id ? Number(id) : 0;
  const crew: CrewMember[] = event?.crew ?? [];

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    try {
      const e = await api.events.get(eventId);
      setEvent(e);
    } catch {
      Alert.alert('Error', 'Failed to load event.');
    }
  }, [eventId]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.users.list();
      setUsers(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    Promise.all([loadEvent(), loadUsers()]).finally(() => setLoading(false));
  }, [eventId, loadEvent, loadUsers]);

  const handleAddCrew = async () => {
    const uid = selectedUserId ? Number(selectedUserId) : 0;
    if (!uid || !eventId) return;
    if (crew.some((c) => c.id === uid)) {
      Alert.alert('Already assigned', 'This person is already on the crew.');
      return;
    }
    setAssigning(true);
    try {
      await api.events.assignUser(eventId, uid, roleInEvent.trim() || undefined);
      await loadEvent();
      setAddModalVisible(false);
      setSelectedUserId('');
      setRoleInEvent('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not add crew member.');
    } finally {
      setAssigning(false);
    }
  };

  const handleCheckInOnBehalf = async (userId: number) => {
    if (!eventId) return;
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
    Alert.alert(
      'Remove from crew',
      'Remove this person from the event crew?',
      [
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
      ]
    );
  };

  const alreadyAssignedIds = crew.map((c) => c.id);
  const availableUsers = users.filter((u) => !alreadyAssignedIds.includes(u.id));
  const isEnded = event?.status === 'completed' || event?.status === 'closed';

  if (loading || !event) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Crew" showBack />
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
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Assigned crew</ThemedText>
            {!isEnded && (
              <Pressable
                style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => setAddModalVisible(true)}
              >
                <Ionicons name="person-add" size={20} color={themeBlue} />
                <ThemedText style={[styles.addBtnText, { color: themeBlue }]}>Add</ThemedText>
              </Pressable>
            )}
          </View>
          {crew.length === 0 ? (
            <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>
              No crew assigned yet. Tap Add to assign crew.
            </ThemedText>
          ) : (
            crew.map((member) => (
              <View
                key={member.id}
                style={[styles.crewRow, { borderBottomColor: colors.border }]}
              >
                <View style={styles.crewInfo}>
                  <ThemedText style={[styles.crewName, { color: colors.text }]}>{member.name}</ThemedText>
                  {member.pivot?.checkin_time ? (
                    <ThemedText style={[styles.crewMeta, { color: colors.textSecondary }]}>
                      Checked in
                    </ThemedText>
                  ) : null}
                </View>
                {!isEnded && (
                  <View style={styles.crewActions}>
                    {!member.pivot?.checkin_time && (
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
        <Pressable style={styles.modalBackdrop} onPress={() => setAddModalVisible(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Add to crew</ThemedText>
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Person</ThemedText>
            <View style={styles.pickerWrap}>
              <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                {availableUsers.length === 0 ? (
                  <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>
                    No other users available to add.
                  </ThemedText>
                ) : (
                  availableUsers.map((u) => (
                    <Pressable
                      key={u.id}
                      style={[
                        styles.pickerItem,
                        { backgroundColor: selectedUserId === String(u.id) ? themeYellow + '33' : 'transparent' },
                      ]}
                      onPress={() => setSelectedUserId(String(u.id))}
                    >
                      <ThemedText style={[styles.pickerItemText, { color: colors.text }]}>{u.name}</ThemedText>
                      {u.email ? (
                        <ThemedText style={[styles.pickerItemSub, { color: colors.textSecondary }]}>{u.email}</ThemedText>
                      ) : null}
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Role (optional)</ThemedText>
            <StagePassInput
              value={roleInEvent}
              onChangeText={setRoleInEvent}
              placeholder="e.g. Stagehand"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <StagePassButton
                title="Cancel"
                variant="outline"
                onPress={() => setAddModalVisible(false)}
                style={styles.modalBtn}
              />
              <StagePassButton
                title={assigning ? 'Adding…' : 'Add'}
                onPress={handleAddCrew}
                disabled={assigning || !selectedUserId}
                style={[styles.modalBtn, { backgroundColor: themeYellow }]}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: 15 },
  scroll: { padding: Spacing.lg },
  card: { padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
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
  crewInfo: { flex: 1 },
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
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.md },
  label: { fontSize: 13, marginBottom: Spacing.xs, fontWeight: '600' },
  pickerWrap: { maxHeight: 200, marginBottom: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, borderColor: 'rgba(0,0,0,0.1)' },
  pickerScroll: { maxHeight: 200 },
  pickerItem: { padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  pickerItemText: { fontSize: 15, fontWeight: '600' },
  pickerItemSub: { fontSize: 12, marginTop: 2 },
  input: { marginBottom: Spacing.md },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  modalBtn: { flex: 1 },
});
