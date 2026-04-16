import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, type Event, type ReportEndOfDayResponse } from '~/services/api';

function formatAmount(value: number | undefined): string {
  return `KES ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatEventDateTime(event: Event | null): string {
  if (!event) return '';
  const parts = [event.date];
  if (event.start_time) parts.push(event.start_time.slice(0, 5));
  if (event.expected_end_time) parts.push(`- ${event.expected_end_time.slice(0, 5)}`);
  return parts.join(' ');
}

export default function EventReportPreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const eventId = Number(id || 0);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [event, setEvent] = useState<Event | null>(null);
  const [report, setReport] = useState<ReportEndOfDayResponse | null>(null);
  const [confirmedBy, setConfirmedBy] = useState('');
  const [signature, setSignature] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!eventId) {
        setLoading(false);
        return;
      }
      try {
        const [eventRes, reportRes, meRes] = await Promise.allSettled([
          api.events.get(eventId),
          api.reports.endOfDay({ event_id: eventId }),
          api.auth.me(),
        ]);
        if (!alive) return;
        if (eventRes.status === 'fulfilled') {
          setEvent(eventRes.value);
        }
        if (reportRes.status === 'fulfilled') {
          setReport(reportRes.value);
        }
        if (meRes.status === 'fulfilled') {
          setConfirmedBy(meRes.value?.name ?? '');
        }
        if (eventRes.status === 'rejected' && reportRes.status === 'rejected') {
          Alert.alert('Error', 'Failed to load event report.');
        }
      } catch (e) {
        if (!alive) return;
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load event report.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [eventId]);

  const reportRow = useMemo(() => {
    return report?.data?.find((r) => r.event_id === eventId) ?? null;
  }, [report, eventId]);

  const openPrintablePreview = async () => {
    setExporting(true);
    try {
      const { html } = await api.reports.exportHtml('end-of-day', {
        event_id: eventId,
        confirmed_by: confirmedBy.trim(),
        signature: signature.trim(),
      });
      const dataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
      await Linking.openURL(dataUri);
    } catch {
      Alert.alert('Preview unavailable', 'Could not open printable preview on this device.');
    } finally {
      setExporting(false);
    }
  };

  const useForEndEvent = () => {
    if (!acknowledged) {
      Alert.alert('Confirm details', 'Please confirm that you reviewed event details and allowances.');
      return;
    }
    if (!confirmedBy.trim() || !signature.trim()) {
      Alert.alert('Signature required', 'Enter confirmed by and signature before continuing.');
      return;
    }
    router.replace({
      pathname: '/(tabs)/admin/events/[id]/operations',
      params: {
        id: String(eventId),
        report_ready: '1',
        report_confirmed_by: confirmedBy.trim(),
        report_signature: signature.trim(),
      },
    });
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Event report" showBack onBack={() => router.back()} />
        <View style={styles.centered}>
          <ThemedText style={{ color: colors.textSecondary }}>Loading report...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Event report" showBack onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Basic event details</ThemedText>
          <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>Name: {event?.name || reportRow?.event_name || '—'}</ThemedText>
          <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
            Date and time: {formatEventDateTime(event) || reportRow?.date || '—'}
          </ThemedText>
          <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>Location: {event?.location_name || '—'}</ThemedText>
          <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>Team leader: {event?.team_leader?.name || event?.teamLeader?.name || '—'}</ThemedText>
          <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>Status: {event?.status || '—'}</ThemedText>
          <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>Important detail: {event?.description || 'No extra event notes.'}</ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Allowances and totals</ThemedText>
          <View style={[styles.kpiRow, { borderBottomColor: colors.border }]}>
            <ThemedText style={{ color: colors.textSecondary }}>Crew allowances</ThemedText>
            <ThemedText style={[styles.kpiValue, { color: colors.text }]}>
              {formatAmount(reportRow?.crew_allowances ?? report?.summary?.crew_allowances_total)}
            </ThemedText>
          </View>
          <View style={[styles.kpiRow, { borderBottomColor: colors.border }]}>
            <ThemedText style={{ color: colors.textSecondary }}>Other expenses</ThemedText>
            <ThemedText style={[styles.kpiValue, { color: colors.text }]}>
              {formatAmount(reportRow?.other_expenses ?? report?.summary?.other_expenses_total)}
            </ThemedText>
          </View>
          <View style={styles.kpiRow}>
            <ThemedText style={{ color: colors.textSecondary }}>Grand total</ThemedText>
            <ThemedText style={[styles.kpiValue, { color: colors.text }]}>
              {formatAmount(reportRow?.total ?? report?.summary?.grand_total)}
            </ThemedText>
          </View>
          <StagePassButton
            title={exporting ? 'Opening preview...' : 'Open printable preview'}
            onPress={openPrintablePreview}
            disabled={exporting}
            variant="outline"
            style={styles.previewBtn}
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Sign report</ThemedText>
          <StagePassInput
            value={confirmedBy}
            onChangeText={setConfirmedBy}
            placeholder="Confirmed by"
            style={styles.input}
          />
          <StagePassInput
            value={signature}
            onChangeText={setSignature}
            placeholder="Signature (type full name)"
            style={styles.input}
          />
          <Pressable
            onPress={() => setAcknowledged((v) => !v)}
            style={({ pressed }) => [
              styles.checkboxRow,
              { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={[styles.checkbox, { borderColor: themeBlue, backgroundColor: acknowledged ? themeBlue : 'transparent' }]}>
              {acknowledged ? <Ionicons name="checkmark" size={14} color={themeYellow} /> : null}
            </View>
            <ThemedText style={{ color: colors.textSecondary, flex: 1 }}>
              I confirm this report includes event details, allowances, and important notes.
            </ThemedText>
          </Pressable>
          <StagePassButton title="Use report for end event" onPress={useForEndEvent} style={styles.submitBtn} />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: Spacing.sm },
  meta: { fontSize: 14, marginBottom: 6 },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  kpiValue: { fontSize: 14, fontWeight: '700' },
  previewBtn: { marginTop: Spacing.md },
  input: { marginBottom: Spacing.md },
  checkboxRow: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: { marginTop: Spacing.md },
});
