/**
 * Admin: edit event form.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api } from '~/services/api';

export default function AdminEditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.events
      .get(Number(id))
      .then((e) => {
        setName(e.name ?? '');
        setDate(e.date ?? '');
        setStartTime(e.start_time ?? '');
        setEndTime(e.expected_end_time ?? '');
        setLocation(e.location_name ?? '');
        setDescription(e.description ?? '');
      })
      .catch(() => Alert.alert('Error', 'Failed to load event'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    if (!id) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Required', 'Event name is required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.events.update(Number(id), {
        name: trimmedName,
        date: date.trim() || undefined,
        start_time: startTime.trim() || undefined,
        expected_end_time: endTime.trim() || undefined,
        location_name: location.trim() || undefined,
        description: description.trim() || undefined,
      });
      Alert.alert('Saved', 'Event updated.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update event.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Edit event" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ThemedText style={{ color: colors.textSecondary }}>Loading…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Edit event" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Event name</ThemedText>
            <StagePassInput value={name} onChangeText={setName} placeholder="Event name" style={styles.input} />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Date (YYYY-MM-DD)</ThemedText>
            <StagePassInput value={date} onChangeText={setDate} placeholder="2026-03-15" style={styles.input} />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Start time</ThemedText>
            <StagePassInput value={startTime} onChangeText={setStartTime} placeholder="09:00" style={styles.input} />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>End time</ThemedText>
            <StagePassInput value={endTime} onChangeText={setEndTime} placeholder="17:00" style={styles.input} />
            <StagePassInput value={location} onChangeText={setLocation} placeholder="Location" style={styles.input} />
            <StagePassInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              multiline
              numberOfLines={3}
              style={styles.input}
            />
            <StagePassButton
              title={submitting ? 'Saving…' : 'Save changes'}
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
  scroll: { padding: Spacing.lg },
  card: { padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1 },
  label: { fontSize: 13, marginBottom: Spacing.xs, fontWeight: '600' },
  input: { marginBottom: Spacing.md },
  submitBtn: { marginTop: Spacing.sm, backgroundColor: themeYellow },
});
