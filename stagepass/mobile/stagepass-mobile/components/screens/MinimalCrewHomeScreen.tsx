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
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import { HomeHeader } from '@/components/HomeHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { api, getApiBase, type User as ApiUser } from '~/services/api';
import { setUser } from '~/store/authSlice';
import { haversineDistanceMeters, isWithinGeofence } from '~/utils/geofence';
import { buildVenueStaticMapPreviewUrls, mapPreviewImageSource } from '~/utils/staticMapPreview';
import {
  DEFAULT_OFFICE_CHECKIN_REQUIRED_DAYS,
  parseOfficeCheckinRequiredDays,
} from '@/src/utils/officeCheckinRequiredDays';
import { NAV_PRESSED_OPACITY } from '@/src/utils/navigationPress';

type Props = {
  onRefresh?: () => Promise<void>;
};

const MINIMAL_HOME_BG_IMAGE_URI = `${getApiBase()}/minimal-home-bg.png`;

/** Ripple rings + CTA share one center; cluster must fit scaled ring (~1.9×). */
const RIPPLE_BASE = 96;
const RIPPLE_CLUSTER = 200;
const RIPPLE_RING_INSET = (RIPPLE_CLUSTER - RIPPLE_BASE) / 2;

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

/** Backend may return ISO or `Y-m-d H:i:s`. */
function formatShortTime(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
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
  const [customBackgroundFailed, setCustomBackgroundFailed] = useState(false);
  const rippleA = useRef(new Animated.Value(0)).current;
  const rippleB = useRef(new Animated.Value(0)).current;
  /** Weekend map pin: gentle sway + wave pulse (beach motif). */
  const beachPhase = useRef(new Animated.Value(0)).current;

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
  const needsFirstOfficeCheckin =
    isCheckinRequiredToday && !officeCheckedInToday && !officeCheckedOutToday;
  const inExtraOfficeHours = user?.office_hours_status === 'in_extra_hours' && canCheckout;
  const mapCenter = useMemo(
    () =>
      officeConfig
        ? { latitude: officeConfig.latitude, longitude: officeConfig.longitude }
        : userLocation,
    [officeConfig, userLocation]
  );
  const mapUrls = useMemo(() => {
    if (!mapCenter) return [];
    const pr = PixelRatio.get();
    return buildVenueStaticMapPreviewUrls(mapCenter.latitude, mapCenter.longitude, {
      widthPx: Math.round(windowWidth * pr),
      heightPx: Math.round(windowHeight * pr),
    });
  }, [mapCenter, windowWidth, windowHeight]);
  const mapUrl = mapUrls[mapSourceIndex] ?? null;
  const heroBackgroundUri = customBackgroundFailed ? mapUrl : MINIMAL_HOME_BG_IMAGE_URI;

  const withinOffice = useMemo(() => {
    if (!officeConfig || !userLocation) return null;
    return isWithinGeofence(
      userLocation.latitude,
      userLocation.longitude,
      officeConfig.latitude,
      officeConfig.longitude,
      officeConfig.radiusMeters
    );
  }, [officeConfig, userLocation]);

  const metersFromOffice = useMemo(() => {
    if (!officeConfig || !userLocation) return null;
    return haversineDistanceMeters(
      userLocation.latitude,
      userLocation.longitude,
      officeConfig.latitude,
      officeConfig.longitude
    );
  }, [officeConfig, userLocation]);

  const geoHint = useMemo(() => {
    if (!needsFirstOfficeCheckin) return null;
    if (!officeConfig) {
      return { icon: 'business-outline' as const, text: 'Office location isn’t set yet — ask an admin.', tone: 'muted' as const };
    }
    if (!userLocation) {
      return { icon: 'navigate-outline' as const, text: 'Getting your location…', tone: 'muted' as const };
    }
    if (withinOffice === true) {
      return { icon: 'checkmark-circle-outline' as const, text: 'You’re within the office check-in area.', tone: 'ok' as const };
    }
    const m = metersFromOffice != null ? Math.round(metersFromOffice) : null;
    const radius = officeConfig.radiusMeters;
    return {
      icon: 'walk-outline' as const,
      text:
        m != null
          ? `About ${m}m from the pin — move within ${radius}m to check in.`
          : `Move within ${radius}m of the office to check in.`,
      tone: 'warn' as const,
    };
  }, [needsFirstOfficeCheckin, officeConfig, userLocation, withinOffice, metersFromOffice]);

  const welcomeFirstName = useMemo(() => {
    const n = user?.name?.trim();
    if (!n) return '';
    return n.split(/\s+/)[0] ?? '';
  }, [user?.name]);

  const timeGreeting = getTimeGreeting();


  const mapCardBg = isDark ? '#121723' : '#F4F6FA';
  const mapOverlayTintBg = isDark ? 'rgba(2,6,23,0.26)' : 'rgba(255,255,255,0.08)';
  const mapGridBorder = isDark ? '#64748B' : 'rgba(100, 116, 139, 0.28)';
  const mapGridOpacity = isDark ? 0.08 : 0.06;

  useEffect(() => {
    setMapSourceIndex(0);
  }, [mapCenter?.latitude, mapCenter?.longitude, windowWidth, windowHeight]);

  const buttonLabel = useMemo(() => {
    if (loading) return canCheckout ? 'Checking out...' : 'Checking in...';
    if (officeCheckedOutToday) return 'Done for today';
    if (canCheckout) return 'Office checkout';
    return 'Check in office';
  }, [loading, canCheckout, officeCheckedOutToday]);

  const subLabel = useMemo(() => {
    if (isWeekendOffDay) return 'Pick up again on your next scheduled workday.';
    if (isOfficeCheckinOffDay) return 'You don’t need to check in today.';
    if (officeCheckedOutToday) return 'See you tomorrow';
    if (canCheckout) return 'Tap to end office shift';
    return 'Tap to start shift';
  }, [officeCheckedOutToday, canCheckout, isOfficeCheckinOffDay, isWeekendOffDay]);

  const panelEyebrowText = useMemo(() => {
    if (!isOfficeCheckinOffDay) return 'OFFICE SHIFT';
    return isWeekendOffDay ? 'Weekend' : 'Day off';
  }, [isOfficeCheckinOffDay, isWeekendOffDay]);

  const panelTitleText = useMemo(() => {
    if (isOfficeCheckinOffDay) return 'No office check-in';
    return 'Check-in status';
  }, [isOfficeCheckinOffDay]);

  const offDayFooterCaption = useMemo(() => {
    if (isWeekendOffDay) return 'Check-in is paused Sat–Sun.';
    return 'Not required on this day.';
  }, [isWeekendOffDay]);

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

  useEffect(() => {
    if (!isWeekendOffDay) {
      beachPhase.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beachPhase, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(beachPhase, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [beachPhase, isWeekendOffDay]);

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

  const checkInTimeLabel = formatShortTime(user?.office_checkin_time);
  const checkOutTimeLabel = formatShortTime(user?.office_checkout_time);

  const geoHintIconColor =
    geoHint?.tone === 'ok' ? themeBlue : geoHint?.tone === 'warn' ? themeYellow : colors.textSecondary;

  const todayCaption = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    []
  );

  const welcomeMutedOnMap = isDark ? 'rgba(228, 228, 231, 0.96)' : colors.textSecondary;
  const welcomePrimaryOnMap = isDark ? '#FAFAFA' : colors.text;

  const nameAccentColor = isDark ? themeYellow : themeBlue;

  return (
    <ThemedView style={[styles.container, { backgroundColor: mapCardBg }]}>
      <View style={styles.screenRoot}>
        <View style={styles.mapLayer} collapsable={false}>
          <View style={[styles.mapHeroInner, { backgroundColor: mapCardBg }]} collapsable={false}>
            {heroBackgroundUri ? (
              <Image
                key={heroBackgroundUri ?? 'no-background'}
                source={heroBackgroundUri ? mapPreviewImageSource(heroBackgroundUri) : undefined}
                style={[styles.mapImage, { minWidth: windowWidth, minHeight: windowHeight }]}
                contentFit="cover"
                transition={0}
                cachePolicy="memory-disk"
                priority="high"
                allowDownscaling={false}
                onError={() => {
                  if (!customBackgroundFailed) {
                    setCustomBackgroundFailed(true);
                    return;
                  }
                  setMapSourceIndex((idx) => (idx + 1 < mapUrls.length ? idx + 1 : idx));
                }}
              />
            ) : null}
            <View style={[styles.mapOverlayTint, { backgroundColor: mapOverlayTintBg }]} />
            <View style={[styles.gridOverlay, { opacity: mapGridOpacity, borderColor: mapGridBorder }]} />
            {!heroBackgroundUri ? (
              <View style={styles.mapLoadingLayer} pointerEvents="none">
                <ActivityIndicator size="small" color={isDark ? themeYellow : themeBlue} />
                <ThemedText style={styles.mapLoadingCaption} maxFontSizeMultiplier={1.3}>
                  Locating map…
                </ThemedText>
              </View>
            ) : null}
            <View style={styles.centerActionWrap}>
              {!isOfficeCheckinOffDay ? (
                <View style={styles.pinRippleCluster} collapsable={false}>
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
                </View>
              ) : (
                <View
                  style={[
                    styles.centerCta,
                    !isDark && styles.centerCtaLight,
                    { backgroundColor: isDark ? themeYellow + '22' : themeYellow + '35', borderWidth: 1, borderColor: themeYellow + '55' },
                  ]}
                  accessibilityRole="image"
                  accessibilityLabel="Weekend — office check-in not available"
                >
                  {isWeekendOffDay ? (
                    <View style={styles.beachStack}>
                      <Animated.View
                        style={{
                          transform: [
                            {
                              translateY: beachPhase.interpolate({
                                inputRange: [0, 1],
                                outputRange: [3, -4],
                              }),
                            },
                            {
                              rotate: beachPhase.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['-7deg', '7deg'],
                              }),
                            },
                          ],
                        }}
                      >
                        <Ionicons name="umbrella" size={26} color={themeYellow} />
                      </Animated.View>
                      <Animated.View
                        style={[
                          styles.beachWaveRow,
                          {
                            transform: [
                              {
                                translateX: beachPhase.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [-3, 3],
                                }),
                              },
                              {
                                scaleX: beachPhase.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.92, 1.08],
                                }),
                              },
                            ],
                            opacity: beachPhase.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.82, 1],
                            }),
                          },
                        ]}
                      >
                        <Ionicons name="water" size={18} color={themeBlue} />
                      </Animated.View>
                    </View>
                  ) : (
                    <Ionicons name="sunny-outline" size={26} color={themeYellow} />
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.overlayStack} pointerEvents="box-none">
          <View style={[styles.overlayTop, { paddingTop: welcomePillTopPad }]} pointerEvents="none">
            <Reanimated.View
              entering={FadeInDown.duration(420).delay(40)}
              style={styles.welcomeTextBlock}
              accessibilityRole="header"
              accessibilityLabel={`Welcome back. ${timeGreeting}${welcomeFirstName ? `, ${welcomeFirstName}` : ''}. ${todayCaption}`}
            >
              <View
                style={[
                  styles.welcomeScrim,
                  {
                    backgroundColor: isDark ? 'rgba(2, 8, 20, 0.72)' : 'rgba(248, 250, 252, 0.92)',
                    borderColor: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(15, 23, 42, 0.08)',
                  },
                ]}
              >
                <View style={styles.welcomeRow}>
                  <View style={[styles.welcomeAccent, { backgroundColor: themeYellow }]} accessibilityElementsHidden />
                  <View style={styles.welcomeColumn}>
                    <View style={styles.welcomeEyebrowRow}>
                      <Ionicons name="sparkles" size={13} color={themeYellow} style={styles.welcomeEyebrowIcon} />
                      <Text
                        style={[styles.welcomeEyebrow, { color: welcomeMutedOnMap }]}
                        maxFontSizeMultiplier={1.35}
                      >
                        Welcome back
                      </Text>
                    </View>
                    <Text style={[styles.welcomeGreetingLine, { color: welcomePrimaryOnMap }]} maxFontSizeMultiplier={1.35}>
                      <Text style={styles.welcomeGreetingPhrase}>{timeGreeting}</Text>
                      {welcomeFirstName ? (
                        <Text style={[styles.welcomeGreetingSep, { color: welcomeMutedOnMap }]}> · </Text>
                      ) : null}
                      {welcomeFirstName ? (
                        <Text style={[styles.welcomeName, { color: nameAccentColor }]}>{welcomeFirstName}</Text>
                      ) : null}
                    </Text>
                    <Reanimated.View entering={FadeIn.duration(380).delay(140)}>
                      <Text style={[styles.welcomeDate, { color: welcomeMutedOnMap }]} maxFontSizeMultiplier={1.3}>
                        {todayCaption}
                      </Text>
                    </Reanimated.View>
                  </View>
                </View>
              </View>
            </Reanimated.View>
          </View>
          <View style={styles.overlaySpacer} pointerEvents="none" />
          <View style={[styles.overlayBottom, { paddingBottom: overlayBottomPad }]}>
            <Reanimated.View entering={FadeInUp.duration(460).delay(72)} style={styles.panelOuter}>
            <View
              style={[
                styles.panel,
                isOfficeCheckinOffDay && styles.panelOffDay,
                { backgroundColor: colors.surface, borderColor: isDark ? colors.border : themeBlue + '14' },
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
                {panelEyebrowText.toUpperCase()}
              </ThemedText>
              <ThemedText style={[styles.panelTitle, { color: colors.text }]}>
                {panelTitleText}
              </ThemedText>
              {inExtraOfficeHours ? (
                <View style={styles.extraHoursRow}>
                  <Ionicons name="time-outline" size={13} color={themeYellow} />
                  <ThemedText style={[styles.extraHoursText, { color: themeYellow }]} maxFontSizeMultiplier={1.25}>
                    Extra hours
                  </ThemedText>
                </View>
              ) : null}
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
              {isOfficeCheckinOffDay ? (
                <ThemedText
                  style={[styles.stateChipText, { color: themeYellow }]}
                  maxFontSizeMultiplier={1.2}
                >
                  Paused
                </ThemedText>
              ) : officeCheckedOutToday ? (
                <ThemedText
                  style={[styles.stateChipText, { color: themeBlue }]}
                  maxFontSizeMultiplier={1.2}
                >
                  Done
                </ThemedText>
              ) : canCheckout ? (
                <ThemedText
                  style={[styles.stateChipText, { color: themeBlue }]}
                  maxFontSizeMultiplier={1.2}
                >
                  Checked in
                </ThemedText>
              ) : (
                <View
                  accessibilityRole="image"
                  accessibilityLabel="Pending"
                  style={styles.stateChipIconWrap}
                >
                  <Ionicons name="hourglass-outline" size={15} color={themeYellow} />
                </View>
              )}
            </View>
          </View>

          <ThemedText
            style={[styles.panelSub, { color: colors.textSecondary }]}
            maxFontSizeMultiplier={1.35}
          >
            {subLabel}
          </ThemedText>

          {geoHint ? (
            <View style={styles.geoHintRow} accessibilityLiveRegion="polite">
              <Ionicons name={geoHint.icon} size={13} color={geoHintIconColor} />
              <ThemedText
                style={[styles.geoHintText, { color: geoHintIconColor }]}
                maxFontSizeMultiplier={1.35}
              >
                {geoHint.text}
              </ThemedText>
            </View>
          ) : null}

          {isOfficeCheckinOffDay ? (
            <View
              style={[
                styles.offDayFoot,
                {
                  backgroundColor: isDark ? 'rgba(234, 179, 8, 0.08)' : 'rgba(15, 24, 56, 0.04)',
                  borderColor: isDark ? 'rgba(234, 179, 8, 0.22)' : 'rgba(15, 24, 56, 0.1)',
                },
              ]}
              accessibilityRole="text"
              accessibilityLabel={offDayFooterCaption}
            >
              <Ionicons name="information-circle-outline" size={18} color={themeYellow} />
              <ThemedText style={[styles.offDayFootText, { color: colors.textSecondary }]}>
                {offDayFooterCaption}
              </ThemedText>
            </View>
          ) : (
            <>
              <View style={[styles.panelDivider, { backgroundColor: colors.border }]} />

              <Pressable
                onPress={onMainCtaPress}
                onPressIn={() => {
                  if (!mainCtaDisabled) triggerActionHaptic();
                }}
                disabled={mainCtaDisabled}
                android_ripple={
                  Platform.OS === 'android' && !mainCtaDisabled
                    ? { color: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.07)' }
                    : undefined
                }
                accessibilityRole="button"
                accessibilityLabel={
                  officeCheckedOutToday
                    ? 'Finished for today'
                    : canCheckout
                      ? 'Check out of office'
                      : 'Check in at office'
                }
                accessibilityState={{ disabled: mainCtaDisabled, busy: loading }}
                style={({ pressed }) => [
                  styles.primaryActionCard,
                  {
                    backgroundColor: officeCheckedOutToday
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
                    borderColor: officeCheckedOutToday
                      ? isDark
                        ? '#475569'
                        : '#CBD5E1'
                      : canCheckout
                        ? themeBlue + (isDark ? '55' : '40')
                        : themeYellow + (isDark ? '66' : '55'),
                    opacity: pressed && !mainCtaDisabled ? NAV_PRESSED_OPACITY : 1,
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color={canCheckout ? '#fff' : officeCheckedOutToday ? colors.textSecondary : themeBlue}
                  />
                ) : (
                  <Ionicons
                    name={officeCheckedOutToday ? 'checkmark-done-circle' : canCheckout ? 'exit-outline' : 'location'}
                    size={16}
                    color={
                      officeCheckedOutToday && isDark
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
                        officeCheckedOutToday && isDark
                          ? '#e2e8f0'
                          : officeCheckedOutToday
                            ? colors.textSecondary
                            : colors.text,
                    },
                  ]}
                >
                  {buttonLabel}
                </ThemedText>
                {!mainCtaDisabled ? (
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                ) : null}
              </Pressable>
            </>
          )}

          {(officeCheckedInToday || officeCheckedOutToday) ? (
            <View style={styles.statusRow}>
              <Ionicons
                name={officeCheckedOutToday ? 'checkmark-done-circle' : 'checkmark-circle'}
                size={14}
                color={themeBlue}
              />
              <ThemedText style={[styles.statusText, { color: colors.textSecondary }]}>
                {officeCheckedOutToday
                  ? `Checked out successfully${checkOutTimeLabel ? ` · ${checkOutTimeLabel}` : ''}`
                  : `Checked in successfully${checkInTimeLabel ? ` · ${checkInTimeLabel}` : ''}`}
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
    alignItems: 'stretch',
    width: '100%',
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'transparent',
  },
  welcomeTextBlock: {
    width: '100%',
    maxWidth: '100%',
    backgroundColor: 'transparent',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  welcomeScrim: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    width: '100%',
  },
  welcomeAccent: {
    width: 3,
    borderRadius: 2,
    minHeight: 48,
    alignSelf: 'stretch',
  },
  welcomeColumn: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 4,
  },
  welcomeEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  welcomeEyebrowIcon: {
    marginTop: 1,
    opacity: 0.95,
  },
  welcomeEyebrow: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    textTransform: 'uppercase',
    backgroundColor: 'transparent',
  },
  welcomeGreetingLine: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.35,
    lineHeight: 24,
    backgroundColor: 'transparent',
  },
  welcomeGreetingPhrase: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  welcomeGreetingSep: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 24,
  },
  welcomeName: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.25,
    lineHeight: 24,
  },
  welcomeDate: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
    backgroundColor: 'transparent',
  },
  overlaySpacer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlayBottom: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    gap: Spacing.sm,
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
    gap: 10,
  },
  mapLoadingCaption: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
    color: 'rgba(248, 250, 252, 0.88)',
  },
  extraHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  extraHoursText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  geoHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 0,
  },
  geoHintText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  panelDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginTop: 0,
    marginBottom: 0,
    opacity: 0.85,
  },
  pinWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Centers pin + ripples in the map; slight lift clears bottom sheet. */
  centerActionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 28,
  },
  /**
   * Fixed box so absolute ripples share the same center as the CTA.
   * (Ripples were top-left aligned before — RN absolute defaults without left/top.)
   */
  pinRippleCluster: {
    width: RIPPLE_CLUSTER,
    height: RIPPLE_CLUSTER,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  rippleRing: {
    position: 'absolute',
    width: RIPPLE_BASE,
    height: RIPPLE_BASE,
    borderRadius: RIPPLE_BASE / 2,
    borderWidth: 3,
    left: RIPPLE_RING_INSET,
    top: RIPPLE_RING_INSET,
  },
  centerCta: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: Platform.OS === 'android' ? 'hidden' : undefined,
  },
  centerCtaLight: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  beachStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  beachWaveRow: {
    marginTop: -10,
    alignItems: 'center',
  },
  panelOuter: {
    width: '100%',
  },
  panelHandle: {
    alignSelf: 'center',
    width: 32,
    height: 2,
    borderRadius: 2,
    marginBottom: Spacing.xs,
  },
  panel: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.sm,
    paddingTop: Spacing.sm + 2,
    gap: Spacing.xs + 2,
  },
  panelOffDay: {
    gap: Spacing.xs + 2,
    paddingBottom: Spacing.sm,
  },
  panelLight: {
    paddingVertical: Spacing.sm,
  },
  panelTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  panelEyebrow: {
    fontSize: 10,
    letterSpacing: 0.75,
    fontWeight: '700',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  stateChip: {
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    minHeight: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateChipIconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.25,
  },
  panelSub: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 0,
  },
  offDayFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  offDayFootText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  primaryActionCard: {
    marginTop: 0,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  primaryActionText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.15,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusText: {
    fontSize: 12,
  },
});
