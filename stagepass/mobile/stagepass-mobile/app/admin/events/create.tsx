/**
 * Admin: create event form.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api } from '~/services/api';

export default function AdminCreateEventScreen() {
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Required', 'Event name is required.');
      return;
    }
    if (!date.trim()) {
      Alert.alert('Required', 'Date is required (YYYY-MM-DD).');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.events.create({
        name: trimmedName,
        date: date.trim(),
        start_time: startTime.trim() || undefined,
        expected_end_time: endTime.trim() || undefined,
        location_name: location.trim() || undefined,
        description: description.trim() || undefined,
        status: 'scheduled',
      });
      Alert.alert('Created', 'Event created successfully.', [
        { text: 'OK', onPress: () => router.replace(`/admin/events`) },
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create event.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Create event" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Event name</ThemedText>
            <StagePassInput value={name} onChangeText={setName} placeholder="Event name" style={styles.input} />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Date (YYYY-MM-DD)</ThemedText>
            <StagePassInput value={date} onChangeText={setDate} placeholder="2026-03-15" style={styles.input} />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Start time (HH:MM)</ThemedText>
            <StagePassInput value={startTime} onChangeText={setStartTime} placeholder="09:00" style={styles.input} />
            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>End time (HH:MM)</ThemedText>
            <StagePassInput value={endTime} onChangeText={setEndTime} placeholder="17:00" style={styles.input} />
            <StagePassInput value={location} onChangeText={setLocation} placeholder="Location" style={styles.input} />
            <StagePassInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              multiline
              numberOfLines={3}
              style={styles.input}
            />
            <StagePassButton
              title={submitting ? 'Creating…' : 'Create event'}
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
