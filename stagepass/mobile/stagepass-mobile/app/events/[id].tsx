import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { api, type Event as EventType } from '~/services/api';
import { useGeofence } from '~/hooks/useGeofence';
import { AppHeader } from '@/components/AppHeader';
import { StagepassLoader } from '@/components/StagepassLoader';
import { StagePassButton } from '@/components/StagePassButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import * as Location from 'expo-location';

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

  return (
    <ThemedView style={styles.container}>
      <AppHeader title={event.name} />
      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
      <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
        {event.date} · {event.location_name ?? 'No location'}
      </ThemedText>
      {event.description ? (
        <ThemedText style={styles.desc}>{event.description}</ThemedText>
      ) : null}

      <ThemedView style={styles.actions}>
        {!checkinTime ? (
          <StagePassButton
            title={actionLoading ? 'Checking in…' : userLocation ? 'Check in' : 'Getting location…'}
            onPress={handleCheckIn}
            loading={actionLoading}
            disabled={actionLoading || !userLocation}
            variant="primary"
            style={styles.button}
          />
        ) : !checkoutTime ? (
          <StagePassButton
            title={actionLoading ? 'Checking out…' : 'Check out'}
            onPress={handleCheckOut}
            loading={actionLoading}
            disabled={actionLoading}
            variant="secondary"
            style={styles.button}
          />
        ) : (
          <ThemedText style={{ color: colors.textSecondary }}>
            You have checked out.
          </ThemedText>
        )}
      </ThemedView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: Spacing.xl },
  meta: { marginTop: Spacing.sm },
  desc: { marginTop: Spacing.md },
  actions: { marginTop: Spacing.section },
  button: { marginBottom: Spacing.md },
});
