import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { api, type Event as EventType } from '~/services/api';
import { StagePassButton } from '@/components/StagePassButton';
import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

export type TransferCrewMember = { id: number; name: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  sourceEventId: number;
  crew: TransferCrewMember[];
  /** When set (e.g. crew row action), only destination is chosen in the modal. */
  member?: TransferCrewMember | null;
  onTransferred: () => void | Promise<void>;
};

function formatEventDate(dateStr?: string): string {
  if (!dateStr) return 'No date';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function TransferCrewModal({ visible, onClose, sourceEventId, crew, member, onTransferred }: Props) {
  const { colors } = useStagePassTheme();
  const [eventOptions, setEventOptions] = useState<EventType[]>([]);
  const [pickedMember, setPickedMember] = useState<TransferCrewMember | null>(null);
  const [selectedTargetEventId, setSelectedTargetEventId] = useState('');
  const [transferring, setTransferring] = useState(false);

  const loadEventOptions = useCallback(async () => {
    if (!sourceEventId) return;
    try {
      const res = await api.events.list({ per_page: 100 });
      const allEvents = Array.isArray(res?.data) ? res.data : [];
      setEventOptions(
        allEvents.filter((e) => {
          if (e.id === sourceEventId) return false;
          return e.status !== 'completed' && e.status !== 'closed' && e.status !== 'done_for_the_day';
        })
      );
    } catch {
      setEventOptions([]);
    }
  }, [sourceEventId]);

  useEffect(() => {
    if (!visible) return;
    setPickedMember(member ?? null);
    setSelectedTargetEventId('');
    void loadEventOptions();
  }, [visible, member, loadEventOptions]);

  const effectiveMember = member ?? pickedMember;

  const handleTransfer = async () => {
    if (!sourceEventId || !effectiveMember) return;
    const targetEventId = selectedTargetEventId ? Number(selectedTargetEventId) : 0;
    if (!targetEventId) {
      Alert.alert('Select event', 'Choose a destination event for this crew member.');
      return;
    }
    setTransferring(true);
    try {
      await api.events.transferUser(sourceEventId, effectiveMember.id, targetEventId);
      await onTransferred();
      onClose();
      Alert.alert('Transferred', `${effectiveMember.name} has been transferred.`);
    } catch (e) {
      Alert.alert('Transfer failed', e instanceof Error ? e.message : 'Could not transfer crew member.');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.modalBackdrop} onPress={() => !transferring && onClose()}>
        <Pressable style={[styles.modalContent, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
          <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Transfer crew member</ThemedText>

          {!member && (
            <>
              <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Crew member</ThemedText>
              <View style={styles.pickerWrap}>
                <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                  {crew.length === 0 ? (
                    <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>No crew on this event.</ThemedText>
                  ) : (
                    crew.map((m) => (
                      <Pressable
                        key={m.id}
                        style={[
                          styles.pickerItem,
                          { backgroundColor: pickedMember?.id === m.id ? themeYellow + '33' : 'transparent' },
                        ]}
                        onPress={() => setPickedMember(m)}
                      >
                        <ThemedText style={[styles.pickerItemText, { color: colors.text }]}>{m.name}</ThemedText>
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              </View>
            </>
          )}

          {member ? (
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
              Move {member.name} to another event
            </ThemedText>
          ) : null}

          <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Destination event</ThemedText>
          <View style={styles.pickerWrap}>
            <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
              {eventOptions.length === 0 ? (
                <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>No available destination events.</ThemedText>
              ) : (
                eventOptions.map((e) => (
                  <Pressable
                    key={e.id}
                    style={[
                      styles.pickerItem,
                      { backgroundColor: selectedTargetEventId === String(e.id) ? themeYellow + '33' : 'transparent' },
                    ]}
                    onPress={() => setSelectedTargetEventId(String(e.id))}
                  >
                    <ThemedText style={[styles.pickerItemText, { color: colors.text }]}>{e.name}</ThemedText>
                    <ThemedText style={[styles.pickerItemSub, { color: colors.textSecondary }]}>
                      {formatEventDate(e.date)}
                      {e.location_name ? ` · ${e.location_name}` : ''}
                    </ThemedText>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
          <View style={styles.modalActions}>
            <StagePassButton title="Cancel" variant="outline" onPress={onClose} disabled={transferring} style={styles.modalBtn} />
            <StagePassButton
              title={transferring ? 'Transferring…' : 'Transfer'}
              onPress={handleTransfer}
              disabled={transferring || !effectiveMember || !selectedTargetEventId}
              style={[styles.modalBtn, { backgroundColor: themeYellow }]}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.md },
  label: { fontSize: 13, marginBottom: Spacing.xs, fontWeight: '600' },
  pickerWrap: { maxHeight: 200, marginBottom: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, borderColor: 'rgba(0,0,0,0.1)' },
  pickerScroll: { maxHeight: 200 },
  pickerItem: { padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
  pickerItemText: { fontSize: 15, fontWeight: '600' },
  pickerItemSub: { fontSize: 12, marginTop: 2 },
  empty: { fontSize: 14, margin: Spacing.md },
  modalActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  modalBtn: { flex: 1 },
});
