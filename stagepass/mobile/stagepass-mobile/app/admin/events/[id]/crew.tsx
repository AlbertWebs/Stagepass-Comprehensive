/**
 * Admin: assign crew to event. Multi-select users and save.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { StagePassButton } from '@/components/StagePassButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, type Event, type User } from '~/services/api';

export default function AdminEventCrewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useStagePassTheme();
  const [event, setEvent] = useState<Event | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [eventRes, usersRes] = await Promise.all([
        api.events.get(Number(id)),
        api.users.list(),
      ]);
      setEvent(eventRes);
      const list = Array.isArray(usersRes?.data) ? usersRes.data : [];
      setUsers(list);
      const assigned = new Set((eventRes.crew ?? []).map((c) => c.id));
      setSelectedIds(assigned);
    } catch {
      setEvent(null);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (userId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.eventAssignCrew(Number(id), Array.from(selectedIds));
      Alert.alert('Saved', 'Crew assignment updated.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save assignment.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !event) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Crew" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeBlue} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title={`Crew: ${event.name}`} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
          Tap to assign or unassign crew to this event.
        </ThemedText>
        {users.map((u) => {
          const selected = selectedIds.has(u.id);
          return (
            <Pressable
              key={u.id}
              onPress={() => toggle(u.id)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
                selected && { borderColor: themeYellow, backgroundColor: themeYellow + '14' },
              ]}
            >
              <View style={styles.rowContent}>
                <ThemedText style={[styles.name, { color: colors.text }]}>{u.name}</ThemedText>
                <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
                  {u.email} {u.roles?.length ? `· ${u.roles.map((r) => r.name).join(', ')}` : ''}
                </ThemedText>
              </View>
              {selected ? (
                <Ionicons name="checkmark-circle" size={24} color={themeYellow} />
              ) : (
                <Ionicons name="ellipse-outline" size={24} color={colors.textSecondary} />
              )}
            </Pressable>
          );
        })}
        <StagePassButton
          title={saving ? 'Saving…' : 'Save assignment'}
          onPress={handleSave}
          disabled={saving}
          style={styles.saveBtn}
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.lg },
  hint: { marginBottom: Spacing.lg, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    marginBottom: Spacing.sm,
  },
  rowContent: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  meta: { fontSize: 13 },
  saveBtn: { marginTop: Spacing.xl, backgroundColor: themeYellow },
});
