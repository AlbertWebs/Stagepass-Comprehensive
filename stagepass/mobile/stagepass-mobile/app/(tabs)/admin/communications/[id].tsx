import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, StatusColors, themeBlue } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, type Communication } from '~/services/api';

function scopeLabel(scope?: string): string {
  if (scope === 'event_crew') return 'Event crew';
  if (scope === 'crew') return 'Crew';
  if (scope === 'all_staff') return 'All staff';
  return '—';
}

export default function AdminCommunicationDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useStagePassTheme();
  const [item, setItem] = useState<Communication | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.communications.get(Number(id));
      setItem(res ?? null);
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const sentAt = useMemo(() => {
    const raw = item?.sent_at ?? item?.created_at;
    if (!raw) return '—';
    try {
      return new Date(raw).toLocaleString();
    } catch {
      return String(raw);
    }
  }, [item?.sent_at, item?.created_at]);

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Notice details" showBack onBack={() => router.back()} />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeBlue} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={themeBlue} />}
        >
          {!item ? (
            <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>Notice not found.</ThemedText>
          ) : (
            <>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ThemedText style={[styles.subject, { color: colors.text }]}>{item.subject ?? item.title ?? 'Message'}</ThemedText>
                <ThemedText style={[styles.body, { color: colors.textSecondary }]}>{item.body ?? '—'}</ThemedText>
              </View>

              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Row label="Sent date" value={sentAt} textColor={colors.text} labelColor={colors.textSecondary} />
                <Row label="Recipient scope" value={scopeLabel(item.recipient_scope)} textColor={colors.text} labelColor={colors.textSecondary} />
                <Row label="Event" value={item.event?.name ?? (item.event_id ? `Event #${item.event_id}` : '—')} textColor={colors.text} labelColor={colors.textSecondary} />
                <Row label="Recipients" value={String(item.recipient_count ?? item.recipients_status?.length ?? 0)} textColor={colors.text} labelColor={colors.textSecondary} />
                <Row label="Opened" value={String(item.opened_count ?? 0)} textColor={StatusColors.checkedIn} labelColor={colors.textSecondary} />
                <Row label="Not opened" value={String(item.unopened_count ?? 0)} textColor={colors.text} labelColor={colors.textSecondary} />
              </View>

              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ThemedText style={[styles.listTitle, { color: colors.text }]}>Recipients status</ThemedText>
                {(item.recipients_status?.length ?? 0) === 0 ? (
                  <ThemedText style={[styles.emptySmall, { color: colors.textSecondary }]}>
                    Open-status tracking is available for notices sent after this update.
                  </ThemedText>
                ) : (
                  item.recipients_status!.map((r) => (
                    <View key={r.user_id} style={[styles.recipientRow, { borderBottomColor: colors.border }]}>
                      <View style={styles.recipientMain}>
                        <ThemedText style={[styles.recipientName, { color: colors.text }]}>{r.name}</ThemedText>
                        <ThemedText style={[styles.recipientEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                          {r.email ?? '—'}
                        </ThemedText>
                      </View>
                      <View style={[styles.badge, { backgroundColor: r.opened ? StatusColors.checkedIn + '20' : colors.border }]}>
                        <ThemedText style={[styles.badgeText, { color: r.opened ? StatusColors.checkedIn : colors.textSecondary }]}>
                          {r.opened ? 'Opened' : 'Not opened'}
                        </ThemedText>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

function Row({
  label,
  value,
  textColor,
  labelColor,
}: {
  label: string;
  value: string;
  textColor: string;
  labelColor: string;
}) {
  return (
    <View style={styles.row}>
      <ThemedText style={[styles.rowLabel, { color: labelColor }]}>{label}</ThemedText>
      <ThemedText style={[styles.rowValue, { color: textColor }]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.md },
  card: { borderWidth: 1, borderRadius: 12, padding: Spacing.lg },
  subject: { fontSize: 18, fontWeight: '800', marginBottom: Spacing.sm },
  body: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  rowLabel: { fontSize: 13 },
  rowValue: { fontSize: 13, fontWeight: '700' },
  listTitle: { fontSize: 15, fontWeight: '800', marginBottom: Spacing.sm },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  recipientMain: { flex: 1, minWidth: 0 },
  recipientName: { fontSize: 14, fontWeight: '700' },
  recipientEmail: { fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  empty: { textAlign: 'center', paddingVertical: Spacing.xl, fontSize: 15 },
  emptySmall: { fontSize: 13 },
});
