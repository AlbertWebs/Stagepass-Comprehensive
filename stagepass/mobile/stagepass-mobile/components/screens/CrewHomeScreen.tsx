import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { api, type Event as EventType } from '~/services/api';
import { useGeofence } from '~/hooks/useGeofence';
import { CheckInButton } from '@/components/CheckInButton';
import { LocationGuard } from '@/components/LocationGuard';
import { StagepassLoader } from '@/components/StagepassLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, StagePassColors, themeBlue } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import * as Location from 'expo-location';

const CHECKIN_RADIUS_METERS = 100;

type Props = {
  event: EventType;
  onRefresh: () => Promise<void>;
};

export function CrewHomeScreen({ event, onRefresh }: Props) {
  const router = useRouter();
  const { colors, isDark } = useStagePassTheme();
  const userId = useSelector((s: { auth: { user: { id: number } | null } }) => s.auth.user?.id);
  const [actionLoading, setActionLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const { checkCanCheckIn } = useGeofence();

  useEffect(() => {
    let cancelled = false;
    Location.getCurrentPositionAsync({}).then((loc) => {
      if (!cancelled) setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const myCrew = event.crew?.find((c) => c.id === userId);
  const pivot = myCrew && 'pivot' in myCrew ? myCrew.pivot : undefined;
  const checkinTime = pivot?.checkin_time;
  const checkoutTime = pivot?.checkout_time;

  const radiusMeters = event.geofence_radius ?? CHECKIN_RADIUS_METERS;
  const eventLat = event.latitude ?? null;
  const eventLon = event.longitude ?? null;
  const { allowed: canCheckIn, message: locationMessage } = checkCanCheckIn(
    userLocation,
    eventLat,
    eventLon,
    radiusMeters
  );

  const handleCheckIn = async () => {
    if (!event?.id || actionLoading) return;
    if (!canCheckIn) {
      Alert.alert('Cannot check in', locationMessage);
      return;
    }
    setActionLoading(true);
    try {
      await api.attendance.checkin(
        event.id,
        userLocation!.latitude,
        userLocation!.longitude
      );
      await onRefresh();
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
      await onRefresh();
    } catch (e: unknown) {
      Alert.alert('Check-out failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const canPressCheckIn = !checkinTime && userLocation && !actionLoading;
  const canPressCheckOut = checkinTime && !checkoutTime && !actionLoading;
  const showOutsideMessage = !checkinTime && userLocation && !canCheckIn && eventLat != null && eventLon != null;

  return (
    <ThemedView style={styles.container}>
      {actionLoading && <StagepassLoader message="Checking in…" fullScreen />}
      <ThemedText style={[styles.eventName, { color: StagePassColors.themeBlue }]}>{event.name}</ThemedText>
      <ThemedText style={[styles.meta, { color: StagePassColors.themeYellow }]}>
        Call time {event.start_time} · {event.location_name ?? 'No location'}
      </ThemedText>
      {(event.team_leader ?? event.teamLeader) && (
        <ThemedText style={[styles.leader, { color: colors.textSecondary }]}>
          Team leader: {(event.team_leader ?? event.teamLeader)!.name}
        </ThemedText>
      )}

      <LocationGuard message={locationMessage} visible={showOutsideMessage} />

      <View style={styles.buttonWrap}>
        {!checkinTime ? (
          <CheckInButton
            onPress={handleCheckIn}
            disabled={!canPressCheckIn}
            loading={actionLoading}
            label={userLocation ? 'CHECK IN' : 'Getting location…'}
          />
        ) : !checkoutTime ? (
          <Pressable
            onPress={handleCheckOut}
            disabled={!canPressCheckOut}
            style={[
              styles.mainButton,
              styles.mainButtonCheckedIn,
              {
                backgroundColor: isDark ? StagePassColors.primary : StagePassColors.primaryLight,
                opacity: actionLoading ? 0.7 : 1,
              },
            ]}
          >
            <ThemedText style={[styles.mainButtonText, { color: themeBlue }]}>
              {actionLoading ? 'Checking out…' : 'CHECK OUT'}
            </ThemedText>
          </Pressable>
        ) : (
          <View style={[styles.mainButton, { backgroundColor: colors.border }]}>
            <ThemedText style={[styles.mainButtonText, { color: colors.textSecondary }]}>
              CHECKED OUT
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.cards}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push(`/events/${event.id}`)}
        >
          <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Event Info</ThemedText>
          <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
            Details, location, times
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/(tabs)/events')}
        >
          <ThemedText style={[styles.cardTitle, { color: colors.text }]}>My Tasks</ThemedText>
          <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
            View assigned tasks
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/(tabs)/events')}
        >
          <ThemedText style={[styles.cardTitle, { color: colors.text }]}>My Checklists</ThemedText>
          <ThemedText style={[styles.cardSub, { color: colors.textSecondary }]}>
            Complete checklist items
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.xl,
    paddingTop: Spacing.section,
  },
  eventName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  meta: {
    fontSize: 15,
    marginBottom: Spacing.xs,
  },
  leader: {
    fontSize: 14,
    marginBottom: Spacing.xl,
  },
  buttonWrap: {
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  mainButton: {
    width: '100%',
    maxWidth: 280,
    minHeight: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  mainButtonCheckedIn: {
    borderWidth: 0,
  },
  mainButtonText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cards: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  cardSub: {
    fontSize: 13,
  },
});
