import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { api, type Event as EventType } from '~/services/api';
import { useGeofence } from '~/hooks/useGeofence';
import { AppHeader } from '@/components/AppHeader';
import { StagepassLoader } from '@/components/StagepassLoader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Cards, Icons, Typography } from '@/constants/ui';
import { BorderRadius, Spacing, StatusColors, themeBlue, themeYellow } from '@/constants/theme';
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
  const { colors, isDark } = useStagePassTheme();
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
  const myRoleInEvent = hasPivot && (myAssignment?.pivot as { role_in_event?: string | null })?.role_in_event;
  const teamLeader = event?.team_leader ?? event?.teamLeader;

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

  const rippleProgress = useSharedValue(0);
  const rippleProgress2 = useSharedValue(0);
  const rippleEasing = Easing.out(Easing.cubic);
  const RIPPLE_DURATION = 4800;
  useEffect(() => {
    if (checkinTime) {
      rippleProgress.value = withTiming(0);
      rippleProgress2.value = withTiming(0);
      return;
    }
    rippleProgress.value = withRepeat(
      withTiming(1, { duration: RIPPLE_DURATION, easing: rippleEasing }),
      -1,
      false
    );
    rippleProgress2.value = withDelay(
      RIPPLE_DURATION / 2,
      withRepeat(
        withTiming(1, { duration: RIPPLE_DURATION, easing: rippleEasing }),
        -1,
        false
      )
    );
  }, [checkinTime, rippleProgress, rippleProgress2]);

  const rippleStyle = useAnimatedStyle(() => {
    const scale = 1 + 0.55 * rippleProgress.value;
    const opacity = 0.7 * (1 - rippleProgress.value);
    return { transform: [{ scale }], opacity };
  });
  const rippleStyle2 = useAnimatedStyle(() => {
    const scale = 1 + 0.55 * rippleProgress2.value;
    const opacity = 0.7 * (1 - rippleProgress2.value);
    return { transform: [{ scale }], opacity };
  });

  if (loading || !event) {
    return <StagepassLoader message="Loading event…" fullScreen />;
  }

  const locationLabel = event.location_name ?? 'No location';
  const timeLabel = formatEventTime(event.start_time);
  const dateLabel = formatEventDate(event.date);

  const accent = colors.text;
  const iconWrapBg = themeYellow + '18';
  const iconWrapBorder = themeYellow + '38';

  return (
    <ThemedView style={styles.container}>
      <AppHeader title="Event details" showBack />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={SlideInRight.duration(320)}>
          {/* Hero: event name */}
          <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.heroIconWrap, { backgroundColor: iconWrapBg, borderColor: iconWrapBorder }]}>
              <Ionicons name="calendar" size={Icons.xl} color={themeYellow} />
            </View>
            <ThemedText style={[styles.eventName, { color: colors.text }]} numberOfLines={2}>{event.name}</ThemedText>
            <ThemedText style={[styles.heroDate, { color: colors.textSecondary }]}>{dateLabel}</ThemedText>
          </View>

          {/* Details section */}
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
            <View style={[styles.sectionTitleIconWrap, { backgroundColor: iconWrapBg }]}>
              <Ionicons name="information-circle-outline" size={Icons.small} color={themeYellow} />
            </View>
            <ThemedText style={[styles.sectionTitle, { color: accent }]}>Details</ThemedText>
          </View>
          <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {timeLabel ? (
              <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.detailIconWrap, { backgroundColor: iconWrapBg, borderColor: iconWrapBorder }]}>
                  <Ionicons name="time-outline" size={Icons.small} color={themeYellow} />
                </View>
                <View style={styles.detailTextWrap}>
                  <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>Time</ThemedText>
                  <ThemedText style={[styles.detailValue, { color: colors.text }]}>{timeLabel}</ThemedText>
                </View>
              </View>
            ) : null}
            <View style={[styles.detailRow, { borderBottomColor: colors.border }, teamLeader == null && myAssignment == null && styles.detailRowLast]}>
              <View style={[styles.detailIconWrap, { backgroundColor: iconWrapBg, borderColor: iconWrapBorder }]}>
                <Ionicons name="location-outline" size={Icons.small} color={themeYellow} />
              </View>
              <View style={styles.detailTextWrap}>
                <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>Venue</ThemedText>
                <ThemedText style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>{locationLabel}</ThemedText>
              </View>
            </View>
            {teamLeader ? (
              <View style={[styles.detailRow, { borderBottomColor: colors.border }, myAssignment == null && styles.detailRowLast]}>
                <View style={[styles.detailIconWrap, { backgroundColor: iconWrapBg, borderColor: iconWrapBorder }]}>
                  <Ionicons name="person-outline" size={Icons.small} color={themeYellow} />
                </View>
                <View style={styles.detailTextWrap}>
                  <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>Team leader</ThemedText>
                  <ThemedText style={[styles.detailValue, { color: colors.text }]}>{teamLeader.name}</ThemedText>
                </View>
              </View>
            ) : null}
            {myAssignment != null ? (
              <View style={[styles.detailRow, styles.detailRowLast]}>
                <View style={[styles.detailIconWrap, { backgroundColor: iconWrapBg, borderColor: iconWrapBorder }]}>
                  <Ionicons name="ribbon-outline" size={Icons.small} color={themeYellow} />
                </View>
                <View style={styles.detailTextWrap}>
                  <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>Your role</ThemedText>
                  <ThemedText style={[styles.detailValue, { color: colors.text }]}>
                    {myRoleInEvent && myRoleInEvent.trim() ? myRoleInEvent : 'Crew'}
                  </ThemedText>
                </View>
              </View>
            ) : null}
          </View>

          {event.description ? (
            <>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
                <View style={[styles.sectionTitleIconWrap, { backgroundColor: iconWrapBg }]}>
                  <Ionicons name="document-text-outline" size={Icons.small} color={themeYellow} />
                </View>
                <ThemedText style={[styles.sectionTitle, { color: accent }]}>About</ThemedText>
              </View>
              <View style={[styles.descCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ThemedText style={[styles.desc, { color: colors.textSecondary }]}>{event.description}</ThemedText>
              </View>
            </>
          ) : null}

          {event.daily_allowance != null && event.daily_allowance > 0 ? (
            <>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
                <View style={[styles.sectionTitleIconWrap, { backgroundColor: iconWrapBg }]}>
                  <Ionicons name="wallet-outline" size={Icons.small} color={themeYellow} />
                </View>
                <ThemedText style={[styles.sectionTitle, { color: accent }]}>Allowance</ThemedText>
              </View>
              <View style={[styles.allowanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.allowanceIconWrap, { backgroundColor: iconWrapBg, borderColor: iconWrapBorder }]}>
                  <Ionicons name="wallet-outline" size={Icons.standard} color={themeYellow} />
                </View>
                <View style={styles.allowanceTextWrap}>
                  <ThemedText style={[styles.allowanceValue, { color: colors.text }]}>
                    KES {Number(event.daily_allowance).toLocaleString()}
                  </ThemedText>
                  <ThemedText style={[styles.allowanceLabel, { color: colors.textSecondary }]}>Daily allowance</ThemedText>
                </View>
              </View>
            </>
          ) : null}

          {/* Check-in / Check-out actions */}
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: themeBlue }]} />
            <View style={[styles.sectionTitleIconWrap, { backgroundColor: themeBlue + '28' }]}>
              <Ionicons name="location" size={Icons.small} color={themeBlue} />
            </View>
            <ThemedText style={[styles.sectionTitle, { color: accent }]}>Attendance</ThemedText>
          </View>
          <View style={styles.actions}>
            {!checkinTime ? (
              <View style={styles.roundCheckInWrap}>
                <Animated.View style={styles.roundCheckInButtonWrap}>
<Animated.View style={[styles.rippleRing, { borderColor: isDark ? themeYellow : themeBlue }, rippleStyle]} pointerEvents="none" />
                <Animated.View style={[styles.rippleRing, { borderColor: isDark ? themeYellow : themeBlue }, rippleStyle2]} pointerEvents="none" />
                  <Pressable
                    onPress={handleCheckIn}
                    disabled={actionLoading || !userLocation}
                    style={({ pressed }) => [
                      styles.roundCheckInButton,
                      styles.roundCheckInButtonEvent,
                      (actionLoading || !userLocation) && styles.roundCheckInButtonDisabled,
                      (actionLoading || !userLocation) && { backgroundColor: themeBlue + '22' },
                      pressed && !actionLoading && userLocation && styles.roundCheckInButtonPressed,
                    ]}
                  >
                    {(actionLoading || !userLocation) ? (
                      <View style={styles.roundCheckInInner}>
                        <Ionicons name="location" size={Icons.standard} color={colors.textSecondary} />
                        <ThemedText style={[styles.roundCheckInLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                          {actionLoading ? 'Checking in…' : 'Getting location…'}
                        </ThemedText>
                        <ThemedText style={[styles.roundCheckInSub, { color: colors.textSecondary }]} numberOfLines={1}>AT VENUE</ThemedText>
                      </View>
                    ) : (
                      <LinearGradient colors={['#2563eb', '#1e3a5f', themeBlue]} style={styles.roundCheckInGradient}>
                        <Ionicons name="location" size={Icons.standard} color="#fff" />
                        <ThemedText style={[styles.roundCheckInLabel, { color: '#fff' }]} numberOfLines={1}>Check in</ThemedText>
                        <ThemedText style={[styles.roundCheckInSub, { color: 'rgba(255,255,255,0.95)' }]} numberOfLines={1}>AT VENUE</ThemedText>
                      </LinearGradient>
                    )}
                  </Pressable>
                </Animated.View>
              </View>
            ) : checkoutTime ? (
              <View style={[styles.checkedOutBadge, { backgroundColor: StatusColors.checkedIn + '18', borderColor: StatusColors.checkedIn + '44' }]}>
                <View style={[styles.checkedOutIconWrap, { backgroundColor: StatusColors.checkedIn + '28' }]}>
                  <Ionicons name="checkmark-done-circle" size={Icons.xl} color={StatusColors.checkedIn} />
                </View>
                <View style={styles.checkedOutTextWrap}>
                  <ThemedText style={[styles.checkedOutTitle, { color: StatusColors.checkedIn }]}>Shift complete</ThemedText>
                  <ThemedText style={[styles.checkedOutText, { color: colors.textSecondary }]}>
                    {checkoutTimeFormatted ? `Checked out at ${checkoutTimeFormatted}` : 'You’re checked out'}
                  </ThemedText>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={handleCheckOut}
                disabled={actionLoading}
                style={({ pressed }) => [
                  styles.ctaButtonSecondary,
                  { borderColor: themeYellow, backgroundColor: themeYellow + '12', opacity: actionLoading ? 0.7 : pressed ? 0.9 : 1 },
                ]}
              >
                <Ionicons name="exit-outline" size={Icons.header} color={themeYellow} />
                <ThemedText style={[styles.ctaButtonTextSecondary, { color: themeYellow }]}>
                  {actionLoading ? 'Checking out…' : 'Check out'}
                </ThemedText>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg },
  heroCard: {
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  eventName: {
    fontSize: Typography.titleCard,
    fontWeight: Typography.titleCardWeight,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  heroDate: {
    fontSize: Typography.bodySmall,
    letterSpacing: 0.2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitleAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  sectionTitleIconWrap: {
    width: 26,
    height: 26,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: Typography.titleSection,
    fontWeight: Typography.titleSectionWeight,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    flex: 1,
  },
  detailsCard: {
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  detailTextWrap: { flex: 1, minWidth: 0 },
  detailLabel: {
    fontSize: Typography.label,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: Typography.bodySmall,
    fontWeight: '500',
  },
  descCard: {
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  desc: {
    fontSize: Typography.bodySmall,
    lineHeight: 22,
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
  allowanceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  allowanceTextWrap: { flex: 1 },
  allowanceValue: { fontSize: Typography.body, fontWeight: Typography.buttonTextWeight },
  allowanceLabel: { fontSize: Typography.label, marginTop: 2 },
  actions: { marginTop: Spacing.sm, alignItems: 'center', marginBottom: Spacing.lg },
  roundCheckInWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  roundCheckInButtonWrap: {
    width: 96,
    height: 96,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  rippleRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    left: 0,
    top: 0,
    borderWidth: 3,
    backgroundColor: 'transparent',
  },
  roundCheckInButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: themeBlue,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: themeBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  roundCheckInButtonEvent: {
    shadowColor: themeBlue,
    shadowOpacity: 0.4,
  },
  roundCheckInButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  roundCheckInButtonDisabled: {
    backgroundColor: themeBlue + '22',
    shadowOpacity: 0.08,
  },
  roundCheckInInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundCheckInGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
  },
  roundCheckInLabel: {
    fontSize: 12,
    fontWeight: Typography.titleCardWeight,
    color: themeBlue,
    marginTop: 4,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  roundCheckInSub: {
    fontSize: 7,
    fontWeight: Typography.statLabelWeight,
    marginTop: 1,
    letterSpacing: 0.2,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
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
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
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
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    width: '100%',
    maxWidth: 320,
  },
  checkedOutIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedOutTextWrap: { flex: 1 },
  checkedOutTitle: {
    fontSize: Typography.buttonText,
    fontWeight: Typography.titleCardWeight,
    marginBottom: 2,
  },
  checkedOutText: {
    fontSize: Typography.bodySmall,
  },
});
