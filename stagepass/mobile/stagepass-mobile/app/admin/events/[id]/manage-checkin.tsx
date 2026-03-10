/**
 * Admin/team leader: manage check-in – view crew status and check in members on their behalf.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
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
import { api, type CrewStatusItem, type Event as EventType } from '~/services/api';
import { AppHeader } from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

export default function ManageCheckInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const eventId = id ? Number(id) : 0;
  const [event, setEvent] = useState<EventType | null>(null);
  const [crewStatus, setCrewStatus] = useState<CrewStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingInId, setCheckingInId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const eventRes = await api.events.get(eventId);
      setEvent(eventRes);
      try {
        const statusRes = await api.events.eventCrewStatus(eventId);
        setCrewStatus(Array.isArray(statusRes?.data) ? statusRes.data : []);
      } catch {
        // Backend may not have crew-status endpoint yet: build from event.crew
        const crew = eventRes?.crew ?? [];
        const built: CrewStatusItem[] = crew.map((c: { id: number; name: string; pivot?: { checkin_time?: string; checkout_time?: string } }) => {
          const pivot = c.pivot;
          const hasCheckout = pivot?.checkout_time;
          const hasCheckin = pivot?.checkin_time;
          let status: CrewStatusItem['status'] = 'pending';
          if (hasCheckout) status = 'checked_out';
          else if (hasCheckin) status = 'checked_in';
          let checkinTime: string | undefined;
          if (pivot?.checkin_time) {
            try {
              const d = new Date(pivot.checkin_time);
              checkinTime = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            } catch {
              checkinTime = pivot.checkin_time;
            }
          }
          return { user_id: c.id, name: c.name, status, checkin_time: checkinTime };
        });
        setCrewStatus(built);
      }
    } catch {
      Alert.alert('Error', 'Failed to load crew status.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCheckInOnBehalf = async (userId: number) => {
    if (!eventId) return;
    setCheckingInId(userId);
    let lat: number | undefined;
    let lon: number | undefined;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
      }
      await api.attendance.checkinOnBehalf(eventId, userId, lat, lon);
      await loadData();
    } catch (e) {
      Alert.alert('Check-in failed', e instanceof Error ? e.message : 'Could not check in crew member.');
    } finally {
      setCheckingInId(null);
    }
  };

  const isEnded = event?.status === 'completed' || event?.status === 'closed';
  const pending = crewStatus.filter((c) => c.status !== 'checked_in' && c.status !== 'checked_out');
  const checkedIn = crewStatus.filter((c) => c.status === 'checked_in');

  if (loading || !event) {
    return (
      <ThemedView style={styles.container}>
        <AppHeader title="Manage check-in" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeYellow} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>Loading…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <AppHeader title={`Check-in: ${event.name}`} showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Crew status</ThemedText>
          <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
            {checkedIn.length} checked in · {pending.length} pending
          </ThemedText>
        </View>

        {crewStatus.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>No crew assigned to this event.</ThemedText>
          </View>
        ) : (
          <>
            {pending.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Not checked in</ThemedText>
                {pending.map((member) => (
                  <View
                    key={member.user_id}
                    style={[styles.row, { borderBottomColor: colors.border }]}
                  >
                    <View style={styles.rowInfo}>
                      <ThemedText style={[styles.name, { color: colors.text }]}>{member.name}</ThemedText>
                      <ThemedText style={[styles.statusLabel, { color: colors.textSecondary }]}>
                        {member.status === 'late' ? 'Late' : 'Pending'}
                        {member.department ? ` · ${member.department}` : ''}
                      </ThemedText>
                    </View>
                    {!isEnded && (
                      <Pressable
                        onPress={() => handleCheckInOnBehalf(member.user_id)}
                        disabled={checkingInId === member.user_id}
                        style={({ pressed }) => [
                          styles.checkInBtn,
                          { backgroundColor: themeYellow + '22', borderColor: themeYellow },
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        {checkingInId === member.user_id ? (
                          <ActivityIndicator size="small" color={themeYellow} />
                        ) : (
                          <>
                            <Ionicons name="location" size={18} color={themeYellow} />
                            <ThemedText style={[styles.checkInBtnText, { color: themeYellow }]}>
                              Check in
                            </ThemedText>
                          </>
                        )}
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}

            {checkedIn.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Checked in</ThemedText>
                {checkedIn.map((member) => (
                  <View
                    key={member.user_id}
                    style={[styles.row, { borderBottomColor: colors.border }]}
                  >
                    <View style={styles.rowInfo}>
                      <ThemedText style={[styles.name, { color: colors.text }]}>{member.name}</ThemedText>
                      {member.checkin_time ? (
                        <ThemedText style={[styles.statusLabel, { color: colors.textSecondary }]}>
                          {member.checkin_time}
                        </ThemedText>
                      ) : null}
                    </View>
                    <View style={[styles.badge, { backgroundColor: themeYellow + '22' }]}>
                      <Ionicons name="checkmark-circle" size={18} color={themeYellow} />
                      <ThemedText style={[styles.badgeText, { color: themeYellow }]}>In</ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {crewStatus.some((c) => c.status === 'checked_out') && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Checked out</ThemedText>
                {crewStatus
                  .filter((c) => c.status === 'checked_out')
                  .map((member) => (
                    <View
                      key={member.user_id}
                      style={[styles.row, { borderBottomColor: colors.border }]}
                    >
                      <View style={styles.rowInfo}>
                        <ThemedText style={[styles.name, { color: colors.text }]}>{member.name}</ThemedText>
                      </View>
                      <ThemedText style={[styles.statusLabel, { color: colors.textSecondary }]}>Out</ThemedText>
                    </View>
                  ))}
              </View>
            )}
          </>
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
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: Spacing.xs },
  meta: { fontSize: 13, marginBottom: Spacing.sm },
  empty: { fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '600' },
  statusLabel: { fontSize: 12, marginTop: 2 },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  checkInBtnText: { fontSize: 14, fontWeight: '600' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  backBtn: { alignSelf: 'center', paddingVertical: Spacing.md },
  backBtnText: { fontSize: 16, fontWeight: '600' },
});
