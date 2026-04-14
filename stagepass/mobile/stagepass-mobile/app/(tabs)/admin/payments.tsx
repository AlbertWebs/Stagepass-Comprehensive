import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, type EarnedAllowanceEventGroup } from '~/services/api';

export default function AdminPaymentsScreen() {
  const { colors } = useStagePassTheme();
  const [segment, setSegment] = useState<'payments' | 'history' | 'pending' | 'allowances'>('allowances');
  const [allowances, setAllowances] = useState<EarnedAllowanceEventGroup[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (segment !== 'allowances') return;
    api.payments.earnedAllowances({ per_page: 50 }).then((r) => setAllowances(r.data ?? [])).catch(() => setAllowances([]));
  }, [segment]);

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Payments" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.segmentRow}>
          {[
            ['payments', 'Payments'],
            ['history', 'History'],
            ['pending', 'Pending'],
            ['allowances', 'Earned Allowances'],
          ].map(([id, label]) => (
            <Pressable key={id} style={[styles.segmentBtn, segment === id && styles.segmentBtnActive]} onPress={() => setSegment(id as typeof segment)}>
              <ThemedText style={[styles.segmentText, segment === id && styles.segmentTextActive]}>{label}</ThemedText>
            </Pressable>
          ))}
        </View>
        {segment !== 'allowances' ? (
          <ThemedText style={{ color: colors.textSecondary }}>This segment is available in Web Admin.</ThemedText>
        ) : allowances.length === 0 ? (
          <ThemedText style={{ color: colors.textSecondary }}>No earned allowances found.</ThemedText>
        ) : (
          allowances.map((g) => (
            <View key={g.event_id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable onPress={() => setExpanded(expanded === g.event_id ? null : g.event_id)}>
                <ThemedText style={[styles.eventTitle, { color: colors.text }]}>{g.event_name}</ThemedText>
                <ThemedText style={{ color: colors.textSecondary }}>
                  {g.event_date ?? '—'} · Team Lead: {g.team_lead ?? '—'} · Crew: {g.crew_count}
                </ThemedText>
                <ThemedText style={{ color: themeBlue, marginTop: 4 }}>
                  Total: KSh {g.total_allowances.toFixed(2)} · P:{g.status_breakdown.pending} A:{g.status_breakdown.approved} Pd:{g.status_breakdown.paid}
                </ThemedText>
              </Pressable>
              {expanded === g.event_id && (
                <View style={styles.detailsWrap}>
                  {g.details.map((d) => (
                    <View key={d.id} style={styles.detailRow}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={{ color: colors.text, fontWeight: '600' }}>{d.crew_name}</ThemedText>
                        <ThemedText style={{ color: colors.textSecondary }}>{d.allowance_type} · {d.description || 'No description'}</ThemedText>
                      </View>
                      <ThemedText style={{ color: themeYellow, fontWeight: '700' }}>KSh {Number(d.amount).toFixed(2)}</ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segmentBtn: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 6 },
  segmentBtnActive: { backgroundColor: themeBlue, borderColor: themeBlue },
  segmentText: { fontSize: 12, color: '#334155' },
  segmentTextActive: { color: '#fff' },
  card: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  eventTitle: { fontSize: 16, fontWeight: '700' },
  detailsWrap: { marginTop: Spacing.sm, gap: Spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});