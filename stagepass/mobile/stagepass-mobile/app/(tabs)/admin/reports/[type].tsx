/**
 * Report builder: filters + Generate Report + result view + Export (printable HTML).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
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
  type ReportEndOfDayResponse,
} from '~/services/api';

const U = { sm: 8, md: 12, lg: 16, xl: 20 };
const CARD_RADIUS = 12;

const TYPE_LABELS: Record<ReportType, string> = {
  events: 'Event report',
  'crew-attendance': 'Crew attendance',
  'crew-payments': 'Crew payments',
  tasks: 'Task report',
  financial: 'Financial summary',
  'end-of-day': 'End-of-day signed report',
};

function getDefaultDateRange(): { date_from: string; date_to: string } {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: today.toISOString().slice(0, 10),
  };
}

function parseDateInput(value: string): Date {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [eventId, setEventId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmedBy, setConfirmedBy] = useState('');
  const [signature, setSignature] = useState('');
  const [result, setResult] = useState<
    | ReportEventsResponse
    | ReportCrewAttendanceResponse
    | ReportCrewPaymentsResponse
    | ReportTasksResponse
    | ReportFinancialResponse
    | ReportEndOfDayResponse
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
    if (reportType === 'end-of-day') {
      if (confirmedBy.trim()) f.confirmed_by = confirmedBy.trim();
      if (signature.trim()) f.signature = signature.trim();
    }
    return f;
  }, [dateFrom, dateTo, eventId, userId, reportType, confirmedBy, signature]);

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
        case 'end-of-day':
          setResult(await api.reports.endOfDay(filters));
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
  const onFromDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowFromPicker(false);
    if (!selectedDate) return;
    setDateFrom(formatDateInput(selectedDate));
  };
  const onToDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowToPicker(false);
    if (!selectedDate) return;
    setDateTo(formatDateInput(selectedDate));
  };

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
          <Pressable
            onPress={() => setShowFromPicker(true)}
            style={({ pressed }) => [
              styles.dateField,
              { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <ThemedText style={[styles.dateFieldValue, { color: colors.text }]}>{dateFrom}</ThemedText>
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          {showFromPicker ? (
            <DateTimePicker
              value={parseDateInput(dateFrom)}
              mode="date"
              display="default"
              onChange={onFromDateChange}
              maximumDate={parseDateInput(dateTo)}
            />
          ) : null}
          <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Date to</ThemedText>
          <Pressable
            onPress={() => setShowToPicker(true)}
            style={({ pressed }) => [
              styles.dateField,
              { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <ThemedText style={[styles.dateFieldValue, { color: colors.text }]}>{dateTo}</ThemedText>
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          {showToPicker ? (
            <DateTimePicker
              value={parseDateInput(dateTo)}
              mode="date"
              display="default"
              onChange={onToDateChange}
              minimumDate={parseDateInput(dateFrom)}
            />
          ) : null}
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
          {reportType === 'end-of-day' ? (
            <>
              <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Confirmed by (name)</ThemedText>
              <StagePassInput
                value={confirmedBy}
                onChangeText={setConfirmedBy}
                placeholder="Team leader / admin name"
                style={styles.input}
              />
              <ThemedText style={[styles.label, { color: colors.textSecondary }]}>Signature</ThemedText>
              <StagePassInput
                value={signature}
                onChangeText={setSignature}
                placeholder="Type name/signature"
                style={styles.input}
              />
            </>
          ) : null}
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
  result:
    | ReportEventsResponse
    | ReportCrewAttendanceResponse
    | ReportCrewPaymentsResponse
    | ReportTasksResponse
    | ReportFinancialResponse
    | ReportEndOfDayResponse;
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
  if (type === 'end-of-day') {
    rows.push({ label: 'Events', value: summary.events_count ?? 0 });
    rows.push({ label: 'Crew allowances', value: summary.crew_allowances_total ?? 0 });
    rows.push({ label: 'Other expenses', value: summary.other_expenses_total ?? 0 });
    rows.push({ label: 'Grand total', value: summary.grand_total ?? 0 });
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
  dateField: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: U.md,
    marginBottom: U.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateFieldValue: { fontSize: 15, fontWeight: '600' },
  input: { marginBottom: U.md },
  generateBtn: { marginTop: U.md },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: U.md, marginBottom: U.lg },
  summaryGrid: { marginTop: U.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: U.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  tableHint: { fontSize: 12, marginTop: U.md },
});
