/**
 * Allowances – approved payments and today’s daily allowance for crew/team leaders.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { HomeHeader } from '@/components/HomeHeader';
import { StagePassButton } from '@/components/StagePassButton';
import { StagePassInput } from '@/components/StagePassInput';
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
  const [eventsForAllocation, setEventsForAllocation] = useState<EventType[]>([]);
  const [allowanceTypes, setAllowanceTypes] = useState<Array<{ id: number; name: string }>>([]);
  const [eventCrew, setEventCrew] = useState<Array<{ id: number; name: string }>>([]);
  const [allocationModalVisible, setAllocationModalVisible] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [selectedCrewId, setSelectedCrewId] = useState<number | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
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
      const leaderEvents = events.filter(
        (e) =>
          (currentUserId != null && e.team_leader_id === currentUserId) ||
          e.team_leader?.id === currentUserId ||
          e.teamLeader?.id === currentUserId
      );
      setEventsForAllocation(leaderEvents);
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
      if (role === 'team_leader') {
        const typesRes = await api.payments.allowanceTypes();
        setAllowanceTypes(Array.isArray(typesRes?.data) ? typesRes.data.map((t) => ({ id: t.id, name: t.name })) : []);
      }
    } catch {
      setApprovedAllowances([]);
      setAllowanceToday(null);
      setAllocatedAllowances([]);
      setEventsForAllocation([]);
      setAllowanceTypes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId, role]);

  useEffect(() => {
    if (!selectedEventId || role !== 'team_leader') {
      setEventCrew([]);
      return;
    }
    api.events
      .get(selectedEventId)
      .then((e) => {
        const crew = Array.isArray(e?.crew) ? e.crew.map((c) => ({ id: c.id, name: c.name })) : [];
        setEventCrew(crew);
      })
      .catch(() => setEventCrew([]));
  }, [selectedEventId, role]);

  const resetAllocationForm = () => {
    setSelectedEventId(null);
    setSelectedCrewId(null);
    setSelectedTypeId(null);
    setAmount('');
    setDescription('');
    setEventCrew([]);
  };

  const submitAllocation = async () => {
    if (!selectedEventId || !selectedCrewId || !selectedTypeId) {
      Alert.alert('Missing details', 'Select event, crew member, and allowance type.');
      return;
    }
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber < 0) {
      Alert.alert('Invalid amount', 'Enter a valid allowance amount.');
      return;
    }
    setAllocating(true);
    try {
      await api.payments.addEarnedAllowance({
        event_id: selectedEventId,
        crew_id: selectedCrewId,
        allowance_type_id: selectedTypeId,
        amount: amountNumber,
        description: description.trim() || undefined,
      });
      setAllocationModalVisible(false);
      resetAllocationForm();
      await load();
      Alert.alert('Saved', 'Allowance allocated successfully.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to allocate allowance.');
    } finally {
      setAllocating(false);
    }
  };

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
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>My allowances</ThemedText>
          </View>
          {role === 'team_leader' ? (
            <StagePassButton
              title="Allocate allowance to crew"
              onPress={() => setAllocationModalVisible(true)}
              style={styles.allocateBtn}
            />
          ) : null}
          {allocatedAllowances.length === 0 ? (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
              <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                No allowance allocations yet. Once admin allocates, they will show here.
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
              {allocatedAllowances.map((a) => {
                const st = (a.status ?? '').toLowerCase();
                const dotColor =
                  st === 'rejected' ? '#c0392b' : st === 'approved' || st === 'paid' ? StatusColors.checkedIn : themeYellow;
                return (
                  <View key={a.id} style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: dotColor }]} />
                    <View style={styles.rowContent}>
                      <ThemedText style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                        {a.allowance_type} · {a.event_name ?? 'Event'}
                      </ThemedText>
                      <ThemedText style={[styles.rowSub, { color: colors.textSecondary }]}>
                        KES {Number(a.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })} · {a.status}
                        {a.recorded_at
                          ? ` · ${new Date(a.recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                          : ''}
                      </ThemedText>
                      {st === 'rejected' && a.rejection_comment ? (
                        <ThemedText style={[styles.rowSub, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={3}>
                          {a.rejection_comment}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>
                );
              })}
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

      <Modal visible={allocationModalVisible} transparent animationType="fade" onRequestClose={() => setAllocationModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>Allocate allowance</ThemedText>
            <ThemedText style={[styles.modalLabel, { color: colors.textSecondary }]}>Amount (KES)</ThemedText>
            <StagePassInput value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" style={styles.modalInput} />
            <ThemedText style={[styles.modalLabel, { color: colors.textSecondary }]}>Description (optional)</ThemedText>
            <StagePassInput value={description} onChangeText={setDescription} placeholder="Reason/details" style={styles.modalInput} />

            <ThemedText style={[styles.modalLabel, { color: colors.textSecondary }]}>Select event</ThemedText>
            <View style={styles.choiceWrap}>
              {eventsForAllocation.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => {
                    setSelectedEventId(e.id);
                    setSelectedCrewId(null);
                  }}
                  style={[styles.choiceChip, selectedEventId === e.id && styles.choiceChipActive]}
                >
                  <ThemedText style={[styles.choiceChipText, { color: selectedEventId === e.id ? themeBlue : colors.text }]} numberOfLines={1}>
                    {e.name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={[styles.modalLabel, { color: colors.textSecondary }]}>Select crew</ThemedText>
            <View style={styles.choiceWrap}>
              {eventCrew.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedCrewId(c.id)}
                  style={[styles.choiceChip, selectedCrewId === c.id && styles.choiceChipActive]}
                >
                  <ThemedText style={[styles.choiceChipText, { color: selectedCrewId === c.id ? themeBlue : colors.text }]} numberOfLines={1}>
                    {c.name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={[styles.modalLabel, { color: colors.textSecondary }]}>Allowance type</ThemedText>
            <View style={styles.choiceWrap}>
              {allowanceTypes.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setSelectedTypeId(t.id)}
                  style={[styles.choiceChip, selectedTypeId === t.id && styles.choiceChipActive]}
                >
                  <ThemedText style={[styles.choiceChipText, { color: selectedTypeId === t.id ? themeBlue : colors.text }]}>
                    {t.name}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <StagePassButton title="Cancel" variant="outline" onPress={() => { setAllocationModalVisible(false); resetAllocationForm(); }} style={styles.modalBtn} />
              <StagePassButton title={allocating ? 'Saving...' : 'Save'} onPress={submitAllocation} disabled={allocating} style={styles.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: U.lg, paddingTop: U.section },
  section: { marginBottom: U.section },
  allocateBtn: { marginBottom: U.md },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: U.lg,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    padding: U.lg,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: U.md },
  modalLabel: { fontSize: 13, fontWeight: '600', marginBottom: U.sm, marginTop: U.sm },
  modalInput: { marginBottom: U.sm },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: U.sm, marginBottom: U.sm },
  choiceChip: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    borderRadius: 999,
    paddingHorizontal: U.md,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  choiceChipActive: {
    borderColor: themeBlue,
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  choiceChipText: { fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: U.sm, marginTop: U.md },
  modalBtn: { flex: 1 },
});
