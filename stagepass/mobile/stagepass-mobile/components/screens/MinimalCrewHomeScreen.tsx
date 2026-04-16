import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { HomeHeader } from '@/components/HomeHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, StatusColors, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, type User as ApiUser } from '~/services/api';
import { setUser } from '~/store/authSlice';
import { isWithinGeofence } from '~/utils/geofence';

type Props = {
  onRefresh?: () => Promise<void>;
};

function parseOfficeCoord(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const t = value.trim().replace(/,/g, '.');
    if (!t) return null;
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function MinimalCrewHomeScreen({ onRefresh }: Props) {
  const dispatch = useDispatch();
  const { colors, isDark } = useStagePassTheme();
  const user = useSelector((s: { auth: { user: ApiUser | null } }) => s.auth.user);
  const [loading, setLoading] = useState(false);
  const [officeConfig, setOfficeConfig] = useState<{ latitude: number; longitude: number; radiusMeters: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const rippleA = useRef(new Animated.Value(0)).current;
  const rippleB = useRef(new Animated.Value(0)).current;

  const officeCheckedInToday = user?.office_checked_in_today ?? false;
  const officeCheckedOutToday = user?.office_checked_out_today ?? false;
  const canCheckout = officeCheckedInToday && !officeCheckedOutToday;
  const officeMapUrl = useMemo(() => {
    if (!officeConfig) return null;
    const lat = officeConfig.latitude.toFixed(6);
    const lon = officeConfig.longitude.toFixed(6);
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=15&size=900x640&markers=${lat},${lon},red-pushpin`;
  }, [officeConfig]);

  const buttonLabel = useMemo(() => {
    if (loading) return canCheckout ? 'Checking out...' : 'Checking in...';
    if (officeCheckedOutToday) return 'Done for today';
    if (canCheckout) return 'Office checkout';
    return 'Check in office';
  }, [loading, canCheckout, officeCheckedOutToday]);

  const subLabel = useMemo(() => {
    if (officeCheckedOutToday) return 'See you tomorrow';
    if (canCheckout) return 'Tap to end office shift';
    return 'Tap to start shift';
  }, [officeCheckedOutToday, canCheckout]);

  const loadConfig = useCallback(async () => {
    try {
      const s = await api.settings.getOfficeCheckinConfig();
      const lat = parseOfficeCoord(s?.office_latitude);
      const lng = parseOfficeCoord(s?.office_longitude);
      const rawRadius = s?.office_radius_m;
      const radius =
        typeof rawRadius === 'number' && Number.isFinite(rawRadius)
          ? rawRadius
          : Number.parseFloat(String(rawRadius ?? '').replace(/,/g, '.')) || 100;
      if (lat != null && lng != null) {
        setOfficeConfig({ latitude: lat, longitude: lng, radiusMeters: radius > 0 ? radius : 100 });
      } else {
        setOfficeConfig(null);
      }
    } catch {
      setOfficeConfig(null);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    Location.getCurrentPositionAsync({})
      .then((loc) => setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }))
      .catch(() => {});
  }, [loadConfig]);

  useEffect(() => {
    const runRipple = (value: Animated.Value, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

    const a = runRipple(rippleA, 0);
    const b = runRipple(rippleB, 1100);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [rippleA, rippleB]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.auth.me();
      dispatch(setUser(me));
    } catch {
      // no-op
    }
    await onRefresh?.();
  }, [dispatch, onRefresh]);

  const handleOfficeCheckIn = useCallback(async () => {
    if (loading || officeCheckedOutToday) return;
    setLoading(true);
    try {
      let location = userLocation;
      if (!location) {
        const loc = await Location.getCurrentPositionAsync({});
        location = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(location);
      }
      if (!location) {
        Alert.alert('Location required', 'Enable location to continue.');
        return;
      }
      if (!officeConfig) {
        Alert.alert('Office not configured', 'Ask admin to set office location in settings.');
        return;
      }
      const within = isWithinGeofence(
        location.latitude,
        location.longitude,
        officeConfig.latitude,
        officeConfig.longitude,
        officeConfig.radiusMeters
      );
      if (!within) {
        Alert.alert('Not at office', `Move within ${officeConfig.radiusMeters}m of office to check in.`);
        return;
      }
      await api.attendance.officeCheckin(location.latitude, location.longitude);
      await refreshUser();
    } catch (e: unknown) {
      Alert.alert('Check-in failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }, [loading, officeCheckedOutToday, userLocation, officeConfig, refreshUser]);

  const handleOfficeCheckOut = useCallback(async () => {
    if (loading || !canCheckout) return;
    Alert.alert('Confirm checkout', 'Are you sure you want to check out now?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Check out',
        onPress: async () => {
          setLoading(true);
          try {
            await api.attendance.officeCheckout(userLocation?.latitude, userLocation?.longitude);
            await refreshUser();
          } catch (e: unknown) {
            Alert.alert('Checkout failed', e instanceof Error ? e.message : 'Try again.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }, [loading, canCheckout, userLocation, refreshUser]);

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="Home" notificationCount={0} />
      <View style={styles.content}>
        <View style={[styles.mapCard, { backgroundColor: isDark ? '#121723' : '#0F172A' }]}>
          {officeMapUrl ? (
            <Image
              source={{ uri: officeMapUrl }}
              style={styles.mapImage}
              contentFit="cover"
              transition={150}
            />
          ) : null}
          <View style={[styles.mapOverlayTint, { backgroundColor: isDark ? 'rgba(2,6,23,0.38)' : 'rgba(15,23,42,0.28)' }]} />
          <View style={styles.gridOverlay} />
          <View style={styles.centerActionWrap}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.rippleRing,
                {
                  borderColor: themeYellow + '99',
                  opacity: rippleA.interpolate({ inputRange: [0, 1], outputRange: [0.65, 0] }),
                  transform: [{ scale: rippleA.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.rippleRing,
                {
                  borderColor: themeYellow + '66',
                  opacity: rippleB.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                  transform: [{ scale: rippleB.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
                },
              ]}
            />
            <Pressable
              onPress={canCheckout ? handleOfficeCheckOut : handleOfficeCheckIn}
              disabled={loading || officeCheckedOutToday}
              style={({ pressed }) => [
                styles.centerCta,
                {
                  backgroundColor: officeCheckedOutToday ? '#334155' : canCheckout ? themeBlue : themeYellow,
                  opacity: pressed ? 0.86 : 1,
                },
              ]}
            >
              <Ionicons name={canCheckout ? 'exit-outline' : 'location'} size={22} color={officeCheckedOutToday || canCheckout ? '#fff' : themeBlue} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.panelTitle, { color: colors.text }]}>Office check-in</ThemedText>
          <ThemedText style={[styles.panelSub, { color: colors.textSecondary }]}>{subLabel}</ThemedText>
          <ThemedText style={[styles.statusText, { color: colors.text }]}>{buttonLabel}</ThemedText>
          {(officeCheckedInToday || officeCheckedOutToday) ? (
            <View style={styles.statusRow}>
              <Ionicons
                name={officeCheckedOutToday ? 'checkmark-done-circle' : 'checkmark-circle'}
                size={16}
                color={StatusColors.checkedIn}
              />
              <ThemedText style={[styles.statusText, { color: colors.textSecondary }]}>
                {officeCheckedOutToday ? 'Checked out successfully' : 'Checked in successfully'}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  mapCard: {
    borderRadius: 22,
    height: 320,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  mapImage: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlayTint: {
    ...StyleSheet.absoluteFillObject,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    opacity: 0.24,
    borderWidth: 1,
    borderColor: '#475569',
  },
  pinWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerActionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
  },
  centerCta: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  panel: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  panelSub: {
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  statusText: {
    fontSize: 13,
  },
});
