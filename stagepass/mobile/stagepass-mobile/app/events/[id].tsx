import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { api, type Event as EventType } from '~/services/api';
import { useGeofence } from '~/hooks/useGeofence';
import { AppHeader } from '@/components/AppHeader';
import { StagepassLoader } from '@/components/StagepassLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Cards, Icons, Typography } from '@/constants/ui';
import { Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import * as Location from 'expo-location';

function formatEventDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatEventTime(timeStr: string | undefined): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.slice(0, 5).split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m || '00'} ${ampm}`;
}

/** Format ISO or "Y-m-d H:i:s" timestamp to HH:mm (24h) for checkout badge. */
function formatCheckoutTime(value: string | undefined): string {
  if (!value || typeof value !== 'string') return '';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value.slice(11, 16) || '';
    const h = d.getHours();
    const m = d.getMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  } catch {
    return value.slice(11, 16) || value;
  }
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const token = useSelector((s: { auth: { token: string | null } }) => s.auth.token);
  const currentUserId = useSelector((s: { auth: { user: { id?: number } | null } }) => s.auth.user?.id);
  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const { checkCanCheckIn } = useGeofence();

  const fetchEvent = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api.events
      .get(Number(id))
      .then(setEvent)
      .catch(() => Alert.alert('Error', 'Failed to load event'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!token) {
      router.replace('/login');
      return;
    }
    (async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {
        // location may be denied
      }
    })();
  }, [token, router]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  useFocusEffect(
    useCallback(() => {
      if (id && token) fetchEvent();
    }, [id, token, fetchEvent])
  );

  const myAssignment = currentUserId != null
    ? event?.crew?.find((c) => c.id === currentUserId)
    : event?.crew?.find((c) => c.pivot);
  const hasPivot = myAssignment && 'pivot' in myAssignment && myAssignment.pivot;
  const checkinTime = hasPivot && (myAssignment?.pivot as { checkin_time?: string })?.checkin_time;
  const checkoutTime = hasPivot && (myAssignment?.pivot as { checkout_time?: string })?.checkout_time;
  const checkoutTimeFormatted = formatCheckoutTime(checkoutTime as string | undefined);

  const handleCheckIn = async () => {
    if (!event?.id || actionLoading) return;
    const eventLat = event.latitude ?? null;
    const eventLon = event.longitude ?? null;
    const radius = event.geofence_radius ?? 100;
    const { allowed, message } = checkCanCheckIn(userLocation, eventLat, eventLon, radius);
    if (!allowed) {
      Alert.alert('Cannot check in', message);
      return;
    }
    setActionLoading(true);
    try {
      await api.attendance.checkin(
        event.id,
        userLocation!.latitude,
        userLocation!.longitude
      );
      const updated = await api.events.get(event.id);
      setEvent(updated);
    } catch (e: unknown) {
      Alert.alert('Check-in failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!event?.id || actionLoading || checkoutTime) return;
    setActionLoading(true);
    try {
      await api.attendance.checkout(event.id);
      const updated = await api.events.get(event.id);
      setEvent(updated);
    } catch (e: unknown) {
      Alert.alert('Check-out failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !event) {
    return <StagepassLoader message="Loading event…" fullScreen />;
  }

  const locationLabel = event.location_name ?? 'No location';
  const timeLabel = formatEventTime(event.start_time);
  const dateLabel = formatEventDate(event.date);

  return (
    <ThemedView style={styles.container}>
      <AppHeader title={event.name} showBack />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.dateRow, { borderBottomColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={Icons.header} color={themeYellow} />
            <ThemedText style={[styles.dateText, { color: colors.text }]}>{dateLabel}</ThemedText>
          </View>
          {timeLabel ? (
            <View style={[styles.metaRow, styles.metaRowBorder, { borderBottomColor: colors.border }]}>
              <Ionicons name="time-outline" size={Icons.header} color={themeYellow} />
              <ThemedText style={[styles.metaText, { color: colors.text }]}>{timeLabel}</ThemedText>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={Icons.header} color={themeYellow} />
            <ThemedText style={[styles.metaText, { color: colors.text }]} numberOfLines={2}>{locationLabel}</ThemedText>
          </View>
        </View>

        {event.description ? (
          <View style={[styles.descCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.desc, { color: colors.textSecondary }]}>{event.description}</ThemedText>
          </View>
        ) : null}

        {event.daily_allowance != null && event.daily_allowance > 0 ? (
          <View style={[styles.allowanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="wallet-outline" size={Icons.standard} color={themeYellow} />
            <View style={styles.allowanceTextWrap}>
              <ThemedText style={[styles.allowanceValue, { color: colors.text }]}>
                KES {Number(event.daily_allowance).toLocaleString()}
              </ThemedText>
              <ThemedText style={[styles.allowanceLabel, { color: colors.textSecondary }]}>Daily allowance</ThemedText>
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          {!checkinTime ? (
            <Pressable
              onPress={handleCheckIn}
              disabled={actionLoading || !userLocation}
              style={({ pressed }) => [
                styles.ctaButton,
                { backgroundColor: themeYellow, opacity: actionLoading || !userLocation ? 0.7 : pressed ? 0.9 : 1 },
              ]}
            >
              <Ionicons name="location" size={Icons.header} color={themeBlue} />
              <ThemedText style={styles.ctaButtonText}>
                {actionLoading ? 'Checking in…' : userLocation ? 'Check in at venue' : 'Getting location…'}
              </ThemedText>
            </Pressable>
          ) : checkoutTime ? (
            <View style={[styles.checkedOutBadge, styles.checkedOutBadgeSuccess, { backgroundColor: colors.border }]}>
              <Ionicons name="checkmark-done-circle" size={Icons.xl} color={themeBlue} />
              <ThemedText style={[styles.checkedOutText, { color: colors.text }]}>
                {checkoutTimeFormatted ? `Checked out at ${checkoutTimeFormatted}` : 'Checked out'}
              </ThemedText>
            </View>
          ) : (
            <Pressable
              onPress={handleCheckOut}
              disabled={actionLoading}
              style={({ pressed }) => [
                styles.ctaButtonSecondary,
                { borderColor: themeYellow, opacity: actionLoading ? 0.7 : pressed ? 0.9 : 1 },
              ]}
            >
              <ThemedText style={[styles.ctaButtonTextSecondary, { color: themeYellow }]}>
                {actionLoading ? 'Checking out…' : 'Check out'}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg },
  card: {
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dateText: {
    fontSize: Typography.buttonText,
    fontWeight: Typography.buttonTextWeight,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  metaRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metaText: {
    flex: 1,
    fontSize: Typography.bodySmall,
  },
  descCard: {
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  allowanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  allowanceTextWrap: { flex: 1 },
  allowanceValue: { fontSize: Typography.body, fontWeight: Typography.buttonTextWeight },
  allowanceLabel: { fontSize: Typography.label, marginTop: 2 },
  desc: {
    fontSize: Typography.bodySmall,
    lineHeight: 20,
  },
  actions: { marginTop: Spacing.md },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Cards.borderRadius,
  },
  ctaButtonText: {
    fontSize: Typography.buttonText,
    fontWeight: Typography.titleCardWeight,
    color: themeBlue,
  },
  ctaButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Cards.borderRadius,
    borderWidth: 2,
  },
  ctaButtonTextSecondary: {
    fontSize: Typography.buttonText,
    fontWeight: Typography.buttonTextWeight,
  },
  checkedOutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: Cards.borderRadius,
  },
  checkedOutBadgeSuccess: {
    opacity: 1,
  },
  checkedOutText: {
    fontSize: Typography.bodySmall,
    fontWeight: '600',
  },
});
