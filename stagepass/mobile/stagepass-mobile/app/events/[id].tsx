import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { api, type Event as EventType } from '~/services/api';
import { useGeofence } from '~/hooks/useGeofence';
import { AppHeader } from '@/components/AppHeader';
import { StagepassLoader } from '@/components/StagepassLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import * as Location from 'expo-location';

const U = { xs: 6, sm: 8, md: 12, lg: 14, xl: 16, section: 24 };
const CARD_RADIUS = 12;

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

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const token = useSelector((s: { auth: { token: string | null } }) => s.auth.token);
  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const { checkCanCheckIn } = useGeofence();

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
    if (!id) return;
    api.events
      .get(Number(id))
      .then(setEvent)
      .catch(() => Alert.alert('Error', 'Failed to load event'))
      .finally(() => setLoading(false));
  }, [id]);

  const myAssignment = event?.crew?.find((c) => c.pivot);
  const hasPivot = myAssignment && 'pivot' in myAssignment && myAssignment.pivot;
  const checkinTime = hasPivot && myAssignment?.pivot?.checkin_time;
  const checkoutTime = hasPivot && myAssignment?.pivot?.checkout_time;

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
    if (!event?.id || actionLoading) return;
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + U.section }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.dateRow, { borderBottomColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={18} color={themeYellow} />
            <ThemedText style={[styles.dateText, { color: colors.text }]}>{dateLabel}</ThemedText>
          </View>
          {timeLabel ? (
            <View style={[styles.metaRow, styles.metaRowBorder, { borderBottomColor: colors.border }]}>
              <Ionicons name="time-outline" size={18} color={themeYellow} />
              <ThemedText style={[styles.metaText, { color: colors.text }]}>{timeLabel}</ThemedText>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={18} color={themeYellow} />
            <ThemedText style={[styles.metaText, { color: colors.text }]} numberOfLines={2}>{locationLabel}</ThemedText>
          </View>
        </View>

        {event.description ? (
          <View style={[styles.descCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ThemedText style={[styles.desc, { color: colors.textSecondary }]}>{event.description}</ThemedText>
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
              <Ionicons name="location" size={18} color={themeBlue} />
              <ThemedText style={styles.ctaButtonText}>
                {actionLoading ? 'Checking in…' : userLocation ? 'Check in at venue' : 'Getting location…'}
              </ThemedText>
            </Pressable>
          ) : !checkoutTime ? (
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
          ) : (
            <View style={[styles.checkedOutBadge, { backgroundColor: colors.border }]}>
              <Ionicons name="checkmark-done" size={18} color={colors.textSecondary} />
              <ThemedText style={[styles.checkedOutText, { color: colors.textSecondary }]}>You have checked out</ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: U.lg },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    padding: U.lg,
    marginBottom: U.lg,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: U.md,
    paddingBottom: U.md,
    marginBottom: U.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: U.md,
    paddingVertical: U.sm,
  },
  metaRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metaText: {
    flex: 1,
    fontSize: 14,
  },
  descCard: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    padding: U.lg,
    marginBottom: U.lg,
  },
  desc: {
    fontSize: 13,
    lineHeight: 20,
  },
  actions: { marginTop: U.md },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: U.md,
    paddingVertical: U.lg,
    paddingHorizontal: U.xl,
    borderRadius: CARD_RADIUS,
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: themeBlue,
  },
  ctaButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: U.lg,
    paddingHorizontal: U.xl,
    borderRadius: CARD_RADIUS,
    borderWidth: 2,
  },
  ctaButtonTextSecondary: {
    fontSize: 15,
    fontWeight: '700',
  },
  checkedOutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: U.sm,
    paddingVertical: U.lg,
    borderRadius: CARD_RADIUS,
  },
  checkedOutText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
