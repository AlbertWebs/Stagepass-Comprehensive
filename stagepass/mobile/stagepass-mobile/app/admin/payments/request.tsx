/**
 * Admin: request payment – select event, user, enter hours, submit to billing.
 */
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { api, type Event, type User } from '~/services/api';

export default function AdminRequestPaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useStagePassTheme();
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [eventId, setEventId] = useState<number | ''>('');
  const [userId, setUserId] = useState<number | ''>('');
  const [hours, setHours] = useState('');
  const [perDiem, setPerDiem] = useState('');
  const [allowances, setAllowances] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [eventsRes, usersRes] = await Promise.all([
        api.events.list(),
        api.users.list(),
      ]);
      setEvents(Array.isArray(eventsRes?.data) ? eventsRes.data : []);
      setUsers(Array.isArray(usersRes?.data) ? usersRes.data : []);
    } catch {
      setEvents([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    const eId = typeof eventId === 'number' ? eventId : Number(eventId);
    const uId = typeof userId === 'number' ? userId : Number(userId);
    const h = parseFloat(hours);
    if (!eId || !uId) {
      Alert.alert('Required', 'Select an event and a user.');
      return;
    }
    if (isNaN(h) || h <= 0) {
      Alert.alert('Invalid', 'Enter a valid number of hours.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.payments.request(
        eId,
        uId,
        h,
        perDiem ? parseFloat(perDiem) || 0 : undefined,
        allowances ? parseFloat(allowances) || 0 : undefined
      );
      Alert.alert(
        'Request submitted',
        `Payment request created. Total: ${res?.total_amount ?? '—'}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not submit payment request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Request payment" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeBlue} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Request payment" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Event</ThemedText>
            <View style={styles.pickerRow}>
              {events.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => setEventId(e.id)}
                  style={({ pressed }) => [
                    styles.chip,
                    { borderColor: colors.border, backgroundColor: eventId === e.id ? themeYellow + '22' : colors.inputBackground, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <ThemedText
                    style={[styles.chipText, { color: eventId === e.id ? themeBlue : colors.text }]}
                    numberOfLines={1}
                  >
                    {e.name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            {events.length === 0 && (
              <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>No events. Create one first.</ThemedText>
            )}

            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>User (crew member)</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
              {users.map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => setUserId(u.id)}
                  style={({ pressed }) => [
                    styles.chip,
                    { borderColor: colors.border, backgroundColor: userId === u.id ? themeYellow + '22' : colors.inputBackground, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <ThemedText
                    style={[styles.chipText, { color: userId === u.id ? themeBlue : colors.text }]}
                    numberOfLines={1}
                  >
                    {u.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Hours</ThemedText>
            <StagePassInput
              value={hours}
              onChangeText={setHours}
              placeholder="e.g. 8"
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Per diem (optional)</ThemedText>
            <StagePassInput
              value={perDiem}
              onChangeText={setPerDiem}
              placeholder="0"
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Allowances (optional)</ThemedText>
            <StagePassInput
              value={allowances}
              onChangeText={setAllowances}
              placeholder="0"
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <StagePassButton
              title={submitting ? 'Submitting…' : 'Request payment'}
              onPress={handleSubmit}
              disabled={submitting}
              style={styles.submitBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.lg },
  card: { padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.sm },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  pickerScroll: { marginBottom: Spacing.md, maxHeight: 120 },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 13, marginBottom: Spacing.md },
  input: { marginBottom: Spacing.md },
  submitBtn: { marginTop: Spacing.sm, backgroundColor: themeYellow },
});
