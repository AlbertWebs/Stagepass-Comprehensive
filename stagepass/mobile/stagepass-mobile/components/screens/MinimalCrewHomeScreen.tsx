import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import { HomeHeader } from '@/components/HomeHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, type User as ApiUser } from '~/services/api';
import { setUser } from '~/store/authSlice';
import { isWithinGeofence } from '~/utils/geofence';
import {
  DEFAULT_OFFICE_CHECKIN_REQUIRED_DAYS,
  parseOfficeCheckinRequiredDays,
} from '@/src/utils/officeCheckinRequiredDays';
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
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { colors, isDark } = useStagePassTheme();
  const user = useSelector((s: { auth: { user: ApiUser | null } }) => s.auth.user);
  const [loading, setLoading] = useState(false);
  const [officeConfig, setOfficeConfig] = useState<{ latitude: number; longitude: number; radiusMeters: number } | null>(null);
  const [requiredCheckinDays, setRequiredCheckinDays] = useState<number[]>(DEFAULT_OFFICE_CHECKIN_REQUIRED_DAYS);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapSourceIndex, setMapSourceIndex] = useState(0);
  const rippleA = useRef(new Animated.Value(0)).current;
  const rippleB = useRef(new Animated.Value(0)).current;

  const officeCheckedInToday = user?.office_checked_in_today ?? false;
  const officeCheckedOutToday = user?.office_checked_out_today ?? false;
  const canCheckout = officeCheckedInToday && !officeCheckedOutToday;
  const dayOfWeek = new Date().getDay();
  const isCheckinRequiredToday = requiredCheckinDays.includes(dayOfWeek);
  /** No office shift today (admin-configured weekdays); show “weekend” or day-off messaging. */
  const isOfficeCheckinOffDay =
    !isCheckinRequiredToday && !officeCheckedInToday && !officeCheckedOutToday;
  const isWeekendOffDay = isOfficeCheckinOffDay && (dayOfWeek === 0 || dayOfWeek === 6);
  const mainCtaDisabled = loading || officeCheckedOutToday;
  const showRipples = !isOfficeCheckinOffDay && !mainCtaDisabled;
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
    if (isWeekendOffDay) return 'Weekend';
    if (isOfficeCheckinOffDay) return 'No check-in today';
    if (loading) return canCheckout ? 'Checking out...' : 'Checking in...';
    if (officeCheckedOutToday) return 'Done for today';
    if (canCheckout) return 'Office checkout';
    return 'Check in office';
  }, [loading, canCheckout, officeCheckedOutToday, isOfficeCheckinOffDay, isWeekendOffDay]);

  const subLabel = useMemo(() => {
    if (isWeekendOffDay) return 'We’re off for the weekend — office check-in isn’t available.';
    if (isOfficeCheckinOffDay) return 'Office check-in isn’t required today.';
    if (officeCheckedOutToday) return 'See you tomorrow';
    if (canCheckout) return 'Tap to end office shift';
    return 'Tap to start shift';
  }, [officeCheckedOutToday, canCheckout, isOfficeCheckinOffDay, isWeekendOffDay]);

  const loadConfig = useCallback(async () => {
    try {
      const s = await api.settings.getOfficeCheckinConfig();
      setRequiredCheckinDays(parseOfficeCheckinRequiredDays(s?.office_checkin_required_days));
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
    Location.getCurrentPositionAsync({})
      .then((loc) => setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }))
      .catch(() => {});
  }, []);

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

  const triggerSuccessHaptic = useCallback(() => {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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

  useFocusEffect(
    useCallback(() => {
      loadConfig();
      void refreshUser();
    }, [loadConfig, refreshUser])
  );

  const handleOfficeCheckIn = useCallback(async () => {
    if (loading || officeCheckedOutToday) return;
    const dow = new Date().getDay();
    if (!requiredCheckinDays.includes(dow)) {
      const weekend = dow === 0 || dow === 6;
      Alert.alert(
        weekend ? 'Weekend' : 'No office check-in',
        weekend
          ? 'We’re off for the weekend — office check-in isn’t available.'
          : 'Office check-in isn’t required today.'
      );
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
      triggerSuccessHaptic();
    } catch (e: unknown) {
      Alert.alert('Check-in failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    officeCheckedOutToday,
    userLocation,
    officeConfig,
    refreshUser,
    requiredCheckinDays,
    triggerSuccessHaptic,
  ]);

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
            triggerSuccessHaptic();
          } catch (e: unknown) {
            Alert.alert('Checkout failed', e instanceof Error ? e.message : 'Try again.');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }, [loading, canCheckout, userLocation, refreshUser, triggerSuccessHaptic]);

  const onMainCtaPress = useCallback(() => {
    if (mainCtaDisabled) return;
    if (canCheckout) handleOfficeCheckOut();
    else handleOfficeCheckIn();
  }, [mainCtaDisabled, canCheckout, handleOfficeCheckOut, handleOfficeCheckIn]);

  const overlayBottomPad = Math.max(insets.bottom, Spacing.sm) + Spacing.lg;
  /** Clear transparent header + title row so the welcome pill sits on the map below it. */
  const welcomePillTopPad = Math.max(insets.top, Spacing.sm) + 52;

  return (
    <ThemedView style={[styles.container, { backgroundColor: mapCardBg }]}>
      <View style={styles.screenRoot}>
        <View style={styles.mapLayer} collapsable={false}>
          <View style={[styles.mapHeroInner, { backgroundColor: mapCardBg }]} collapsable={false}>
            {mapUrl ? (
              <Image
                source={{ uri: mapUrl }}
                style={[styles.mapImage, { minWidth: windowWidth, minHeight: windowHeight }]}
                contentFit="cover"
                transition={150}
                onError={() => {
                  setMapSourceIndex((idx) => (idx + 1 < mapUrls.length ? idx + 1 : idx));
                }}
              />
            ) : null}
            <View style={[styles.mapOverlayTint, { backgroundColor: mapOverlayTintBg }]} />
            <View style={[styles.gridOverlay, { opacity: mapGridOpacity, borderColor: mapGridBorder }]} />
            {!mapUrl ? (
              <View style={styles.mapLoadingLayer} pointerEvents="none">
                <ActivityIndicator size="small" color={isDark ? themeYellow : themeBlue} />
              </View>
            ) : null}
            <View style={styles.centerActionWrap}>
              {!isOfficeCheckinOffDay ? (
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
                    android_ripple={
                      Platform.OS === 'android' && !mainCtaDisabled
                        ? { color: 'rgba(255,255,255,0.22)' }
                        : undefined
                    }
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

        <View style={styles.overlayStack} pointerEvents="box-none">
          <View style={[styles.overlayTop, { paddingTop: welcomePillTopPad }]} pointerEvents="none">
            <Reanimated.View
              entering={FadeInDown.duration(420).delay(40)}
              style={[
                styles.welcomePill,
                isDark ? styles.welcomePillBgDark : styles.welcomePillBgLight,
                !isDark && styles.welcomePillLiftLight,
              ]}
              accessibilityRole="header"
              accessibilityLabel={`Welcome back. ${timeGreeting}${welcomeFirstName ? `, ${welcomeFirstName}` : ''}`}
            >
              <ThemedText style={styles.welcomePillEyebrow} maxFontSizeMultiplier={1.35}>
                Welcome back
              </ThemedText>
              <ThemedText style={styles.welcomePillMain} numberOfLines={2} maxFontSizeMultiplier={1.35}>
                {timeGreeting}
                {welcomeFirstName ? ` · ${welcomeFirstName}` : ''}
              </ThemedText>
            </Reanimated.View>
          </View>
          <View style={styles.overlaySpacer} pointerEvents="none" />
          <View style={[styles.overlayBottom, { paddingBottom: overlayBottomPad }]}>
            <Reanimated.View entering={FadeInUp.duration(460).delay(72)} style={styles.panelOuter}>
            <View
              style={[
                styles.panel,
                { backgroundColor: colors.surface, borderColor: isDark ? colors.border : themeBlue + '14' },
                !isDark && lightElevated,
                !isDark && styles.panelLight,
              ]}
            >
          <View
            style={[
              styles.panelHandle,
              { backgroundColor: isDark ? 'rgba(148, 163, 184, 0.38)' : 'rgba(100, 116, 139, 0.28)' },
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <View style={styles.panelTopRow}>
            <View>
              <ThemedText style={[styles.panelEyebrow, { color: colors.textSecondary }]}>
                {isOfficeCheckinOffDay ? (isWeekendOffDay ? 'WEEKEND' : 'DAY OFF') : 'OFFICE SHIFT'}
              </ThemedText>
              <ThemedText style={[styles.panelTitle, { color: colors.text }]}>
                {isWeekendOffDay ? 'Weekend' : isOfficeCheckinOffDay ? 'Off today' : 'Check-in status'}
              </ThemedText>
            </View>
            <View
              style={[
                styles.stateChip,
                {
                  backgroundColor: isOfficeCheckinOffDay
                    ? themeYellow + '18'
                    : officeCheckedOutToday
                      ? themeBlue + '20'
                      : canCheckout
                        ? themeBlue + '20'
                        : themeYellow + '22',
                  borderColor: isOfficeCheckinOffDay
                    ? themeYellow + '44'
                    : officeCheckedOutToday
                      ? themeBlue + '55'
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
                    color: isOfficeCheckinOffDay
                      ? themeYellow
                      : officeCheckedOutToday
                        ? themeBlue
                        : canCheckout
                          ? themeBlue
                          : themeYellow,
                  },
                ]}
              >
                {isOfficeCheckinOffDay ? 'Relax' : officeCheckedOutToday ? 'Done' : canCheckout ? 'Checked in' : 'Pending'}
              </ThemedText>
            </View>
          </View>

          <ThemedText
            style={[styles.panelSub, { color: colors.textSecondary }]}
            maxFontSizeMultiplier={1.35}
          >
            {subLabel}
          </ThemedText>

          <Pressable
            onPress={onMainCtaPress}
            onPressIn={() => {
              if (!isOfficeCheckinOffDay && !mainCtaDisabled) triggerActionHaptic();
            }}
            disabled={isOfficeCheckinOffDay || mainCtaDisabled}
            android_ripple={
              Platform.OS === 'android' && !isOfficeCheckinOffDay && !mainCtaDisabled
                ? { color: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.07)' }
                : undefined
            }
            accessibilityRole="button"
            accessibilityLabel={
              isOfficeCheckinOffDay
                ? 'Office check-in not required today'
                : officeCheckedOutToday
                  ? 'Finished for today'
                  : canCheckout
                    ? 'Check out of office'
                    : 'Check in at office'
            }
            accessibilityState={{ disabled: isOfficeCheckinOffDay || mainCtaDisabled, busy: loading }}
            style={({ pressed }) => [
              styles.primaryActionCard,
              {
                backgroundColor: isOfficeCheckinOffDay
                  ? isDark
                    ? themeYellow + '14'
                    : themeYellow + '16'
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
                borderColor: isOfficeCheckinOffDay
                  ? themeYellow + '44'
                  : officeCheckedOutToday
                    ? isDark
                      ? '#475569'
                      : '#CBD5E1'
                    : canCheckout
                      ? themeBlue + (isDark ? '55' : '40')
                      : themeYellow + (isDark ? '66' : '55'),
                opacity:
                  pressed && !isOfficeCheckinOffDay && !mainCtaDisabled ? NAV_PRESSED_OPACITY : 1,
              },
            ]}
          >
            {loading && !isOfficeCheckinOffDay ? (
              <ActivityIndicator
                size="small"
                color={canCheckout ? '#fff' : officeCheckedOutToday ? colors.textSecondary : themeBlue}
              />
            ) : (
              <Ionicons
                name={isOfficeCheckinOffDay ? 'cafe-outline' : officeCheckedOutToday ? 'checkmark-done-circle' : canCheckout ? 'exit-outline' : 'location'}
                size={18}
                color={
                  isOfficeCheckinOffDay
                    ? themeYellow
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
                    isOfficeCheckinOffDay
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
            {!isOfficeCheckinOffDay && !mainCtaDisabled ? (
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            ) : null}
          </Pressable>

          {(officeCheckedInToday || officeCheckedOutToday) ? (
            <View style={styles.statusRow}>
              <Ionicons
                name={officeCheckedOutToday ? 'checkmark-done-circle' : 'checkmark-circle'}
                size={16}
                color={themeBlue}
              />
              <ThemedText style={[styles.statusText, { color: colors.textSecondary }]}>
                {officeCheckedOutToday ? 'Checked out successfully' : 'Checked in successfully'}
              </ThemedText>
            </View>
          ) : null}
            </View>
            </Reanimated.View>
          </View>
        </View>

        <View style={styles.headerOverlay} pointerEvents="box-none">
          <HomeHeader title="Home" notificationCount={0} transparentOverlay />
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  screenRoot: {
    flex: 1,
    position: 'relative',
  },
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  mapHeroInner: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  overlayStack: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    zIndex: 1,
    flexDirection: 'column',
    backgroundColor: 'transparent',
  },
  overlayTop: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  /** VPN-style capsule on the map (dark frosted pill, light text). */
  welcomePill: {
    alignItems: 'center',
    maxWidth: '100%',
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  welcomePillBgDark: {
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
  },
  welcomePillBgLight: {
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
  },
  welcomePillLiftLight: Platform.select({
    ios: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 18,
    },
    android: { elevation: 4 },
    default: {},
  }),
  welcomePillEyebrow: {
    fontSize: 10,
    letterSpacing: 0.85,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: 'rgba(248, 250, 252, 0.72)',
    marginBottom: 4,
  },
  welcomePillMain: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 21,
    color: '#F8FAFC',
    textAlign: 'center',
  },
  overlaySpacer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlayBottom: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg + 2,
  },
  mapImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  mapOverlayTint: {
    ...StyleSheet.absoluteFillObject,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
  },
  mapLoadingLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
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
    overflow: Platform.OS === 'android' ? 'hidden' : undefined,
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
  panelOuter: {
    width: '100%',
  },
  panelHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.md,
  },
  panel: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.md,
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
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
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
