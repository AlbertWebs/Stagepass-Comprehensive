import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { HomeHeader } from '@/components/HomeHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, StatusColors, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, type User as ApiUser } from '~/services/api';
import { setUser } from '~/store/authSlice';
import { isWithinGeofence } from '~/utils/geofence';
import { NAV_PRESSED_OPACITY } from '@/src/utils/navigationPress';

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

/** Device local hour: morning before noon, afternoon until 5pm, evening after. */
function getTimeGreeting(): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function MinimalCrewHomeScreen({ onRefresh }: Props) {
  const dispatch = useDispatch();
  const { colors, isDark } = useStagePassTheme();
  const user = useSelector((s: { auth: { user: ApiUser | null } }) => s.auth.user);
  const [loading, setLoading] = useState(false);
  const [officeConfig, setOfficeConfig] = useState<{ latitude: number; longitude: number; radiusMeters: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapSourceIndex, setMapSourceIndex] = useState(0);
  const rippleA = useRef(new Animated.Value(0)).current;
  const rippleB = useRef(new Animated.Value(0)).current;

  const officeCheckedInToday = user?.office_checked_in_today ?? false;
  const officeCheckedOutToday = user?.office_checked_out_today ?? false;
  const canCheckout = officeCheckedInToday && !officeCheckedOutToday;
  const dayOfWeek = new Date().getDay();
  /** Sunday: office check-in not required — show “Chill day” instead of check-in CTA. */
  const isChillSunday = dayOfWeek === 0 && !officeCheckedInToday && !officeCheckedOutToday;
  const mainCtaDisabled = loading || officeCheckedOutToday;
  const showRipples = !isChillSunday && !mainCtaDisabled;
  const mapCenter = useMemo(
    () =>
      officeConfig
        ? { latitude: officeConfig.latitude, longitude: officeConfig.longitude }
        : userLocation,
    [officeConfig, userLocation]
  );
  const mapUrls = useMemo(() => {
    if (!mapCenter) return [];
    const lat = mapCenter.latitude.toFixed(6);
    const lon = mapCenter.longitude.toFixed(6);
    return [
      `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=15&size=900x640&markers=${lat},${lon},red-pushpin`,
      `https://static-maps.yandex.ru/1.x/?lang=en-US&ll=${lon},${lat}&z=15&l=map&size=650,450&pt=${lon},${lat},pm2rdm`,
    ];
  }, [mapCenter]);
  const mapUrl = mapUrls[mapSourceIndex] ?? null;

  const welcomeFirstName = useMemo(() => {
    const n = user?.name?.trim();
    if (!n) return '';
    return n.split(/\s+/)[0] ?? '';
  }, [user?.name]);

  const timeGreeting = getTimeGreeting();

  /** Light mode: softer surfaces and depth without changing layout structure. */
  const lightElevated = !isDark
    ? Platform.select({
        ios: {
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.09,
          shadowRadius: 20,
        },
        android: { elevation: 5 },
        default: {},
      })
    : {};

  const mapCardBg = isDark ? '#121723' : '#F4F6FA';
  const mapOverlayTintBg = isDark ? 'rgba(2,6,23,0.5)' : 'rgba(255,255,255,0.14)';
  const mapGridBorder = isDark ? '#475569' : 'rgba(100, 116, 139, 0.35)';
  const mapGridOpacity = isDark ? 0.24 : 0.12;

  useEffect(() => {
    setMapSourceIndex(0);
  }, [mapCenter?.latitude, mapCenter?.longitude]);

  const buttonLabel = useMemo(() => {
    if (isChillSunday) return 'Chill day';
    if (loading) return canCheckout ? 'Checking out...' : 'Checking in...';
    if (officeCheckedOutToday) return 'Done for today';
    if (canCheckout) return 'Office checkout';
    return 'Check in office';
  }, [loading, canCheckout, officeCheckedOutToday, isChillSunday]);

  const subLabel = useMemo(() => {
    if (isChillSunday) return 'Your day to relax — office check-in isn’t required on Sundays.';
    if (officeCheckedOutToday) return 'See you tomorrow';
    if (canCheckout) return 'Tap to end office shift';
    return 'Tap to start shift';
  }, [officeCheckedOutToday, canCheckout, isChillSunday]);

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
    if (!showRipples) {
      rippleA.setValue(0);
      rippleB.setValue(0);
      return;
    }
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
  }, [rippleA, rippleB, showRipples]);

  const triggerActionHaptic = useCallback(() => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

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
    if (new Date().getDay() === 0) {
      Alert.alert('Chill day', 'Office check-in isn’t required on Sundays — enjoy your day off.');
      return;
    }
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

  const onMainCtaPress = useCallback(() => {
    if (mainCtaDisabled) return;
    if (canCheckout) handleOfficeCheckOut();
    else handleOfficeCheckIn();
  }, [mainCtaDisabled, canCheckout, handleOfficeCheckOut, handleOfficeCheckIn]);

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="Home" notificationCount={0} />
      <View style={styles.content}>
        <View style={[styles.welcomeBlock, !isDark && styles.welcomeBlockLight]}>
          {!isDark ? <View style={styles.welcomeAccent} /> : null}
          <View style={styles.welcomeTextCol}>
            <ThemedText
              style={[
                styles.welcomeEyebrow,
                { color: isDark ? colors.textSecondary : themeBlue + '99' },
              ]}
            >
              Welcome back
            </ThemedText>
            <View style={styles.welcomeTitleWrap}>
              <ThemedText style={[styles.welcomeGreeting, { color: colors.text }]}>{timeGreeting}</ThemedText>
              {welcomeFirstName ? (
                <ThemedText style={[styles.welcomeName, { color: colors.text }]}>, {welcomeFirstName}</ThemedText>
              ) : null}
            </View>
          </View>
        </View>

        <View
          style={[
            styles.mapCardOuter,
            { backgroundColor: mapCardBg },
            !isDark && styles.mapCardOuterLight,
            isDark && styles.mapCardOuterDark,
          ]}
        >
          <View
            style={[
              styles.mapCard,
              { backgroundColor: mapCardBg },
              !isDark && styles.mapCardLight,
            ]}
          >
          {mapUrl ? (
            <Image
              source={{ uri: mapUrl }}
              style={styles.mapImage}
              contentFit="cover"
              transition={150}
              onError={() => {
                setMapSourceIndex((idx) => (idx + 1 < mapUrls.length ? idx + 1 : idx));
              }}
            />
          ) : null}
          <View style={[styles.mapOverlayTint, { backgroundColor: mapOverlayTintBg }]} />
          <View style={[styles.gridOverlay, { opacity: mapGridOpacity, borderColor: mapGridBorder }]} />
          <View style={styles.centerActionWrap}>
            {!isChillSunday ? (
              <>
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
                  onPress={onMainCtaPress}
                  onPressIn={() => {
                    if (!mainCtaDisabled) triggerActionHaptic();
                  }}
                  disabled={mainCtaDisabled}
                  accessibilityRole="button"
                  accessibilityLabel={
                    officeCheckedOutToday
                      ? 'Office check-in finished for today'
                      : canCheckout
                        ? 'Check out of office'
                        : 'Check in at office'
                  }
                  accessibilityState={{ disabled: mainCtaDisabled, busy: loading }}
                  style={({ pressed }) => [
                    styles.centerCta,
                    !isDark && styles.centerCtaLight,
                    {
                      backgroundColor: officeCheckedOutToday
                        ? isDark
                          ? '#334155'
                          : '#64748B'
                        : canCheckout
                          ? themeBlue
                          : themeYellow,
                      opacity: mainCtaDisabled ? (loading ? 0.92 : 1) : pressed ? NAV_PRESSED_OPACITY : 1,
                    },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator
                      size="small"
                      color={canCheckout || officeCheckedOutToday ? '#fff' : themeBlue}
                    />
                  ) : (
                    <Ionicons
                      name={canCheckout ? 'exit-outline' : 'location'}
                      size={22}
                      color={officeCheckedOutToday || canCheckout ? '#fff' : themeBlue}
                    />
                  )}
                </Pressable>
              </>
            ) : (
              <View
                style={[
                  styles.centerCta,
                  !isDark && styles.centerCtaLight,
                  { backgroundColor: isDark ? themeYellow + '22' : themeYellow + '35', borderWidth: 1, borderColor: themeYellow + '55' },
                ]}
              >
                <Ionicons name="sunny-outline" size={26} color={themeYellow} />
              </View>
            )}
          </View>
          </View>
        </View>

        <View
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderColor: isDark ? colors.border : themeBlue + '14' },
            !isDark && lightElevated,
            !isDark && styles.panelLight,
          ]}
        >
          <View style={styles.panelTopRow}>
            <View>
              <ThemedText style={[styles.panelEyebrow, { color: colors.textSecondary }]}>
                {isChillSunday ? 'SUNDAY' : 'OFFICE SHIFT'}
              </ThemedText>
              <ThemedText style={[styles.panelTitle, { color: colors.text }]}>
                {isChillSunday ? 'Chill day' : 'Check-in status'}
              </ThemedText>
            </View>
            <View
              style={[
                styles.stateChip,
                {
                  backgroundColor: isChillSunday
                    ? StatusColors.checkedIn + '18'
                    : officeCheckedOutToday
                      ? StatusColors.checkedIn + '20'
                      : canCheckout
                        ? themeBlue + '20'
                        : themeYellow + '22',
                  borderColor: isChillSunday
                    ? StatusColors.checkedIn + '44'
                    : officeCheckedOutToday
                      ? StatusColors.checkedIn + '55'
                      : canCheckout
                        ? themeBlue + '55'
                        : themeYellow + '66',
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.stateChipText,
                  {
                    color: isChillSunday
                      ? StatusColors.checkedIn
                      : officeCheckedOutToday
                        ? StatusColors.checkedIn
                        : canCheckout
                          ? themeBlue
                          : themeYellow,
                  },
                ]}
              >
                {isChillSunday ? 'Relax' : officeCheckedOutToday ? 'Done' : canCheckout ? 'Checked in' : 'Pending'}
              </ThemedText>
            </View>
          </View>

          <ThemedText style={[styles.panelSub, { color: colors.textSecondary }]}>{subLabel}</ThemedText>

          <Pressable
            onPress={onMainCtaPress}
            onPressIn={() => {
              if (!isChillSunday && !mainCtaDisabled) triggerActionHaptic();
            }}
            disabled={isChillSunday || mainCtaDisabled}
            accessibilityRole="button"
            accessibilityLabel={
              isChillSunday
                ? 'Sunday — office check-in not required'
                : officeCheckedOutToday
                  ? 'Finished for today'
                  : canCheckout
                    ? 'Check out of office'
                    : 'Check in at office'
            }
            accessibilityState={{ disabled: isChillSunday || mainCtaDisabled, busy: loading }}
            style={({ pressed }) => [
              styles.primaryActionCard,
              {
                backgroundColor: isChillSunday
                  ? isDark
                    ? StatusColors.checkedIn + '12'
                    : StatusColors.checkedIn + '14'
                  : officeCheckedOutToday
                    ? isDark
                      ? '#334155'
                      : '#F1F5F9'
                    : canCheckout
                      ? isDark
                        ? themeBlue + '14'
                        : themeBlue + '10'
                      : isDark
                        ? themeYellow + '16'
                        : themeYellow + '22',
                borderColor: isChillSunday
                  ? StatusColors.checkedIn + '44'
                  : officeCheckedOutToday
                    ? isDark
                      ? '#475569'
                      : '#CBD5E1'
                    : canCheckout
                      ? themeBlue + (isDark ? '55' : '40')
                      : themeYellow + (isDark ? '66' : '55'),
                opacity:
                  pressed && !isChillSunday && !mainCtaDisabled ? NAV_PRESSED_OPACITY : 1,
              },
            ]}
          >
            {loading && !isChillSunday ? (
              <ActivityIndicator
                size="small"
                color={canCheckout ? '#fff' : officeCheckedOutToday ? colors.textSecondary : themeBlue}
              />
            ) : (
              <Ionicons
                name={isChillSunday ? 'cafe-outline' : officeCheckedOutToday ? 'checkmark-done-circle' : canCheckout ? 'exit-outline' : 'location'}
                size={18}
                color={
                  isChillSunday
                    ? StatusColors.checkedIn
                    : officeCheckedOutToday && isDark
                      ? '#e2e8f0'
                      : officeCheckedOutToday
                        ? colors.textSecondary
                        : canCheckout
                          ? themeBlue
                          : themeYellow
                }
              />
            )}
            <ThemedText
              style={[
                styles.primaryActionText,
                {
                  flex: 1,
                  color:
                    isChillSunday
                      ? colors.text
                      : officeCheckedOutToday && isDark
                        ? '#e2e8f0'
                        : officeCheckedOutToday
                          ? colors.textSecondary
                          : colors.text,
                },
              ]}
            >
              {buttonLabel}
            </ThemedText>
            {!isChillSunday && !mainCtaDisabled ? (
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            ) : null}
          </Pressable>

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
    paddingTop: Spacing.lg,
    gap: Spacing.lg + 2,
  },
  welcomeBlock: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.md,
  },
  welcomeBlockLight: {
    paddingBottom: 2,
  },
  welcomeAccent: {
    width: 4,
    borderRadius: 2,
    backgroundColor: themeYellow,
  },
  welcomeTextCol: {
    flex: 1,
  },
  welcomeEyebrow: {
    fontSize: 10,
    letterSpacing: 0.75,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  /** Slightly smaller than previous single 24px line; greeting a touch lighter than name. */
  welcomeTitleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  welcomeGreeting: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.22,
    lineHeight: 24,
  },
  welcomeName: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.28,
    lineHeight: 24,
  },
  mapCardOuter: {
    borderRadius: 22,
  },
  mapCardOuterLight: Platform.select({
    ios: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.13,
      shadowRadius: 24,
    },
    android: { elevation: 9 },
    default: {},
  }),
  mapCardOuterDark: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.55,
      shadowRadius: 20,
    },
    android: { elevation: 11 },
    default: {},
  }),
  mapCard: {
    borderRadius: 22,
    height: 320,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  mapCardLight: {
    borderWidth: 1,
    borderColor: 'rgba(15, 24, 56, 0.07)',
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
    borderWidth: 1,
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
  centerCtaLight: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.92)',
    shadowColor: themeBlue,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  panel: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.lg + 2,
    gap: Spacing.md,
  },
  panelLight: {
    paddingVertical: Spacing.lg + 2,
  },
  panelTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  panelEyebrow: {
    fontSize: 11,
    letterSpacing: 0.9,
    fontWeight: '700',
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  stateChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  stateChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.25,
  },
  panelSub: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 0,
  },
  primaryActionCard: {
    marginTop: 2,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.15,
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
