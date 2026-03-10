/**
 * Admin/team leader: view checklist progress for an event.
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
import { api, type ChecklistProgressItem, type Event as EventType } from '~/services/api';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

export default function EventChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const eventId = id ? Number(id) : 0;
  const [event, setEvent] = useState<EventType | null>(null);
  const [progress, setProgress] = useState<ChecklistProgressItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [eventRes, progressRes] = await Promise.all([
        api.events.get(eventId),
        api.events.eventChecklistProgress(eventId).catch(() => ({ data: [] as ChecklistProgressItem[] })),
      ]);
      setEvent(eventRes);
      setProgress(Array.isArray(progressRes?.data) ? progressRes.data : []);
    } catch {
      Alert.alert('Error', 'Failed to load checklist progress.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalItems = progress.reduce((sum, p) => sum + p.total, 0);
  const completedItems = progress.reduce((sum, p) => sum + p.completed, 0);
  const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  if (loading || !event) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Checklist" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeYellow} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>Loading…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title={`Checklist: ${event.name}`} showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryIconWrap, { backgroundColor: themeYellow + '22' }]}>
              <Ionicons name="checkbox" size={28} color={themeYellow} />
            </View>
            <View style={styles.summaryText}>
              <ThemedText style={[styles.summaryTitle, { color: colors.text }]}>Overall progress</ThemedText>
              <ThemedText style={[styles.summaryMeta, { color: colors.textSecondary }]}>
                {completedItems} of {totalItems} items completed
              </ThemedText>
            </View>
            <ThemedText style={[styles.percent, { color: themeYellow }]}>{percent}%</ThemedText>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: themeYellow,
                  width: `${percent}%`,
                },
              ]}
            />
          </View>
        </View>

        {progress.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>
              No checklists for this event yet.
            </ThemedText>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Checklists</ThemedText>
            {progress.map((item, idx) => {
              const pct = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
              return (
                <View
                  key={item.checklist_id}
                  style={[styles.checklistRow, idx < progress.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                >
                  <View style={styles.checklistInfo}>
                    <ThemedText style={[styles.checklistLabel, { color: colors.text }]}>
                      Checklist #{item.checklist_id}
                    </ThemedText>
                    <ThemedText style={[styles.checklistMeta, { color: colors.textSecondary }]}>
                      {item.completed}/{item.total} items
                    </ThemedText>
                  </View>
                  <View style={[styles.miniBar, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.miniFill,
                        { backgroundColor: pct === 100 ? themeYellow : themeBlue, width: `${pct}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <ThemedText style={[styles.backBtnText, { color: themeBlue }]}>Back to event</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: 15 },
  scroll: { padding: Spacing.lg },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  summaryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryText: { flex: 1 },
  summaryTitle: { fontSize: 17, fontWeight: '700' },
  summaryMeta: { fontSize: 13, marginTop: 2 },
  percent: { fontSize: 20, fontWeight: '800' },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: Spacing.md },
  empty: { fontSize: 14 },
  checklistRow: {
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  checklistInfo: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  checklistLabel: { fontSize: 15, fontWeight: '600' },
  checklistMeta: { fontSize: 13 },
  miniBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  miniFill: {
    height: '100%',
    borderRadius: 2,
  },
  backBtn: { alignSelf: 'center', paddingVertical: Spacing.md },
  backBtnText: { fontSize: 16, fontWeight: '600' },
});
