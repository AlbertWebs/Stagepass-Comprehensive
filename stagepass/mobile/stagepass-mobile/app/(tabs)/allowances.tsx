/**
 * Allowances – approved payments and today’s daily allowance for crew/team leaders.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { HomeHeader } from '@/components/HomeHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { themeBlue, themeYellow, StatusColors } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useAppRole } from '~/hooks/useAppRole';
import { api, type EarnedAllowanceDetail, type Event as EventType, type Payment } from '~/services/api';

const U = { sm: 8, md: 12, lg: 16, xl: 20, section: 24 };
const CARD_RADIUS = 16;
const TAB_BAR_HEIGHT = 58;

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isEventToday(event: EventType, today: string): boolean {
  const dateStr = typeof event.date === 'string' ? event.date.trim().slice(0, 10) : '';
  return dateStr === today;
}

export default function AllowancesScreen() {
  const router = useRouter();
  const role = useAppRole();
  const currentUserId = useSelector((s: { auth: { user: { id?: number } | null } }) => s.auth.user?.id ?? null);
  const { colors, isDark } = useStagePassTheme();
  const [animateKey, setAnimateKey] = useState(0);
  const [approvedAllowances, setApprovedAllowances] = useState<Payment[]>([]);
  const [allowanceToday, setAllowanceToday] = useState<number | null>(null);
  const [allocatedAllowances, setAllocatedAllowances] = useState<Array<EarnedAllowanceDetail & { event_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { setAnimateKey((k) => k + 1); }, []));
  const cardBg = isDark ? '#1E212A' : '#F5F7FC';
  const iconColor = isDark ? themeYellow : themeBlue;

  const load = useCallback(async () => {
    try {
      const today = todayDateString();
      const [paymentsRes, eventsRes] = await Promise.all([
        api.payments.list({ status: 'approved', per_page: 50 }),
        api.events.list({ per_page: 100 }),
      ]);
      const list = Array.isArray(paymentsRes?.data) ? paymentsRes.data : [];
      setApprovedAllowances(list);

      const events = Array.isArray(eventsRes?.data) ? eventsRes.data : [];
      const todayEvent = events.find((e) => isEventToday(e, today));
      if (todayEvent?.daily_allowance != null) {
        setAllowanceToday(Number(todayEvent.daily_allowance));
      } else if (todayEvent) {
        const full = await api.events.get(todayEvent.id);
        setAllowanceToday(full?.daily_allowance != null ? Number(full.daily_allowance) : null);
      } else {
        setAllowanceToday(null);
      }

      const earnedRes = await api.payments.earnedAllowances({ per_page: 100 });
      const groups = Array.isArray(earnedRes?.data) ? earnedRes.data : [];
      const flattened = groups.flatMap((group) =>
        (group.details ?? []).map((detail) => ({
          ...detail,
          event_name: group.event_name,
        }))
      );
      const mine = flattened
        .filter((d) => currentUserId == null || d.crew_id === currentUserId)
        .sort((a, b) => {
          const at = a.recorded_at ? new Date(a.recorded_at).getTime() : 0;
          const bt = b.recorded_at ? new Date(b.recorded_at).getTime() : 0;
          return bt - at;
        });
      setAllocatedAllowances(mine);
    } catch {
      setApprovedAllowances([]);
      setAllowanceToday(null);
      setAllocatedAllowances([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    load();
  }, [load]);

  if (role !== 'crew' && role !== 'team_leader') {
    return (
      <ThemedView style={styles.container}>
        <HomeHeader title="Allowances" showBack onBack={() => router.back()} />
        <Animated.View key={animateKey} entering={SlideInRight.duration(320)} style={{ flex: 1 }}>
        <View style={styles.centered}>
          <ThemedText style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            Allowances are available for crew and team leaders.
          </ThemedText>
        </View>
        </Animated.View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="Allowances" showBack onBack={() => router.back()} />
      <Animated.View key={animateKey} entering={SlideInRight.duration(320)} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + U.section }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={iconColor}
          />
        }
      >
        <View style={styles.section}>
          <View style={[styles.sectionTitleRow, { marginBottom: U.lg }]}>
            <View style={[styles.accent, { backgroundColor: iconColor }]} />
            <View style={[styles.iconWrap, { backgroundColor: iconColor + '28' }]}>
              <Ionicons name="wallet-outline" size={14} color={iconColor} />
            </View>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Daily allowance</ThemedText>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: cardBg, borderColor: colors.border }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: iconColor + '18', borderColor: iconColor + '35' }]}>
              <Ionicons name="wallet-outline" size={22} color={iconColor} />
            </View>
            <ThemedText style={[styles.summaryValue, { color: colors.text }]}>
              {allowanceToday != null ? `KES ${Number(allowanceToday).toLocaleString()}` : '—'}
            </ThemedText>
            <ThemedText style={[styles.summaryLabel, { color: colors.textSecondary }]}>Today&apos;s rate</ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.sectionTitleRow, styles.approvedSectionTitleRow]}>
            <View style={[styles.accent, { backgroundColor: themeYellow }]} />
            <View style={[styles.iconWrap, { backgroundColor: themeYellow + '28' }]}>
              <Ionicons name="cash-outline" size={14} color={themeYellow} />
            </View>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Allocated allowances</ThemedText>
          </View>
          {allocatedAllowances.length === 0 ? (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
              <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                No allowance allocations yet. Once admin allocates, they will show here.
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
              {allocatedAllowances.map((a) => (
                <View key={a.id} style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: a.status === 'paid' ? StatusColors.checkedIn : themeYellow }]} />
                  <View style={styles.rowContent}>
                    <ThemedText style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                      {a.allowance_type} · {a.event_name}
                    </ThemedText>
                    <ThemedText style={[styles.rowSub, { color: colors.textSecondary }]}>
                      KES {Number(a.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })} · {a.status}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={[styles.sectionTitleRow, styles.approvedSectionTitleRow]}>
            <View style={[styles.accent, { backgroundColor: StatusColors.checkedIn }]} />
            <View style={[styles.iconWrap, { backgroundColor: StatusColors.checkedIn + '28' }]}>
              <Ionicons name="checkmark-done" size={14} color={StatusColors.checkedIn} />
            </View>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Approved allowances</ThemedText>
          </View>
          {approvedAllowances.length === 0 ? (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
              <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                No approved allowances yet. Approved payments will appear here.
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
              {approvedAllowances.map((p) => {
                const eventName = p.event?.name ?? 'Event';
                const amount = Number(p.total_amount);
                const purpose = p.purpose ?? '';
                const dateStr = p.payment_date
                  ? new Date(String(p.payment_date)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : '';
                return (
                  <View key={p.id} style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: StatusColors.checkedIn }]} />
                    <View style={styles.rowContent}>
                      <ThemedText style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                        {eventName}{purpose ? ` · ${purpose}` : ''}
                      </ThemedText>
                      <ThemedText style={[styles.rowSub, { color: colors.textSecondary }]}>
                        KES {amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                        {dateStr ? ` · ${dateStr}` : ''}
                      </ThemedText>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: U.lg, paddingTop: U.section },
  section: { marginBottom: U.section },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: U.sm,
  },
  approvedSectionTitleRow: {
    marginBottom: U.md,
  },
  accent: { width: 3, height: 16, borderRadius: 0 },
  iconWrap: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', flex: 1 },
  summaryCard: {
    padding: U.xl,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 100,
  },
  summaryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: U.sm,
  },
  summaryValue: { fontSize: 19, fontWeight: '800' },
  summaryLabel: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    padding: U.xl,
  },
  emptyText: { fontSize: 14, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: U.md, marginBottom: U.sm },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  rowSub: { fontSize: 13, marginBottom: 4 },
  centered: { flex: 1, justifyContent: 'center', padding: U.xl },
  emptyTitle: { fontSize: 15, textAlign: 'center' },
});
