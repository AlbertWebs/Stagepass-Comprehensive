/**
 * Report builder: filters + Generate Report + result view + Export (printable HTML).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/AppHeader';
import { StagePassInput } from '@/components/StagePassInput';
import { StagePassButton } from '@/components/StagePassButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import {
  api,
  type ReportFilters,
  type ReportType,
  type ReportEventsResponse,
  type ReportCrewAttendanceResponse,
  type ReportCrewPaymentsResponse,
  type ReportTasksResponse,
  type ReportFinancialResponse,
} from '~/services/api';

const U = { sm: 8, md: 12, lg: 16, xl: 20 };
const CARD_RADIUS = 12;

const TYPE_LABELS: Record<ReportType, string> = {
  events: 'Event report',
  'crew-attendance': 'Crew attendance',
  'crew-payments': 'Crew payments',
  tasks: 'Task report',
  financial: 'Financial summary',
};

function getDefaultDateRange(): { date_from: string; date_to: string } {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: today.toISOString().slice(0, 10),
  };
}

export default function AdminReportBuilderScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useStagePassTheme();
  const reportType = (type || 'events') as ReportType;

  const defaultRange = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.date_from);
  const [dateTo, setDateTo] = useState(defaultRange.date_to);
  const [eventId, setEventId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<
    | ReportEventsResponse
    | ReportCrewAttendanceResponse
    | ReportCrewPaymentsResponse
    | ReportTasksResponse
    | ReportFinancialResponse
    | null
  >(null);
  const [events, setEvents] = useState<{ id: number; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    api.events.list({ per_page: 100 }).then((r) => {
      const data = (r as any)?.data ?? r;
      setEvents(Array.isArray(data) ? data.map((e: any) => ({ id: e.id, name: e.name })) : []);
    }).catch(() => setEvents([]));
    api.users.list().then((r) => {
      const data = (r as any)?.data ?? r;
      setUsers(Array.isArray(data) ? data.map((u: any) => ({ id: u.id, name: u.name })) : []);
    }).catch(() => setUsers([]));
  }, []);

  const buildFilters = useCallback((): ReportFilters => {
    const f: ReportFilters = { date_from: dateFrom, date_to: dateTo };
    if (eventId.trim()) f.event_id = parseInt(eventId, 10);
    if (userId.trim()) f.user_id = parseInt(userId, 10);
    return f;
  }, [dateFrom, dateTo, eventId, userId]);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const filters = buildFilters();
      switch (reportType) {
        case 'events':
          setResult(await api.reports.events(filters));
          break;
        case 'crew-attendance':
          setResult(await api.reports.crewAttendance(filters));
          break;
        case 'crew-payments':
          setResult(await api.reports.crewPayments(filters));
          break;
        case 'tasks':
          setResult(await api.reports.tasks(filters));
          break;
        case 'financial':
          setResult(await api.reports.financial(filters));
          break;
        default:
          setResult(await api.reports.events(filters));
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  }, [reportType, buildFilters]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { html } = await api.reports.exportHtml(reportType, buildFilters());
      const dataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
      try {
        await Linking.openURL(dataUri);
      } catch {
        Alert.alert(
          'Export report',
          'For PDF export, use the Web Admin Dashboard → Reports with the same date range and filters. The report summary is shown above.',
          [{ text: 'OK' }]
        );
      }
    } catch (e) {
      Alert.alert(
        'Export report',
        'For PDF export, use the Web Admin Dashboard → Reports. The report summary is shown above.',
        [{ text: 'OK' }]
      );
    } finally {
      setExporting(false);
    }
  }, [reportType, buildFilters]);

  const title = TYPE_LABELS[reportType] ?? 'Report';
  const bottomPad = insets.bottom + Spacing.xl;

  return (
    <ThemedView style={styles.container}>
      <AppHeader title={title} showBack onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Filters</ThemedText>
          <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Date from</ThemedText>
          <StagePassInput value={dateFrom} onChangeText={setDateFrom} placeholder="YYYY-MM-DD" style={styles.input} />
          <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Date to</ThemedText>
          <StagePassInput value={dateTo} onChangeText={setDateTo} placeholder="YYYY-MM-DD" style={styles.input} />
          <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Event (optional)</ThemedText>
          <StagePassInput
            value={eventId}
            onChangeText={setEventId}
            placeholder="Event ID or leave blank"
            keyboardType="number-pad"
            style={styles.input}
          />
          <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Crew member (optional)</ThemedText>
          <StagePassInput
            value={userId}
            onChangeText={setUserId}
            placeholder="User ID or leave blank"
            keyboardType="number-pad"
            style={styles.input}
          />
          <StagePassButton
            title={loading ? 'Generating…' : 'Generate report'}
            onPress={generateReport}
            loading={loading}
            disabled={loading}
            style={styles.generateBtn}
          />
        </View>

        {result && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: U.lg }]}>
            <View style={styles.resultHeader}>
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Results</ThemedText>
              <StagePassButton
                title={exporting ? 'Preparing…' : 'Export / Print'}
                onPress={handleExport}
                loading={exporting}
                disabled={exporting}
                variant="outline"
              />
            </View>
            <ReportSummary type={reportType} result={result} colors={colors} />
            {(result as any).data?.length > 0 && (
              <ThemedText style={[styles.tableHint, { color: colors.textSecondary }]}>
                {(result as any).data.length} row(s). Export to see full table.
              </ThemedText>
            )}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function ReportSummary({
  type,
  result,
  colors,
}: {
  type: ReportType;
  result: ReportEventsResponse | ReportCrewAttendanceResponse | ReportCrewPaymentsResponse | ReportTasksResponse | ReportFinancialResponse;
  colors: Record<string, string>;
}) {
  const summary = (result as any).summary || {};
  const rows: { label: string; value: string | number }[] = [];

  if (type === 'events') {
    rows.push({ label: 'Total events', value: summary.total_events ?? 0 });
    Object.entries(summary.by_status || {}).forEach(([k, v]) => rows.push({ label: k, value: String(v) }));
  }
  if (type === 'crew-attendance') {
    rows.push({ label: 'Total check-ins', value: summary.total_checkins ?? 0 });
    rows.push({ label: 'Missed check-ins', value: summary.missed_checkins ?? 0 });
    rows.push({ label: 'Participation rate', value: (summary.participation_rate ?? 0) + '%' });
    rows.push({ label: 'Total hours', value: summary.total_hours ?? 0 });
  }
  if (type === 'crew-payments') {
    rows.push({ label: 'Total count', value: summary.total_count ?? 0 });
    rows.push({ label: 'Pending total', value: summary.pending_total ?? 0 });
    rows.push({ label: 'Approved total', value: summary.approved_total ?? 0 });
    rows.push({ label: 'Grand total', value: summary.grand_total ?? 0 });
  }
  if (type === 'tasks') {
    rows.push({ label: 'Total', value: summary.total ?? 0 });
    rows.push({ label: 'Pending', value: summary.pending ?? 0 });
    rows.push({ label: 'In progress', value: summary.in_progress ?? 0 });
    rows.push({ label: 'Completed', value: summary.completed ?? 0 });
  }
  if (type === 'financial') {
    rows.push({ label: 'Total payments', value: summary.total_payments ?? 0 });
    rows.push({ label: 'Total amount', value: summary.total_amount ?? 0 });
  }

  return (
    <View style={styles.summaryGrid}>
      {rows.map((r) => (
        <View key={r.label} style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
          <ThemedText style={[styles.summaryLabel, { color: colors.textSecondary }]}>{r.label}</ThemedText>
          <ThemedText style={[styles.summaryValue, { color: colors.text }]}>{r.value}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.lg },
  card: { padding: U.xl, borderRadius: CARD_RADIUS, borderWidth: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: U.lg },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  input: { marginBottom: U.md },
  generateBtn: { marginTop: U.md },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: U.md, marginBottom: U.lg },
  summaryGrid: { marginTop: U.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: U.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  tableHint: { fontSize: 12, marginTop: U.md },
});
