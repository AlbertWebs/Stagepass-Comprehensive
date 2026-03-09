/**
 * Request time off – start/end date pickers, reason, submit.
 * Uses @react-native-community/datetimepicker for native date selection.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { api } from '~/services/api';

type PickerMode = 'start' | 'end' | null;

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function RequestTimeOffScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useStagePassTheme();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    return d;
  });
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPicker, setShowPicker] = useState<PickerMode>(null);

  const startStr = toDateString(startDate);
  const endStr = toDateString(endDate);
  const endBeforeStart = endDate < startDate;

  const handleStartChange = (_: unknown, date?: Date) => {
    setShowPicker(null);
    if (date) {
      setStartDate(date);
      if (date > endDate) setEndDate(new Date(date));
    }
  };

  const handleEndChange = (_: unknown, date?: Date) => {
    setShowPicker(null);
    if (date) setEndDate(date);
  };

  const handleSubmit = async () => {
    if (endBeforeStart) {
      Alert.alert('Invalid dates', 'End date must be on or after start date.');
      return;
    }
    setSubmitting(true);
    try {
      await api.timeOff.request(startStr, endStr, reason.trim() || undefined);
      Alert.alert('Submitted', 'Your time off request has been submitted.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert(
        'Request failed',
        e instanceof Error ? e.message : 'Could not submit. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cardBg = colors.surface;
  const cardBorder = colors.border;

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Request time off" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing.xxl * 2 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrap, { backgroundColor: themeYellow + '22' }]}>
                <Ionicons name="calendar-outline" size={24} color={themeBlue} />
              </View>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>
                Select dates
              </ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
                Choose the first and last day of your time off
              </ThemedText>
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
                Start date
              </ThemedText>
              <Pressable
                onPress={() => setShowPicker('start')}
                style={({ pressed }) => [
                  styles.dateTouchable,
                  { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Ionicons name="calendar" size={20} color={themeYellow} />
                <ThemedText style={[styles.dateText, { color: colors.text }]}>
                  {formatDisplayDate(startDate)}
                </ThemedText>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
                End date
              </ThemedText>
              <Pressable
                onPress={() => setShowPicker('end')}
                style={({ pressed }) => [
                  styles.dateTouchable,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: endBeforeStart ? colors.error : colors.inputBorder,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons name="calendar" size={20} color={themeYellow} />
                <ThemedText style={[styles.dateText, { color: endBeforeStart ? colors.error : colors.text }]}>
                  {formatDisplayDate(endDate)}
                </ThemedText>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
              {endBeforeStart && (
                <ThemedText style={[styles.hint, { color: colors.error }]}>
                  End date must be on or after start date
                </ThemedText>
              )}
            </View>

            {showPicker !== null && (
              <View style={Platform.OS === 'ios' ? styles.pickerWrap : undefined}>
                <DateTimePicker
                  value={showPicker === 'start' ? startDate : endDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={showPicker === 'start' ? handleStartChange : handleEndChange}
                  minimumDate={showPicker === 'end' ? startDate : today}
                  onTouchCancel={() => setShowPicker(null)}
                />
              </View>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrap, { backgroundColor: themeBlue + '18' }]}>
                <Ionicons name="document-text-outline" size={24} color={themeBlue} />
              </View>
              <ThemedText style={[styles.cardTitle, { color: colors.text }]}>
                Reason (optional)
              </ThemedText>
              <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
                Add a note for your manager
              </ThemedText>
            </View>
            <StagePassInput
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Personal leave, vacation"
              multiline
              numberOfLines={3}
              style={styles.reasonInput}
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <StagePassButton
            title={submitting ? 'Submitting…' : 'Submit request'}
            onPress={handleSubmit}
            disabled={submitting || endBeforeStart}
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  cardHeader: {
    marginBottom: Spacing.lg,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  cardSub: {
    fontSize: 14,
    lineHeight: 20,
  },
  fieldGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  dateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  pickerWrap: {
    marginTop: Spacing.sm,
  },
  reasonInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: themeYellow,
    borderWidth: 2,
    borderColor: themeBlue,
    paddingVertical: Spacing.md + 2,
  },
});
