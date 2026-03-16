/**
 * Time off: form to request time off (reason + dates, notes, attachments) and list my requests.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
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
import { useSelector } from 'react-redux';
import { AppHeader } from '@/components/AppHeader';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, type TimeOffRequest } from '~/services/api';

type PickedFile = { uri: string; name: string; mimeType?: string };

const REASON_OPTIONS = [
  { value: 'vacation', label: 'Vacation' },
  { value: 'sick', label: 'Sick leave' },
  { value: 'personal', label: 'Personal' },
  { value: 'family', label: 'Family' },
  { value: 'medical', label: 'Medical' },
  { value: 'other', label: 'Other' },
];

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminTimeOffScreen() {
  const { colors, isDark } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const user = useSelector((s: { auth: { user: { id: number } | null } }) => s.auth.user);

  const [reason, setReason] = useState('vacation');
  const [reasonOther, setReasonOther] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<PickedFile[]>([]);
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadRequests = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await api.timeoff.list();
      const data = Array.isArray((res as { data?: TimeOffRequest[] }).data)
        ? (res as { data: TimeOffRequest[] }).data
        : [];
      const mine = user?.id ? data.filter((r) => r.user_id === user.id) : data;
      setRequests(mine);
    } catch {
      setRequests([]);
    } finally {
      setLoadingList(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const reasonLabel = reason === 'other' ? reasonOther.trim() || 'Other' : REASON_OPTIONS.find((r) => r.value === reason)?.label ?? reason;
  const reasonToSend = reason === 'other' ? (reasonOther.trim() || 'Other') : reasonLabel;

  const pickFiles = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      const newFiles: PickedFile[] = result.assets.map((a) => ({
        uri: a.uri,
        name: a.name ?? 'file',
        mimeType: a.mimeType ?? undefined,
      }));
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    } catch {
      Alert.alert('Error', 'Could not open document picker.');
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    const startStr = toYMD(startDate);
    const endStr = toYMD(endDate);
    if (endStr < startStr) {
      Alert.alert('Invalid dates', 'End date must be on or after start date.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.timeOff.request(startStr, endStr, reasonToSend, notes.trim() || undefined);
      if (created?.id && selectedFiles.length > 0) {
        await api.timeOff.uploadAttachments(created.id, selectedFiles);
      }
      Alert.alert('Submitted', 'Your time off request has been submitted.');
      setStartDate(new Date());
      setEndDate(new Date());
      setReason('vacation');
      setReasonOther('');
      setNotes('');
      setSelectedFiles([]);
      loadRequests();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to submit request';
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  }, [startDate, endDate, reasonToSend, notes, selectedFiles, loadRequests]);

  const onStartDateChange = (_: unknown, d?: Date) => {
    if (Platform.OS === 'android') setShowStartPicker(false);
    if (d) {
      setStartDate(d);
      if (d > endDate) setEndDate(d);
    }
  };
  const onEndDateChange = (_: unknown, d?: Date) => {
    if (Platform.OS === 'android') setShowEndPicker(false);
    if (d) setEndDate(d);
  };

  const cardBg = colors.surface;
  const cardBorder = isDark ? themeYellow + '44' : colors.inputBorder;

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Request time off" showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View style={[styles.banner, { backgroundColor: colors.error + '20', borderColor: colors.error }]}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <ThemedText style={[styles.bannerText, { color: colors.error }]}>{error}</ThemedText>
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>New request</ThemedText>

            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Reason</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {REASON_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setReason(opt.value)}
                  style={[
                    styles.chip,
                    reason === opt.value ? { backgroundColor: themeYellow, borderColor: themeYellow } : { backgroundColor: colors.inputBackground, borderColor: colors.border },
                  ]}
                >
                  <ThemedText
                    style={[styles.chipText, { color: reason === opt.value ? '#0f1838' : colors.text }]}
                  >
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
            {reason === 'other' && (
              <StagePassInput
                value={reasonOther}
                onChangeText={setReasonOther}
                placeholder="Specify reason"
                style={styles.input}
              />
            )}

            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Explain more (optional)</ThemedText>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any details or context for your request..."
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={3}
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />

            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Attach files (optional)</ThemedText>
            <Pressable
              onPress={pickFiles}
              style={[styles.attachBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            >
              <Ionicons name="document-attach-outline" size={20} color={colors.text} />
              <ThemedText style={{ color: colors.text, fontWeight: '600' }}>Add file(s)</ThemedText>
            </Pressable>
            {selectedFiles.length > 0 ? (
              <View style={styles.fileList}>
                {selectedFiles.map((f, i) => (
                  <View key={`${f.uri}-${i}`} style={[styles.fileRow, { backgroundColor: colors.inputBackground }]}>
                    <Ionicons name="document" size={18} color={colors.textSecondary} />
                    <ThemedText style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>{f.name}</ThemedText>
                    <Pressable onPress={() => removeFile(i)} hitSlop={8}>
                      <Ionicons name="close-circle" size={22} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Start date</ThemedText>
            <Pressable
              onPress={() => { setShowEndPicker(false); setShowStartPicker(true); }}
              style={[styles.dateRow, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            >
              <ThemedText style={{ color: colors.text }}>{startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</ThemedText>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </Pressable>
            {showStartPicker && (
              <>
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onStartDateChange}
                  minimumDate={new Date()}
                />
                {Platform.OS === 'ios' && (
                  <Pressable onPress={() => setShowStartPicker(false)} style={styles.doneRow}>
                    <ThemedText style={[styles.doneText, { color: themeYellow }]}>Done</ThemedText>
                  </Pressable>
                )}
              </>
            )}

            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>End date</ThemedText>
            <Pressable
              onPress={() => { setShowStartPicker(false); setShowEndPicker(true); }}
              style={[styles.dateRow, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            >
              <ThemedText style={{ color: colors.text }}>{endDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</ThemedText>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </Pressable>
            {showEndPicker && (
              <>
                <DateTimePicker
                  value={endDate < startDate ? startDate : endDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onEndDateChange}
                  minimumDate={startDate}
                />
                {Platform.OS === 'ios' && (
                  <Pressable onPress={() => setShowEndPicker(false)} style={styles.doneRow}>
                    <ThemedText style={[styles.doneText, { color: themeYellow }]}>Done</ThemedText>
                  </Pressable>
                )}
              </>
            )}

            <StagePassButton
              title={submitting ? 'Submitting…' : 'Submit request'}
              onPress={handleSubmit}
              disabled={submitting}
              style={[styles.submitBtn, { backgroundColor: themeYellow }]}
            />
          </View>

          <View style={styles.sectionHeader}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>My requests</ThemedText>
          </View>
          {loadingList ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={themeYellow} />
              <ThemedText style={{ color: colors.textSecondary }}>Loading…</ThemedText>
            </View>
          ) : requests.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <ThemedText style={{ color: colors.textSecondary }}>No time off requests yet.</ThemedText>
            </View>
          ) : (
            requests.map((r) => (
              <View key={r.id} style={[styles.requestCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.requestRow}>
                  <ThemedText style={[styles.requestRange, { color: colors.text }]}>
                    {formatDisplayDate(r.start_date)} – {formatDisplayDate(r.end_date)}
                  </ThemedText>
                </View>
                {r.reason ? <ThemedText style={[styles.requestReason, { color: colors.textSecondary }]}>{r.reason}</ThemedText> : null}
                <View style={[styles.statusChip, r.status === 'approved' ? { backgroundColor: colors.success + '22' } : r.status === 'rejected' ? { backgroundColor: colors.error + '22' } : { backgroundColor: themeYellow + '22' }]}>
                  <ThemedText style={[styles.statusText, { color: r.status === 'approved' ? colors.success : r.status === 'rejected' ? colors.error : themeYellow }]}>
                    {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                  </ThemedText>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '600' },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.lg },
  label: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.xs },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  input: { marginBottom: Spacing.md },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    minHeight: 88,
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  fileList: { marginBottom: Spacing.md },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  fileName: { flex: 1, fontSize: 14 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  doneRow: { paddingVertical: Spacing.sm, marginBottom: Spacing.sm },
  doneText: { fontSize: 16, fontWeight: '600' },
  submitBtn: { marginTop: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionTitleAccent: { width: 3, height: 16, borderRadius: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  requestCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  requestRow: { flexDirection: 'row', alignItems: 'center' },
  requestRange: { fontSize: 15, fontWeight: '600' },
  requestReason: { fontSize: 14, marginTop: Spacing.xs, color: '#71717A' },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
});
