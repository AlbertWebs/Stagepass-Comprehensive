/**
 * Request manual allowance (Taxi / Transport / Emergency / Other) with receipt.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, type AllowanceTypeItem } from '~/services/api';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';

const MANUAL_LABELS = ['Taxi', 'Transport', 'Emergency', 'Other'] as const;

function isManualTypeName(name: string | undefined | null): boolean {
  if (name == null || name === '') return false;
  const n = name.trim().toLowerCase();
  return (MANUAL_LABELS as readonly string[]).some((m) => m.toLowerCase() === n);
}

export default function RequestAllowanceScreen() {
  const router = useRouter();
  const handleNav = useNavigationPress();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useStagePassTheme();
  const { eventId: eventIdParam } = useLocalSearchParams<{ eventId?: string }>();
  const eventId = eventIdParam ? Number(eventIdParam) : 0;

  const [eventName, setEventName] = useState('');
  const [types, setTypes] = useState<AllowanceTypeItem[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [mime, setMime] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);

  const manualTypes = useMemo(() => {
    const rows = types.filter((t) => isManualTypeName(t.name));
    const byLabel = new Map<string, AllowanceTypeItem>();
    for (const t of rows) {
      const key = (t.name ?? '').trim().toLowerCase();
      if (!byLabel.has(key)) byLabel.set(key, t);
    }
    return MANUAL_LABELS.map((label) => {
      const found = byLabel.get(label.toLowerCase());
      return found ?? null;
    }).filter((x): x is AllowanceTypeItem => x != null);
  }, [types]);

  const selectedTypeLabel = useMemo(() => {
    if (selectedTypeId == null) return '';
    const id = Number(selectedTypeId);
    const t = types.find((x) => Number(x.id) === id);
    return t?.name?.trim() ?? '';
  }, [selectedTypeId, types]);

  const load = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [ev, ty] = await Promise.all([api.events.get(eventId), api.payments.allowanceTypes()]);
      setEventName(ev?.name ?? 'Event');
      const list = Array.isArray(ty?.data) ? ty.data : [];
      setTypes(list);
      const first = list.find((t) => isManualTypeName(t.name));
      setSelectedTypeId(first != null ? Number(first.id) : null);
    } catch {
      setEventName('');
      setTypes([]);
      setSelectedTypeId(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Photo library access is needed to attach a receipt.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      const a = res.assets[0];
      setImageUri(a.uri);
      setMime(a.mimeType ?? 'image/jpeg');
    }
  };

  const submit = async () => {
    if (!eventId || selectedTypeId == null) {
      Alert.alert('Missing', 'Select an allowance type.');
      return;
    }
    const n = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('Amount', 'Enter an amount greater than zero.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Reason', 'Please describe why you need this allowance.');
      return;
    }
    if (!imageUri) {
      Alert.alert('Receipt', 'Attach a photo of your receipt (JPG or PNG).');
      return;
    }
    setSubmitting(true);
    try {
      await api.payments.submitAllowanceRequest({
        event_id: eventId,
        allowance_type_id: Number(selectedTypeId),
        amount: n,
        reason: reason.trim(),
        attachment: { uri: imageUri, mimeType: mime, name: 'receipt.jpg' },
      });
      Alert.alert(
        'Submitted',
        'Allowance request submitted successfully. Waiting for team leader approval.',
        [{ text: 'OK', onPress: () => handleNav(() => router.back()) }]
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const cardBg = isDark ? '#1E212A' : '#F5F7FC';
  const border = colors.border;

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Request allowance" showBack onBack={() => handleNav(() => router.back())} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={{
            padding: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl * 2,
          }}
          keyboardShouldPersistTaps="always"
        >
          {loading ? (
            <ThemedText style={{ color: colors.textSecondary }}>Loading…</ThemedText>
          ) : (
            <>
              <ThemedText style={[styles.eventTitle, { color: colors.text }]}>{eventName}</ThemedText>
              <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
                Submit a reimbursement request. Your team leader will be notified.
              </ThemedText>

              <ThemedText style={[styles.label, { color: colors.text }]}>Allowance type</ThemedText>
              {manualTypes.length === 0 ? (
                <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
                  No allowance types are available yet. Ask an administrator to configure Taxi, Transport, Emergency, and Other in
                  the system, then pull to refresh this screen.
                </ThemedText>
              ) : (
                <>
                  <Pressable
                    onPress={() => setTypePickerOpen(true)}
                    style={({ pressed }) => [
                      styles.typeDropdown,
                      {
                        borderColor: border,
                        backgroundColor: cardBg,
                        opacity: pressed ? NAV_PRESSED_OPACITY : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Choose allowance type"
                  >
                    <ThemedText style={{ color: selectedTypeLabel ? colors.text : colors.textSecondary, flex: 1 }}>
                      {selectedTypeLabel || 'Tap to choose type'}
                    </ThemedText>
                    <Ionicons name="chevron-down" size={22} color={colors.textSecondary} />
                  </Pressable>
                  <Modal
                    visible={typePickerOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setTypePickerOpen(false)}
                  >
                    <Pressable style={styles.modalBackdrop} onPress={() => setTypePickerOpen(false)}>
                      <Pressable style={[styles.modalSheet, { backgroundColor: cardBg, borderColor: border }]} onPress={(e) => e.stopPropagation()}>
                        <ThemedText style={[styles.modalSheetTitle, { color: colors.text }]}>Allowance type</ThemedText>
                        <ScrollView style={styles.modalList} keyboardShouldPersistTaps="always">
                          {manualTypes.map((t) => {
                            const tid = Number(t.id);
                            const sel = selectedTypeId != null && Number(selectedTypeId) === tid;
                            return (
                              <Pressable
                                key={t.id}
                                onPress={() => {
                                  setSelectedTypeId(tid);
                                  setTypePickerOpen(false);
                                }}
                                style={({ pressed }) => [
                                  styles.modalRow,
                                  {
                                    borderBottomColor: border,
                                    backgroundColor: sel ? themeYellow + '22' : 'transparent',
                                    opacity: pressed ? 0.85 : 1,
                                  },
                                ]}
                              >
                                <ThemedText style={{ color: colors.text, fontWeight: sel ? '700' : '500' }}>{t.name?.trim()}</ThemedText>
                                {sel ? <Ionicons name="checkmark-circle" size={22} color={themeBlue} /> : null}
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                        <Pressable onPress={() => setTypePickerOpen(false)} style={styles.modalCloseBtn}>
                          <ThemedText style={{ color: themeBlue, fontWeight: '600' }}>Cancel</ThemedText>
                        </Pressable>
                      </Pressable>
                    </Pressable>
                  </Modal>
                </>
              )}

              <ThemedText style={[styles.label, { color: colors.text }]}>Amount (KES)</ThemedText>
              <StagePassInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="e.g. 1500"
                style={styles.inputBox}
              />

              <ThemedText style={[styles.label, { color: colors.text }]}>Reason</ThemedText>
              <StagePassInput
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Taxi — transport delay"
                multiline
                style={styles.inputBox}
              />

              <ThemedText style={[styles.label, { color: colors.text }]}>Receipt photo</ThemedText>
              <Pressable
                onPress={pickImage}
                style={({ pressed }) => [
                  styles.receiptBox,
                  { borderColor: border, backgroundColor: cardBg, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Ionicons name="image-outline" size={28} color={themeBlue} />
                <ThemedText style={{ color: colors.textSecondary, marginTop: 6 }}>
                  {imageUri ? 'Receipt selected — tap to change' : 'JPG or PNG — tap to choose'}
                </ThemedText>
              </Pressable>

              <StagePassButton
                title={submitting ? 'Submitting…' : 'Submit request'}
                onPress={submit}
                disabled={submitting}
                style={{ marginTop: Spacing.xl, backgroundColor: themeBlue }}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  eventTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  hint: { fontSize: 14, marginBottom: Spacing.lg },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: Spacing.md },
  typeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    minHeight: 48,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    borderWidth: 1,
    maxHeight: '70%',
    paddingBottom: Spacing.lg,
  },
  modalSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  modalList: { maxHeight: 360 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalCloseBtn: { alignItems: 'center', paddingTop: Spacing.md },
  inputBox: { marginBottom: Spacing.sm },
  receiptBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
});
