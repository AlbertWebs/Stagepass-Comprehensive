/**
 * Admin/team leader: view checklist progress for an event.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGlobalSearchParams, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  const localParams = useLocalSearchParams<{ id?: string }>();
  const globalParams = useGlobalSearchParams<{ id?: string }>();
  const id = typeof localParams.id === 'string' ? localParams.id : typeof globalParams.id === 'string' ? globalParams.id : undefined;
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const eventId = id ? Number(id) : 0;
  const [event, setEvent] = useState<EventType | null>(null);
  const [progress, setProgress] = useState<ChecklistProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId || Number.isNaN(eventId)) {
      setLoadError('Invalid event.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const eventRes = await api.events.get(eventId);
      const eventData =
        eventRes && typeof (eventRes as Record<string, unknown>).data === 'object' && (eventRes as Record<string, unknown>).data != null
          ? ((eventRes as Record<string, unknown>).data as EventType)
          : (eventRes as EventType);
      setEvent(eventData);
      const progressRes = await api.events.eventChecklistProgress(eventId).catch(() => ({ data: [] as ChecklistProgressItem[] }));
      setProgress(Array.isArray(progressRes?.data) ? progressRes.data : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Request failed';
      setLoadError(message.includes('404') ? 'Event not found.' : message);
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

  if (loading && !event && !loadError) {
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

  if (loadError || !event) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Checklist" showBack />
        <View style={[styles.centered, styles.errorWrap]}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <ThemedText style={[styles.errorText, { color: colors.text }]}>{loadError ?? 'Event not found.'}</ThemedText>
          <Pressable
            onPress={() => loadData()}
            style={({ pressed }) => [styles.retryBtn, { backgroundColor: themeBlue }, pressed && { opacity: 0.8 }]}
          >
            <ThemedText style={styles.retryBtnText}>Retry</ThemedText>
          </Pressable>
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
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Checklists</ThemedText>
            </View>
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
          <ThemedText style={[styles.backBtnText, { color: colors.brandText }]}>Back to event</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { fontSize: 15 },
  errorWrap: { padding: Spacing.xl },
  errorText: { fontSize: 16, textAlign: 'center' },
  retryBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  retryBtnText: { fontSize: 16, fontWeight: '600', color: themeYellow },
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionTitleAccent: { width: 3, height: 16, borderRadius: 0 },
  sectionTitle: { fontSize: 17, fontWeight: '700', flex: 1 },
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
