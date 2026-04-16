import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HomeHeader } from '@/components/HomeHeader';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { useAppRole } from '~/hooks/useAppRole';
import { useGeofence } from '~/hooks/useGeofence';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';
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

function formatHoursLabel(hours: number): string {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const handleNav = useNavigationPress();
  const { colors, isDark } = useStagePassTheme();
  const insets = useSafeAreaInsets();
  const token = useSelector((s: { auth: { token: string | null } }) => s.auth.token);
  const currentUserId = useSelector((s: { auth: { user: { id?: number } | null } }) => s.auth.user?.id);
  const role = useAppRole();
  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [clockTick, setClockTick] = useState(0);
  const [extraNotified, setExtraNotified] = useState(false);
  const [leaderCheckInUserId, setLeaderCheckInUserId] = useState<number | null>(null);
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
  const pivotData = (myAssignment?.pivot ?? {}) as {
    checkin_time?: string;
    checkout_time?: string;
    total_hours?: number | null;
    extra_hours?: number | null;
    is_sunday?: boolean;
    is_holiday?: boolean;
    holiday_name?: string | null;
  };
  const checkoutTimeFormatted = formatCheckoutTime(checkoutTime as string | undefined);
  const myRoleInEvent = hasPivot && (myAssignment?.pivot as { role_in_event?: string | null })?.role_in_event;
  useEffect(() => {
    const interval = setInterval(() => setClockTick((v) => v + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const sessionStats = useMemo(() => {
    void clockTick;
    if (!checkinTime) {
      return { totalHours: 0, extraHours: 0, dayType: 'normal' as const };
    }

    const dayType = pivotData.is_holiday ? 'holiday' : (pivotData.is_sunday ? 'sunday' : 'normal');
    if (checkoutTime) {
      return {
        totalHours: Number(pivotData.total_hours ?? 0),
        extraHours: Number(pivotData.extra_hours ?? 0),
        dayType,
      };
    }

    const start = new Date(checkinTime).getTime();
    const now = Date.now();
    const minutes = Math.max(0, Math.floor((now - start) / 60000));
    const totalHours = minutes / 60;
    const extraHours = dayType === 'normal' ? Math.max(0, (minutes - 480) / 60) : totalHours;
    return { totalHours, extraHours, dayType };
  }, [checkinTime, checkoutTime, clockTick, pivotData.total_hours, pivotData.extra_hours, pivotData.is_holiday, pivotData.is_sunday]);

  useEffect(() => {
    if (extraNotified || checkoutTime || !checkinTime) return;
    if (sessionStats.extraHours > 0) {
      setExtraNotified(true);
      Alert.alert('Extra hours', 'Your extra hours have started.');
    }
  }, [checkinTime, checkoutTime, sessionStats.extraHours, extraNotified]);

  const teamLeader = event?.team_leader ?? event?.teamLeader;

  const canManageEventCrew = useMemo(() => {
    if (!event || currentUserId == null) return false;
    if (role === 'admin') return true;
    const assignedLeaderId = event.team_leader_id ?? teamLeader?.id;
    if (assignedLeaderId != null && Number(assignedLeaderId) === currentUserId) {
      return true;
    }
    if (role !== 'team_leader') return false;
    if (event.team_leader_id != null && event.team_leader_id !== undefined) {
      return false;
    }
    if (Number(event.created_by_id) === currentUserId) return true;
    return Boolean(event.crew?.some((c) => c.id === currentUserId));
  }, [event, currentUserId, role, teamLeader]);

  const crewAttendanceRows = useMemo(() => {
    if (!event?.crew?.length) return [];
    return event.crew.map((c) => {
      const p = c.pivot as { checkin_time?: string | null; checkout_time?: string | null; role_in_event?: string | null } | undefined;
      let status: 'pending' | 'checked_in' | 'checked_out' = 'pending';
      if (p?.checkout_time) status = 'checked_out';
      else if (p?.checkin_time) status = 'checked_in';
      return {
        id: c.id,
        name: c.name,
        status,
        roleInEvent: p?.role_in_event?.trim() ? p.role_in_event : null,
      };
    });
  }, [event?.crew]);

  const handleLeaderCheckInMember = async (userId: number) => {
    if (!event?.id) return;
    setLeaderCheckInUserId(userId);
    let lat: number | undefined;
    let lon: number | undefined;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
      }
      await api.attendance.checkinOnBehalf(event.id, userId, lat, lon);
      const updated = await api.events.get(event.id);
      setEvent(updated);
    } catch (e: unknown) {
      Alert.alert('Check-in failed', e instanceof Error ? e.message : 'Could not check in crew member.');
    } finally {
      setLeaderCheckInUserId(null);
    }
  };

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
      if ((role === 'team_leader' || role === 'admin') && canManageEventCrew) {
        Alert.alert(
          'Done for the Day?',
          'Are you done for the day?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Done for the Day',
              onPress: () =>
                router.push({
                  pathname: '/(tabs)/admin/events/[id]/operations',
                  params: { id: String(event.id) },
                }),
            },
          ]
        );
      }
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
    const scale = 1 + 0.72 * rippleProgress.value;
    const opacity = 0.9 * (1 - rippleProgress.value);
    return { transform: [{ scale }], opacity };
  });
  const rippleStyle2 = useAnimatedStyle(() => {
    const scale = 1 + 0.72 * rippleProgress2.value;
    const opacity = 0.9 * (1 - rippleProgress2.value);
    return { transform: [{ scale }], opacity };
  });

  if (loading || !event) {
    return (
      <ThemedView style={styles.container}>
        <HomeHeader title="Event details" notificationCount={0} />
        <View style={[styles.scrollWrapper, styles.loaderArea]}>
          <StagepassLoader message="Loading event…" fullScreen={false} />
        </View>
      </ThemedView>
    );
  }

  const isEventEnded = event.status === 'completed' || event.status === 'closed' || event.status === 'done_for_the_day';
  const locationLabel = event.location_name ?? 'No location';
  const timeLabel = formatEventTime(event.start_time);
  const dateLabel = formatEventDate(event.date);
  const locationQuery = [event.location_name, event.address].filter(Boolean).join(', ').trim();

  const handleOpenTasks = () => {
    handleNav(() => router.push('/(tabs)/tasks'));
  };

  const handleGetDirections = async () => {
    const destination = locationQuery || locationLabel;
    if (!destination || destination === 'No location') {
      Alert.alert('Directions unavailable', 'This event does not have a location yet.');
      return;
    }
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
    try {
      const canOpen = await Linking.canOpenURL(mapsUrl);
      if (!canOpen) {
        Alert.alert('Directions unavailable', 'Could not open maps on this device.');
        return;
      }
      await Linking.openURL(mapsUrl);
    } catch {
      Alert.alert('Directions unavailable', 'Could not open maps on this device.');
    }
  };

  const accent = isDark ? '#f8fafc' : '#0f172a';
  const cardSurface = isDark ? '#0f172a' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#dbeafe';
  const iconWrapBg = isDark ? themeYellow + '2a' : themeYellow + '18';
  const iconWrapBorder = isDark ? themeYellow + '56' : themeYellow + '38';
  const sectionIconBg = isDark ? themeBlue + '3d' : themeBlue + '22';

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="Event details" notificationCount={0} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={SlideInRight.duration(320)}>
          {/* Hero: event name */}
          <View style={[styles.heroCard, { backgroundColor: isDark ? '#111827' : '#f8fbff', borderColor: isDark ? '#475569' : '#93c5fd' }]}>
            <View style={[styles.heroIconWrap, { backgroundColor: iconWrapBg, borderColor: iconWrapBorder }]}>
              <Ionicons name="calendar" size={Icons.xl} color={themeYellow} />
            </View>
            <ThemedText style={[styles.eventName, { color: colors.text }]} numberOfLines={2}>{event.name}</ThemedText>
            <ThemedText style={[styles.heroDate, { color: colors.textSecondary }]}>{dateLabel}</ThemedText>
            <View style={styles.heroMetaRow}>
              <Pressable
                onPress={handleOpenTasks}
                style={({ pressed }) => [
                  styles.heroActionButton,
                  { backgroundColor: isDark ? '#3a2f00' : '#fff8db', borderColor: isDark ? '#facc15aa' : '#facc15' },
                  pressed && { opacity: NAV_PRESSED_OPACITY },
                ]}
              >
                <Ionicons name="checkmark-done-outline" size={15} color={themeYellow} />
                <ThemedText style={[styles.heroActionText, { color: themeYellow }]}>Tasks</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleGetDirections}
                style={({ pressed }) => [
                  styles.heroActionButton,
                  { backgroundColor: isDark ? '#102a4a' : '#e0edff', borderColor: isDark ? '#60a5fa' : '#3b82f6' },
                  pressed && { opacity: NAV_PRESSED_OPACITY },
                ]}
              >
                <Ionicons name="navigate-outline" size={15} color={themeBlue} />
                <ThemedText style={[styles.heroActionText, { color: isDark ? '#dbeafe' : themeBlue }]}>
                  Get Directions
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {/* Check-in / Check-out actions */}
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
            <View style={[styles.sectionTitleIconWrap, { backgroundColor: sectionIconBg }]}>
              <Ionicons name="location" size={Icons.small} color={themeYellow} />
            </View>
            <ThemedText style={[styles.sectionTitle, { color: accent }]}>Attendance</ThemedText>
          </View>
          <View style={[styles.attendanceCard, { backgroundColor: cardSurface, borderColor: cardBorder }]}>
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
                  <ThemedText style={[styles.checkedOutText, { color: colors.textSecondary }]}>
                    Total: {formatHoursLabel(sessionStats.totalHours)} · Extra: {formatHoursLabel(sessionStats.extraHours)} · {sessionStats.dayType === 'holiday' ? (pivotData.holiday_name || 'Holiday') : (sessionStats.dayType === 'sunday' ? 'Sunday' : 'Normal day')}
                  </ThemedText>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={handleCheckOut}
                disabled={actionLoading}
                style={({ pressed }) => [
                  styles.ctaButtonSecondary,
                  { borderColor: themeYellow, backgroundColor: isDark ? '#352d06' : '#fff7cc', opacity: actionLoading ? 0.7 : pressed ? 0.9 : 1 },
                ]}
              >
                <Ionicons name="exit-outline" size={Icons.header} color={themeYellow} />
                <ThemedText style={[styles.ctaButtonTextSecondary, { color: themeYellow }]}>
                  {actionLoading ? 'Checking out…' : 'Check out'}
                </ThemedText>
              </Pressable>
            )}
            </View>
            {checkinTime && !checkoutTime ? (
              <View style={[styles.liveHoursCard, { backgroundColor: isDark ? '#0b1220' : '#f1f5ff', borderColor: cardBorder }]}>
              <ThemedText style={[styles.liveHoursTitle, { color: colors.text }]}>Active session</ThemedText>
              <ThemedText style={[styles.liveHoursValue, { color: colors.textSecondary }]}>Time worked: {formatHoursLabel(sessionStats.totalHours)}</ThemedText>
              <ThemedText style={[styles.liveHoursValue, { color: sessionStats.extraHours > 0 ? '#f97316' : colors.textSecondary }]}>
                Extra hours: {formatHoursLabel(sessionStats.extraHours)}
              </ThemedText>
            </View>
            ) : null}
          </View>

          {/* Details section */}
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
            <View style={[styles.sectionTitleIconWrap, { backgroundColor: sectionIconBg }]}>
              <Ionicons name="information-circle-outline" size={Icons.small} color={themeYellow} />
            </View>
            <ThemedText style={[styles.sectionTitle, { color: accent }]}>Event details</ThemedText>
          </View>
          <View style={[styles.detailsCard, { backgroundColor: cardSurface, borderColor: cardBorder }]}>
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
              <View style={[styles.detailRow, { borderBottomColor: cardBorder }, teamLeader == null && myAssignment == null && styles.detailRowLast]}>
              <View style={[styles.detailIconWrap, { backgroundColor: iconWrapBg, borderColor: iconWrapBorder }]}>
                <Ionicons name="location-outline" size={Icons.small} color={themeYellow} />
              </View>
              <View style={styles.detailTextWrap}>
                <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>Venue</ThemedText>
                <ThemedText style={[styles.detailValue, { color: colors.text }]} numberOfLines={2}>{locationLabel}</ThemedText>
              </View>
            </View>
            {teamLeader ? (
              <View style={[styles.detailRow, { borderBottomColor: cardBorder }, myAssignment == null && styles.detailRowLast]}>
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
                <View style={[styles.sectionTitleIconWrap, { backgroundColor: sectionIconBg }]}>
                  <Ionicons name="document-text-outline" size={Icons.small} color={themeYellow} />
                </View>
                <ThemedText style={[styles.sectionTitle, { color: accent }]}>About</ThemedText>
              </View>
              <View style={[styles.descCard, { backgroundColor: cardSurface, borderColor: cardBorder }]}>
                <ThemedText style={[styles.desc, { color: colors.textSecondary }]}>{event.description}</ThemedText>
              </View>
            </>
          ) : null}

          {event.daily_allowance != null && event.daily_allowance > 0 ? (
            <>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
                <View style={[styles.sectionTitleIconWrap, { backgroundColor: sectionIconBg }]}>
                  <Ionicons name="wallet-outline" size={Icons.small} color={themeYellow} />
                </View>
                <ThemedText style={[styles.sectionTitle, { color: accent }]}>Allowance</ThemedText>
              </View>
              <View style={[styles.allowanceCard, { backgroundColor: cardSurface, borderColor: cardBorder }]}>
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

          {canManageEventCrew ? (
            <>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
                <View style={[styles.sectionTitleIconWrap, { backgroundColor: sectionIconBg }]}>
                  <Ionicons name="people-outline" size={Icons.small} color={themeYellow} />
                </View>
                <ThemedText style={[styles.sectionTitle, { color: accent }]}>Crew</ThemedText>
              </View>
              <Pressable
                onPress={() =>
                  handleNav(() =>
                    router.push({
                      pathname: '/(tabs)/admin/events/[id]/operations',
                      params: { id: String(event.id) },
                    })
                  )
                }
                style={({ pressed }) => [
                  styles.leadOpsCard,
                  { backgroundColor: cardSurface, borderColor: cardBorder },
                  pressed && { opacity: 0.92 },
                ]}
              >
                <View style={[styles.leadOpsIconWrap, { backgroundColor: iconWrapBg, borderColor: iconWrapBorder }]}>
                  <Ionicons name="briefcase-outline" size={Icons.standard} color={themeYellow} />
                </View>
                <View style={styles.leadOpsTextWrap}>
                  <ThemedText style={[styles.leadOpsTitle, { color: colors.text }]}>Event operations</ThemedText>
                  <ThemedText style={[styles.leadOpsSub, { color: colors.textSecondary }]}>
                    Onboard crew, check-in, and end event
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
              </Pressable>
            </>
          ) : null}

          {canManageEventCrew && !isEventEnded && crewAttendanceRows.length > 0 ? (
            <>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionTitleAccent, { backgroundColor: themeYellow }]} />
                <View style={[styles.sectionTitleIconWrap, { backgroundColor: iconWrapBg }]}>
                  <Ionicons name="people" size={Icons.small} color={themeYellow} />
                </View>
                <ThemedText style={[styles.sectionTitle, { color: accent }]}>Check in crew</ThemedText>
              </View>
              <View style={[styles.leaderCrewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ThemedText style={[styles.leaderCrewHint, { color: colors.textSecondary }]}>
                  Mark arrivals when someone cannot check in on their device or at the geofence.
                </ThemedText>
                {crewAttendanceRows.map((row, idx) => (
                  <View
                    key={row.id}
                    style={[
                      styles.leaderCrewRow,
                      { borderBottomColor: colors.border },
                      idx === crewAttendanceRows.length - 1 && styles.leaderCrewRowLast,
                    ]}
                  >
                    <View style={styles.leaderCrewRowInfo}>
                      <ThemedText style={[styles.leaderCrewName, { color: colors.text }]}>{row.name}</ThemedText>
                      {row.roleInEvent ? (
                        <ThemedText style={[styles.leaderCrewMeta, { color: colors.textSecondary }]}>{row.roleInEvent}</ThemedText>
                      ) : null}
                    </View>
                    {row.status === 'pending' ? (
                      <Pressable
                        onPress={() => handleLeaderCheckInMember(row.id)}
                        disabled={leaderCheckInUserId === row.id}
                        style={({ pressed }) => [
                          styles.leaderCheckInBtn,
                          { backgroundColor: themeYellow + '22', borderColor: themeYellow },
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        {leaderCheckInUserId === row.id ? (
                          <ActivityIndicator size="small" color={themeYellow} />
                        ) : (
                          <>
                            <Ionicons name="location" size={18} color={themeYellow} />
                            <ThemedText style={[styles.leaderCheckInBtnText, { color: themeYellow }]}>Check in</ThemedText>
                          </>
                        )}
                      </Pressable>
                    ) : row.status === 'checked_in' ? (
                      <View style={[styles.leaderStatusBadge, { backgroundColor: themeYellow + '22' }]}>
                        <Ionicons name="checkmark-circle" size={18} color={themeYellow} />
                        <ThemedText style={[styles.leaderStatusBadgeText, { color: themeYellow }]}>In</ThemedText>
                      </View>
                    ) : (
                      <ThemedText style={[styles.leaderCrewMeta, { color: colors.textSecondary }]}>Checked out</ThemedText>
                    )}
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollWrapper: { flex: 1 },
  loaderArea: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg },
  heroCard: {
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
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
  heroMetaRow: {
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  heroActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  heroActionText: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.buttonTextWeight,
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
  attendanceHint: {
    fontSize: Typography.bodySmall,
    marginBottom: Spacing.md,
    lineHeight: 18,
    textAlign: 'center',
  },
  attendanceCard: {
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  detailsCard: {
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
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
  leadOpsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  leadOpsIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  leadOpsTextWrap: { flex: 1, minWidth: 0 },
  leadOpsTitle: { fontSize: Typography.body, fontWeight: '700' },
  leadOpsSub: { fontSize: Typography.label, marginTop: 4, lineHeight: 18 },
  leaderCrewCard: {
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  leaderCrewHint: {
    fontSize: Typography.label,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  leaderCrewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  leaderCrewRowLast: {
    borderBottomWidth: 0,
  },
  leaderCrewRowInfo: { flex: 1, minWidth: 0 },
  leaderCrewName: { fontSize: Typography.body, fontWeight: '600' },
  leaderCrewMeta: { fontSize: 12, marginTop: 2 },
  leaderCheckInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  leaderCheckInBtnText: { fontSize: 13, fontWeight: '600' },
  leaderStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
  },
  leaderStatusBadgeText: { fontSize: 13, fontWeight: '600' },
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
    borderWidth: 4,
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
  liveHoursCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: Cards.borderRadius,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  liveHoursTitle: {
    fontSize: Typography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  liveHoursValue: {
    fontSize: Typography.bodySmall,
    marginTop: 2,
  },
});
