/**
 * Enterprise home dashboard: minimal header, welcome card, quick actions grid,
 * today's events, role-based visibility. Proportional spacing, soft shadows, clear hierarchy.
 * Enhanced UX: staggered entrance animations, smooth scroll, refined visuals.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import AnimatedReanimated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import type { RoleName } from '~/services/api';
import { CrewAttendanceStatistic } from '@/components/CrewAttendanceStatistic';
import { HomeHeader } from '@/components/HomeHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LinearGradient } from 'expo-linear-gradient';
import { BorderRadius, Spacing, StatusColors, themeBlue, themeYellow, VibrantColors, VibrantColorsList } from '@/constants/theme';
import { getOfficeCheckinConfig } from '@/constants/officeCheckin';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useGeofence } from '~/hooks/useGeofence';
import { api, type User as ApiUser, type Payment } from '~/services/api';
import type { Event as EventType } from '~/services/api';
import { isWithinGeofence } from '~/utils/geofence';

/* Scaled-down spacing and radii */
const U = { xs: 6, sm: 8, md: 12, lg: 14, xl: 16, section: 24 };
const CARD_RADIUS = 12;
const CARD_RADIUS_SM = 10;
const TAB_BAR_HEIGHT = 58;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return '';
  try {
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m || '00'} ${ampm}`;
  } catch {
    return timeStr;
  }
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    admin: 'Admin',
    team_leader: 'Team Leader',
    accountant: 'Accountant',
    logistics: 'Logistics',
    operations: 'Operations',
    crew: 'Crew',
  };
  return map[role] ?? role;
}

type Props = {
  eventToday?: EventType | null;
  eventsTodayList?: EventType[];
  taskCount?: number;
  notificationCount?: number;
  onRefresh?: () => Promise<void>;
  role: RoleName;
  pastEvents?: EventType[];
  /** Crew: today's allowance (e.g. from settings). Optional. */
  allowanceToday?: string | number | null;
  /** Crew: assigned equipment/checklist count. Optional. */
  equipmentCount?: number;
  /** Approved payments/allowances (from http://localhost:3000/approvals). Shown under Allowances for crew/team_leader. */
  approvedAllowances?: Payment[];
};

type QuickAction = { id: string; label: string; icon: keyof typeof Ionicons.glyphMap; href: string; roles?: RoleName[] };

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'create', label: 'Create Event', icon: 'add-circle', href: '/admin/events/create', roles: ['admin'] },
  { id: 'events', label: 'My Events', icon: 'calendar', href: '/(tabs)/events' },
  { id: 'checkin', label: 'Crew Check-in', icon: 'location', href: '/(tabs)/events', roles: ['crew', 'team_leader'] },
  { id: 'activity', label: 'Activities', icon: 'notifications', href: '/(tabs)/activity' },
  { id: 'requestoff', label: 'Request off', icon: 'time-outline', href: '/admin/timeoff' },
  { id: 'managecheckin', label: 'Manage check-in', icon: 'location', href: '/admin/manage-checkin', roles: ['admin', 'team_leader'] },
  { id: 'checklist', label: 'Checklist', icon: 'checkbox', href: '/admin/checklists', roles: ['admin', 'team_leader'] },
  { id: 'equipment', label: 'Equipment', icon: 'cube', href: '/admin/equipment', roles: ['admin', 'logistics'] },
  { id: 'reports', label: 'Reports', icon: 'bar-chart', href: '/admin/reports', roles: ['admin'] },
];

function useCurrentTime(intervalMs: number = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function HomeDashboardScreen({
  eventToday,
  eventsTodayList = [],
  taskCount = 0,
  notificationCount = 0,
  onRefresh,
  role,
  pastEvents = [],
  allowanceToday = null,
  equipmentCount = 0,
  approvedAllowances = [],
}: Props) {
  const router = useRouter();
  const { colors, isDark } = useStagePassTheme();
  const iconColor = isDark ? themeYellow : themeBlue;
  const iconOutlineColor = isDark ? themeYellow : themeBlue;
  const user = useSelector((s: { auth: { user: ApiUser | null } }) => s.auth.user);
  const userName = (user?.name ?? '').trim();
  const displayName = userName ? userName.split(/\s+/)[0] : '';
  const currentTime = useCurrentTime(30_000);
  const timeLabel = currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [officeCheckinWindow, setOfficeCheckinWindow] = useState<{ start: string; end: string }>({ start: '09:00', end: '10:00' });
  const [officeConfigFromApi, setOfficeConfigFromApi] = useState<{ latitude: number; longitude: number; radiusMeters: number } | null>(null);
  const [officeCheckinStep, setOfficeCheckinStep] = useState<'idle' | 'checking_in' | 'location_confirmed' | 'you_made_it'>('idle');
  const [officeCheckoutStep, setOfficeCheckoutStep] = useState<'idle' | 'checking_out' | 'success_thankyou' | 'see_you'>('idle');
  const [optimisticOfficeCheckedIn, setOptimisticOfficeCheckedIn] = useState(false);
  const [optimisticOfficeCheckinTime, setOptimisticOfficeCheckinTime] = useState<string | null>(null);
  const scrollBottomPadding = TAB_BAR_HEIGHT;
  const { checkCanCheckIn } = useGeofence();
  const officeConfig = officeConfigFromApi ?? getOfficeCheckinConfig();
  const officeCheckedInToday = (user?.office_checked_in_today ?? false) || optimisticOfficeCheckedIn;
  const officeCheckedOutToday = user?.office_checked_out_today ?? false;
  const showCheckoutCta = officeCheckedInToday && !officeCheckedOutToday;
  function getSeeYouMessage(): string {
    return new Date().getDay() === 5 ? 'See you Monday' : 'See you tomorrow';
  }
  const officeCheckinButtonLabel = (() => {
    if (officeCheckoutStep === 'checking_out') return { label: 'Checking out..', sub: '' };
    if (officeCheckoutStep === 'success_thankyou') return { label: 'Success, Thank You', sub: '' };
    if (officeCheckoutStep === 'see_you') return { label: getSeeYouMessage(), sub: '' };
    if (showCheckoutCta && officeCheckoutStep === 'idle') return { label: 'Checkout now!', sub: 'Tap to end your shift' };
    if (officeCheckinStep === 'checking_in') return { label: 'Checking in…', sub: 'Getting location' };
    if (officeCheckinStep === 'location_confirmed') return { label: 'Location confirmed', sub: 'Confirming check-in…' };
    if (officeCheckinStep === 'you_made_it') return { label: 'You made it in !!', sub: 'Welcome to the office' };
    return { label: 'Check in office', sub: 'TAP TO START SHIFT' };
  })();
  const officeCheckinSecondaryCta = officeCheckoutStep !== 'idle'
    ? (officeCheckoutStep === 'checking_out' ? 'Checking out..' : officeCheckoutStep === 'success_thankyou' ? 'Success, Thank You' : getSeeYouMessage())
    : showCheckoutCta
      ? 'Checkout now!'
      : officeCheckinStep === 'checking_in'
        ? 'Checking in…'
        : officeCheckinStep === 'location_confirmed'
          ? 'Location confirmed'
          : officeCheckinStep === 'you_made_it'
            ? 'You made it in !!'
            : 'Check in office';
  const hasApprovedTimeOffToday = user?.has_approved_time_off_today ?? false;
  // Default to true when unknown so crew see office check-in unless backend explicitly marks them temporary
  const isPermanentEmployee = user?.is_permanent_employee !== false;

  useEffect(() => {
    api.settings.getOfficeCheckinConfig().then((s) => {
      setOfficeCheckinWindow({
        start: s?.office_checkin_start_time ?? '09:00',
        end: s?.office_checkin_end_time ?? '10:00',
      });
      const lat = s?.office_latitude;
      const lng = s?.office_longitude;
      const radius = s?.office_radius_m ?? 30;
      if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
        setOfficeConfigFromApi({ latitude: lat, longitude: lng, radiusMeters: radius > 0 ? radius : 30 });
      } else {
        setOfficeConfigFromApi(null);
      }
    }).catch(() => {});
  }, []);

  const myAssignment = eventToday?.crew?.find((c: { pivot?: unknown }) => c.pivot);
  const pivotData = myAssignment && typeof myAssignment === 'object' && 'pivot' in myAssignment
    ? (myAssignment.pivot as { checkin_time?: string; checkout_time?: string })
    : undefined;
  const hasEventCheckedIn = !!(pivotData?.checkin_time);
  const hasEventCheckedOut = !!(pivotData?.checkout_time);
  const hasCheckedIn = hasEventCheckedIn || officeCheckedInToday;
  const checkinTimeStr = (() => {
    if (pivotData?.checkin_time) {
      try {
        const t = new Date(pivotData.checkin_time);
        return t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      } catch {
        return pivotData.checkin_time;
      }
    }
    if (user?.office_checkin_time) {
      try {
        const t = new Date(user.office_checkin_time);
        return t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      } catch {
        return user.office_checkin_time;
      }
    }
    return '';
  })();
  const checkoutTimeStr = (() => {
    if (pivotData?.checkout_time) {
      try {
        const t = new Date(pivotData.checkout_time);
        return t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      } catch {
        return pivotData.checkout_time;
      }
    }
    return '';
  })();

  const recentCheckinActivities = ((): { key: string; title: string; sub: string; time: string; timeIso: string; icon: 'location' | 'exit' | 'checkmark-circle' }[] => {
    const items: { key: string; title: string; sub: string; time: string; timeIso: string; icon: 'location' | 'exit' | 'checkmark-circle' }[] = [];
    const officeCheckinTime = user?.office_checkin_time ?? optimisticOfficeCheckinTime;
    if (officeCheckinTime) {
      try {
        const t = new Date(user.office_checkin_time);
        items.push({
          key: 'office-checkin',
          title: 'Office check-in',
          sub: 'Daily shift started',
          time: t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          timeIso: user.office_checkin_time,
          icon: 'location',
        });
      } catch {
        items.push({ key: 'office-checkin', title: 'Office check-in', sub: 'Daily shift started', time: '—', timeIso: officeCheckinTime, icon: 'location' });
      }
    }
    if (user?.office_checkout_time) {
      try {
        const t = new Date(user.office_checkout_time);
        items.push({
          key: 'office-checkout',
          title: 'Office checkout',
          sub: 'Shift ended',
          time: t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          timeIso: user.office_checkout_time,
          icon: 'exit',
        });
      } catch {
        items.push({ key: 'office-checkout', title: 'Office checkout', sub: 'Shift ended', time: '—', timeIso: user.office_checkout_time, icon: 'exit' });
      }
    }
    if (pivotData?.checkin_time && eventToday?.name) {
      try {
        const t = new Date(pivotData.checkin_time);
        items.push({
          key: 'event-checkin',
          title: `Checked in: ${eventToday.name}`,
          sub: 'Event',
          time: t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          timeIso: pivotData.checkin_time,
          icon: 'checkmark-circle',
        });
      } catch {
        items.push({ key: 'event-checkin', title: `Checked in: ${eventToday.name}`, sub: 'Event', time: '—', timeIso: pivotData.checkin_time, icon: 'checkmark-circle' });
      }
    }
    if (pivotData?.checkout_time && eventToday?.name) {
      try {
        const t = new Date(pivotData.checkout_time);
        items.push({
          key: 'event-checkout',
          title: `Checked out: ${eventToday.name}`,
          sub: 'Event',
          time: t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          timeIso: pivotData.checkout_time,
          icon: 'exit',
        });
      } catch {
        items.push({ key: 'event-checkout', title: `Checked out: ${eventToday.name}`, sub: 'Event', time: '—', timeIso: pivotData.checkout_time, icon: 'exit' });
      }
    }
    items.sort((a, b) => new Date(b.timeIso).getTime() - new Date(a.timeIso).getTime());
    return items;
  })();

  const isWithinOfficeCheckinWindow = ((): boolean => {
    const [startH, startM] = officeCheckinWindow.start.split(':').map(Number);
    const [endH, endM] = officeCheckinWindow.end.split(':').map(Number);
    const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    const windowStartMins = startH * 60 + (startM || 0);
    const windowEndMins = endH * 60 + (endM || 0);
    return nowMins >= windowStartMins && nowMins <= windowEndMins;
  })();

  useEffect(() => {
    if (role !== 'crew' && role !== 'team_leader') return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {
        // ignore
      }
    })();
  }, [role]);

  /** Office check-in only: confirm user has entered the office (geofence from admin settings). */
  const handleOfficeCheckIn = useCallback(async () => {
    if (checkInLoading) return;
    let location = userLocation;
    setCheckInLoading(true);
    setOfficeCheckinStep('checking_in');
    if (!location) {
      try {
        const loc = await Location.getCurrentPositionAsync({});
        location = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(location);
      } catch {
        Alert.alert('Location needed', 'Enable location access to check in at the office.');
        setCheckInLoading(false);
        setOfficeCheckinStep('idle');
        return;
      }
    }
    if (!location) {
      setCheckInLoading(false);
      setOfficeCheckinStep('idle');
      return;
    }

    if (!officeConfig) {
      Alert.alert(
        'Office not configured',
        'Your admin has not set the office check-in location yet. Ask them to set it in Settings.'
      );
      setCheckInLoading(false);
      setOfficeCheckinStep('idle');
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
      Alert.alert(
        'Not at office',
        `You must be within ${officeConfig.radiusMeters}m of the office to check in. Please go to the check-in location.`
      );
      setCheckInLoading(false);
      setOfficeCheckinStep('idle');
      return;
    }

    setOfficeCheckinStep('location_confirmed');
    try {
      const res = await api.attendance.officeCheckin(location.latitude, location.longitude);
      setOptimisticOfficeCheckedIn(true);
      if (res?.checkin_time) setOptimisticOfficeCheckinTime(res.checkin_time);
      setOfficeCheckinStep('you_made_it');
      await new Promise((r) => setTimeout(r, 1400));
      await onRefresh?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Try again.';
      if (String(msg).includes('Already checked in today')) {
        setOptimisticOfficeCheckedIn(true);
        await onRefresh?.();
        setOfficeCheckinStep('you_made_it');
        await new Promise((r) => setTimeout(r, 800));
      } else if (String(msg).includes('404') || String(msg).includes('Not Found')) {
        Alert.alert(
          'Office check-in',
          'Server does not support office check-in yet. You are within the office radius.'
        );
      } else {
        Alert.alert('Check-in failed', msg);
      }
    } finally {
      setCheckInLoading(false);
      setOfficeCheckinStep('idle');
    }
  }, [userLocation, checkInLoading, onRefresh, officeConfig]);

  const handleOfficeCheckOut = useCallback(async () => {
    if (checkInLoading) return;
    setCheckInLoading(true);
    setOfficeCheckoutStep('checking_out');
    try {
      await api.attendance.officeCheckout();
      setOfficeCheckoutStep('success_thankyou');
      await new Promise((r) => setTimeout(r, 1200));
      setOfficeCheckoutStep('see_you');
      await new Promise((r) => setTimeout(r, 1600));
      await onRefresh?.();
    } catch (e: unknown) {
      Alert.alert('Checkout failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setCheckInLoading(false);
      setOfficeCheckoutStep('idle');
    }
  }, [checkInLoading, onRefresh]);

  const handleCheckOut = useCallback(() => {
    if (!eventToday || hasEventCheckedOut || checkInLoading) return;
    Alert.alert(
      'Check out',
      'Are you sure you want to check out from this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check out',
          onPress: async () => {
            setCheckInLoading(true);
            try {
              await api.attendance.checkout(eventToday.id);
              await onRefresh?.();
            } catch (e: unknown) {
              Alert.alert('Check-out failed', e instanceof Error ? e.message : 'Try again.');
            } finally {
              setCheckInLoading(false);
            }
          },
        },
      ]
    );
  }, [eventToday, hasEventCheckedOut, checkInLoading, onRefresh]);

  const handleCheckIn = useCallback(async () => {
    if (checkInLoading) return;
    let location = userLocation;
    if (!location) {
      setCheckInLoading(true);
      try {
        const loc = await Location.getCurrentPositionAsync({});
        location = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(location);
      } catch {
        Alert.alert('Location needed', 'Enable location access to check in.');
        setCheckInLoading(false);
        return;
      }
      setCheckInLoading(false);
    }
    if (!location) return;

    if (eventToday && !hasEventCheckedIn) {
      const eventLat = eventToday.latitude ?? null;
      const eventLon = eventToday.longitude ?? null;
      const radius = eventToday.geofence_radius ?? 100;
      const { allowed, message } = checkCanCheckIn(location, eventLat, eventLon, radius);
      if (!allowed) {
        Alert.alert('Check-in not allowed', message);
        return;
      }
      setCheckInLoading(true);
      try {
        await api.attendance.checkin(eventToday.id, location.latitude, location.longitude);
        await onRefresh?.();
      } catch (e: unknown) {
        Alert.alert('Check-in failed', e instanceof Error ? e.message : 'Try again.');
      } finally {
        setCheckInLoading(false);
        return;
      }
    }

    if (officeConfig) {
      const within = isWithinGeofence(
        location.latitude,
        location.longitude,
        officeConfig.latitude,
        officeConfig.longitude,
        officeConfig.radiusMeters
      );
      if (!within) {
        Alert.alert(
          'Not at office',
          `Daily check-in is only available within ${officeConfig.radiusMeters}m of the office. Please go to the check-in location.`
        );
        return;
      }
      setCheckInLoading(true);
      try {
        await api.attendance.officeCheckin(location.latitude, location.longitude);
        await onRefresh?.();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Try again.';
        if (String(msg).includes('404') || String(msg).includes('Not Found')) {
          Alert.alert(
            'Office check-in',
            'Server does not support office check-in yet. You are within the 30m radius.'
          );
        } else {
          Alert.alert('Check-in failed', msg);
        }
      } finally {
        setCheckInLoading(false);
        return;
      }
    }

    router.push('/(tabs)/events');
  }, [eventToday, hasEventCheckedIn, userLocation, checkInLoading, checkCanCheckIn, onRefresh, officeConfig, router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh?.();
    setRefreshing(false);
  }, [onRefresh]);

  useEffect(() => {
    if (user?.office_checked_out_today === true) {
      setOptimisticOfficeCheckedIn(false);
      setOptimisticOfficeCheckinTime(null);
    } else if (user?.office_checkin_time) {
      setOptimisticOfficeCheckinTime(null);
    }
  }, [user?.office_checked_out_today, user?.office_checkin_time]);

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const eventsTodayCount = eventsTodayList.length;

  const visibleQuickActions = QUICK_ACTIONS.filter((a) => {
    if (!a.roles) return true;
    if (a.id === 'checkin' && eventToday && !hasEventCheckedIn) return a.roles.includes(role);
    return a.roles.includes(role);
  });

  const rippleProgress = useSharedValue(0);
  const rippleProgress2 = useSharedValue(0);
  const rippleEasing = Easing.out(Easing.cubic);
  const RIPPLE_DURATION = 4800;

  useEffect(() => {
    if (hasCheckedIn) {
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
  }, [hasCheckedIn, rippleProgress, rippleProgress2]);

  const rippleStyle = useAnimatedStyle(() => {
    const scale = 1 + 0.55 * rippleProgress.value;
    const opacity = 0.7 * (1 - rippleProgress.value);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  const rippleStyle2 = useAnimatedStyle(() => {
    const scale = 1 + 0.55 * rippleProgress2.value;
    const opacity = 0.7 * (1 - rippleProgress2.value);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <ThemedView style={styles.container}>
      <HomeHeader notificationCount={notificationCount} />
      <View style={styles.scrollWrapper}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          decelerationRate="normal"
          {...(Platform.OS === 'android' && { overScrollMode: 'always' as const })}
          bounces={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={themeYellow}
              colors={[themeYellow]}
            />
          }
        >
        {/* Welcome / Status card – elegant, clear hierarchy */}
        <AnimatedReanimated.View
          entering={FadeInDown.duration(420).delay(0)}
          style={[styles.welcomeCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftWidth: 5, borderLeftColor: themeYellow }]}
        >
          <ThemedText style={[styles.welcomeGreeting, { color: colors.text }]}>
            Welcome{displayName ? `, ${displayName}` : ''}
          </ThemedText>
          <ThemedText style={[styles.welcomeMeta, { color: colors.textSecondary }]}>
            {eventsTodayCount === 0
              ? 'No events scheduled for today.'
              : `You have ${eventsTodayCount} event${eventsTodayCount !== 1 ? 's' : ''} scheduled for today.`}
          </ThemedText>
          <ThemedText style={[styles.welcomeMetaBold, { color: colors.text }]}>
            {roleLabel(role)} · {todayLabel} · {timeLabel}
          </ThemedText>
          <View style={styles.statusRow}>
            <View style={[styles.statusChip, { backgroundColor: VibrantColors.sky + '22', borderColor: VibrantColors.sky + '55' }]}>
              <Ionicons name="calendar" size={12} color={VibrantColors.sky} />
              <ThemedText style={[styles.statusChipText, { color: VibrantColors.sky }]} numberOfLines={1} ellipsizeMode="tail">
                {eventsTodayCount} event{eventsTodayCount !== 1 ? 's' : ''}
              </ThemedText>
            </View>
            <View style={[styles.statusChip, { backgroundColor: VibrantColors.amber + '22', borderColor: VibrantColors.amber + '55' }]}>
              <Ionicons name="checkbox" size={12} color={VibrantColors.amber} />
              <ThemedText style={[styles.statusChipText, { color: VibrantColors.amber }]} numberOfLines={1} ellipsizeMode="tail">
                {taskCount} task{taskCount !== 1 ? 's' : ''}
              </ThemedText>
            </View>
            <View style={[styles.statusChip, { backgroundColor: VibrantColors.violet + '22', borderColor: VibrantColors.violet + '55' }]}>
              <Ionicons name="notifications-outline" size={12} color={VibrantColors.violet} />
              <ThemedText style={[styles.statusChipText, { color: VibrantColors.violet }]} numberOfLines={1} ellipsizeMode="tail">
                {notificationCount} notice{notificationCount !== 1 ? 's' : ''}
              </ThemedText>
            </View>
          </View>
        </AnimatedReanimated.View>

        {/* Main CTA: Event check-in / check-out (when event today), or Daily (office) check-in. Daily check-in hidden when user has approved time off today. */}
        {(role === 'crew' || role === 'team_leader' || role === 'admin') && (
          <AnimatedReanimated.View entering={FadeInDown.duration(380).delay(50)} style={styles.dailyCheckInSection}>
            {eventToday ? (
              /* Event day: Check-in → Check-out (with confirm) → Checked out */
              <>
              {hasEventCheckedOut ? (
                <View style={[styles.dailyCheckInStatus, { backgroundColor: StatusColors.checkedIn + '18', borderColor: StatusColors.checkedIn + '44' }]}>
                  <Ionicons name="checkmark-done-circle" size={24} color={StatusColors.checkedIn} />
                  <ThemedText style={[styles.dailyCheckInStatusText, { color: StatusColors.checkedIn }]}>
                    Checked out
                  </ThemedText>
                  {checkoutTimeStr && (
                    <ThemedText style={[styles.dailyCheckInTime, { color: colors.textSecondary }]}>{checkoutTimeStr}</ThemedText>
                  )}
                </View>
              ) : hasEventCheckedIn ? (
                <View style={styles.roundCheckInWrap}>
                  <AnimatedReanimated.View style={styles.roundCheckInButtonWrap}>
                    <Pressable
                      onPress={handleCheckOut}
                      disabled={checkInLoading}
                      style={({ pressed }) => [
                        styles.roundCheckInButton,
                        styles.roundCheckInButtonCheckOut,
                        checkInLoading && styles.roundCheckInButtonDisabled,
                        pressed && !checkInLoading && styles.roundCheckInButtonPressed,
                      ]}
                    >
                      <LinearGradient colors={[themeBlue, '#1e3a5f', '#0f1838']} style={styles.roundCheckInGradient}>
                        <Ionicons name="exit-outline" size={32} color="#fff" />
                        <ThemedText style={[styles.roundCheckInLabel, { color: '#fff' }]}>
                          {checkInLoading ? 'Checking out…' : 'Check out'}
                        </ThemedText>
                        <ThemedText style={[styles.roundCheckInSub, { color: 'rgba(255,255,255,0.95)' }]}>
                          TAP TO END SHIFT
                        </ThemedText>
                      </LinearGradient>
                    </Pressable>
                  </AnimatedReanimated.View>
                </View>
              ) : (
                <View style={styles.roundCheckInWrap}>
                  <AnimatedReanimated.View style={styles.roundCheckInButtonWrap}>
                    <AnimatedReanimated.View style={[styles.rippleRing, { borderColor: themeYellow }, rippleStyle]} pointerEvents="none" />
                    <AnimatedReanimated.View style={[styles.rippleRing, { borderColor: themeYellow }, rippleStyle2]} pointerEvents="none" />
                    <Pressable
                      onPress={handleCheckIn}
                      disabled={checkInLoading}
                      style={({ pressed }) => [
                        styles.roundCheckInButton,
                        checkInLoading && styles.roundCheckInButtonDisabled,
                        checkInLoading && { backgroundColor: isDark ? themeYellow + '35' : themeBlue + '18' },
                        pressed && !checkInLoading && styles.roundCheckInButtonPressed,
                      ]}
                    >
                      {checkInLoading ? (
                        <View style={styles.roundCheckInInner}>
                          <Ionicons name="location" size={32} color={colors.textSecondary} />
                          <ThemedText style={[styles.roundCheckInLabel, styles.roundCheckInLabelDisabled, { color: colors.textSecondary }]}>Checking in…</ThemedText>
                          <ThemedText style={[styles.roundCheckInSub, { color: colors.textSecondary }]}>TAP TO START SHIFT</ThemedText>
                        </View>
                      ) : (
                        <LinearGradient colors={['#facc15', themeYellow, '#b89107']} style={styles.roundCheckInGradient}>
                          <Ionicons name="location" size={32} color={themeBlue} />
                          <ThemedText style={[styles.roundCheckInLabel, { color: themeBlue }]}>Check in</ThemedText>
                          <ThemedText style={[styles.roundCheckInSub, { color: themeBlue }]}>TAP TO START SHIFT</ThemedText>
                        </LinearGradient>
                      )}
                    </Pressable>
                  </AnimatedReanimated.View>
                </View>
              )}

              {/* Daily check-in (office): show when event today; hide when user has approved time off today */}
              {(isPermanentEmployee || role === 'team_leader' || role === 'admin') && !hasApprovedTimeOffToday && (
                <View style={[styles.dailyCheckInSecondary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {officeCheckedInToday && officeCheckedOutToday ? (
                    <View style={styles.dailyCheckInSecondaryRow}>
                      <Ionicons name="checkmark-circle" size={20} color={StatusColors.checkedIn} />
                      <ThemedText style={[styles.dailyCheckInSecondaryLabel, { color: colors.text }]}>Daily check-in</ThemedText>
                      <ThemedText style={[styles.dailyCheckInSecondaryTime, { color: colors.textSecondary }]}>{checkinTimeStr || 'Done'}</ThemedText>
                    </View>
                  ) : showCheckoutCta ? (
                    <Pressable
                      onPress={handleOfficeCheckOut}
                      disabled={checkInLoading}
                      style={({ pressed }) => [styles.dailyCheckInSecondaryRow, styles.dailyCheckInSecondaryButton, { opacity: pressed && !checkInLoading ? 0.8 : 1 }]}
                    >
                      <Ionicons name="exit-outline" size={20} color={iconColor} />
                      <ThemedText style={[styles.dailyCheckInSecondaryLabel, { color: colors.text }]}>Daily check-in</ThemedText>
                      <ThemedText style={[styles.dailyCheckInSecondaryCta, { color: iconColor }]}>{officeCheckinSecondaryCta}</ThemedText>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={handleOfficeCheckIn}
                      disabled={checkInLoading}
                      style={({ pressed }) => [styles.dailyCheckInSecondaryRow, styles.dailyCheckInSecondaryButton, { opacity: pressed && !checkInLoading ? 0.8 : 1 }]}
                    >
                      <Ionicons name="location-outline" size={20} color={iconColor} />
                      <ThemedText style={[styles.dailyCheckInSecondaryLabel, { color: colors.text }]}>Daily check-in</ThemedText>
                      <ThemedText style={[styles.dailyCheckInSecondaryCta, { color: iconColor }]}>{officeCheckinSecondaryCta}</ThemedText>
                    </Pressable>
                  )}
                </View>
              )}
              </>
            ) : hasApprovedTimeOffToday ? (
              /* Approved time off today: no daily check-in button */
              <View style={[styles.dailyCheckInStatus, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="calendar-outline" size={24} color={colors.textSecondary} />
                <ThemedText style={[styles.dailyCheckInStatusText, { color: colors.textSecondary }]}>You're on time off today</ThemedText>
              </View>
            ) : (isPermanentEmployee || role === 'team_leader' || role === 'admin') ? (
              /* No event today: Daily (office) check-in for permanent crew, team leaders, and admin */
              hasCheckedIn && officeCheckedOutToday ? (
                <View style={[styles.dailyCheckInStatus, { backgroundColor: StatusColors.checkedIn + '18', borderColor: StatusColors.checkedIn + '44' }]}>
                  <Ionicons name="checkmark-circle" size={24} color={StatusColors.checkedIn} />
                  <ThemedText style={[styles.dailyCheckInStatusText, { color: StatusColors.checkedIn }]}>Checked in today</ThemedText>
                  {checkinTimeStr && <ThemedText style={[styles.dailyCheckInTime, { color: colors.textSecondary }]}>{checkinTimeStr}</ThemedText>}
                </View>
              ) : (
                <View style={styles.roundCheckInWrap}>
                  <AnimatedReanimated.View style={styles.roundCheckInButtonWrap}>
                    <AnimatedReanimated.View style={[styles.rippleRing, { borderColor: showCheckoutCta ? themeBlue : (isDark ? themeYellow : themeBlue) }, rippleStyle]} pointerEvents="none" />
                    <AnimatedReanimated.View style={[styles.rippleRing, { borderColor: showCheckoutCta ? themeBlue : (isDark ? themeYellow : themeBlue) }, rippleStyle2]} pointerEvents="none" />
                    <Pressable
                      onPress={showCheckoutCta ? handleOfficeCheckOut : handleOfficeCheckIn}
                      disabled={checkInLoading}
                      style={({ pressed }) => [
                        styles.roundCheckInButton,
                        styles.roundCheckInButtonOffice,
                        checkInLoading && styles.roundCheckInButtonDisabled,
                        (checkInLoading || officeCheckinStep !== 'idle' || officeCheckoutStep !== 'idle') && { backgroundColor: themeYellow + '35' },
                        pressed && !checkInLoading && styles.roundCheckInButtonPressed,
                      ]}
                    >
                      {(checkInLoading || officeCheckinStep !== 'idle' || officeCheckoutStep !== 'idle') ? (
                        <View style={styles.roundCheckInInner}>
                          <Ionicons name={officeCheckinStep === 'you_made_it' || officeCheckoutStep === 'success_thankyou' || officeCheckoutStep === 'see_you' ? 'checkmark-circle' : showCheckoutCta ? 'exit' : 'location'} size={32} color={officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary} />
                          <ThemedText style={[styles.roundCheckInLabel, styles.roundCheckInLabelDisabled, { color: officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary }]}>{officeCheckinButtonLabel.label}</ThemedText>
                          <ThemedText style={[styles.roundCheckInSub, { color: officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary }]}>{officeCheckinButtonLabel.sub}</ThemedText>
                        </View>
                      ) : (
                        <LinearGradient
                          colors={showCheckoutCta ? [themeBlue, '#1e3a5f', '#0f1838'] : ['#facc15', themeYellow, '#b89107']}
                          style={styles.roundCheckInGradient}
                        >
                          <Ionicons name={showCheckoutCta ? 'exit' : 'location'} size={32} color={showCheckoutCta ? '#fff' : themeBlue} />
                          <ThemedText style={[styles.roundCheckInLabel, { color: showCheckoutCta ? '#fff' : themeBlue }]}>{officeCheckinButtonLabel.label}</ThemedText>
                          <ThemedText style={[styles.roundCheckInSub, { color: showCheckoutCta ? '#fff' : themeBlue }]}>{officeCheckinButtonLabel.sub}</ThemedText>
                        </LinearGradient>
                      )}
                    </Pressable>
                  </AnimatedReanimated.View>
                </View>
              )
            ) : (
              /* Temporary crew, no event today: show Daily check-in (backend may reject if not allowed) */
              <View style={styles.roundCheckInWrap}>
                <AnimatedReanimated.View style={styles.roundCheckInButtonWrap}>
                  <AnimatedReanimated.View style={[styles.rippleRing, { borderColor: showCheckoutCta ? themeBlue : (isDark ? themeYellow : themeBlue) }, rippleStyle]} pointerEvents="none" />
                  <AnimatedReanimated.View style={[styles.rippleRing, { borderColor: showCheckoutCta ? themeBlue : (isDark ? themeYellow : themeBlue) }, rippleStyle2]} pointerEvents="none" />
                  <Pressable
                    onPress={showCheckoutCta ? handleOfficeCheckOut : handleOfficeCheckIn}
                    disabled={checkInLoading}
                    style={({ pressed }) => [
                      styles.roundCheckInButton,
                      styles.roundCheckInButtonOffice,
                      checkInLoading && styles.roundCheckInButtonDisabled,
                      (checkInLoading || officeCheckinStep !== 'idle' || officeCheckoutStep !== 'idle') && { backgroundColor: themeYellow + '35' },
                      pressed && !checkInLoading && styles.roundCheckInButtonPressed,
                    ]}
                  >
                    {(checkInLoading || officeCheckinStep !== 'idle' || officeCheckoutStep !== 'idle') ? (
                      <View style={styles.roundCheckInInner}>
                        <Ionicons name={officeCheckinStep === 'you_made_it' || officeCheckoutStep === 'success_thankyou' || officeCheckoutStep === 'see_you' ? 'checkmark-circle' : showCheckoutCta ? 'exit' : 'location'} size={32} color={officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary} />
                        <ThemedText style={[styles.roundCheckInLabel, styles.roundCheckInLabelDisabled, { color: officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary }]}>{officeCheckinButtonLabel.label}</ThemedText>
                        <ThemedText style={[styles.roundCheckInSub, { color: officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary }]}>{officeCheckinButtonLabel.sub}</ThemedText>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={showCheckoutCta ? [themeBlue, '#1e3a5f', '#0f1838'] : ['#facc15', themeYellow, '#b89107']}
                        style={styles.roundCheckInGradient}
                      >
                        <Ionicons name={showCheckoutCta ? 'exit' : 'location'} size={32} color={showCheckoutCta ? '#fff' : themeBlue} />
                        <ThemedText style={[styles.roundCheckInLabel, { color: showCheckoutCta ? '#fff' : themeBlue }]}>{officeCheckinButtonLabel.label}</ThemedText>
                        <ThemedText style={[styles.roundCheckInSub, { color: showCheckoutCta ? '#fff' : themeBlue }]}>{officeCheckinButtonLabel.sub}</ThemedText>
                      </LinearGradient>
                    )}
                  </Pressable>
                </AnimatedReanimated.View>
              </View>
            )}
          </AnimatedReanimated.View>
        )}

        {/* Today's Event card – clean, scannable */}
        {eventToday && (role === 'crew' || role === 'team_leader') && (
          <AnimatedReanimated.View entering={FadeInDown.duration(360).delay(80)} style={styles.section}>
            <View style={[styles.todayEventCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftWidth: 5, borderLeftColor: themeYellow }]}>
              <View style={styles.todayEventHeader}>
                <Ionicons name="calendar" size={20} color={iconColor} />
                <ThemedText style={[styles.todayEventTitle, { color: colors.text }]}>Today&apos;s Event</ThemedText>
                <View style={[styles.confirmedBadge, { backgroundColor: StatusColors.checkedIn + '22' }]}>
                  <ThemedText style={[styles.confirmedBadgeText, { color: StatusColors.checkedIn }]}>CONFIRMED</ThemedText>
                </View>
              </View>
              <Pressable onPress={() => router.push(`/events/${eventToday.id}`)} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
                <ThemedText style={[styles.todayEventName, { color: colors.text }]} numberOfLines={2}>{eventToday.name}</ThemedText>
                {eventToday.start_time && (
                  <View style={styles.todayEventRow}>
                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                    <ThemedText style={[styles.todayEventMeta, { color: colors.textSecondary }]}>
                      {formatTime(eventToday.start_time)}
                      {eventToday.expected_end_time ? ` — ${formatTime(eventToday.expected_end_time)}` : ''}
                    </ThemedText>
                  </View>
                )}
                {eventToday.location_name && (
                  <View style={styles.todayEventRow}>
                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                    <ThemedText style={[styles.todayEventMeta, { color: colors.textSecondary }]} numberOfLines={1}>{eventToday.location_name}</ThemedText>
                  </View>
                )}
                {(eventToday.team_leader ?? eventToday.teamLeader) && (
                  <View style={styles.todayEventRow}>
                    <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                    <ThemedText style={[styles.todayEventMeta, { color: colors.textSecondary }]}>
                      {(eventToday.team_leader ?? eventToday.teamLeader)!.name}
                    </ThemedText>
                  </View>
                )}
                <ThemedText style={[styles.viewDetailsLink, { color: colors.brandText }]}>View Details →</ThemedText>
              </Pressable>
            </View>
          </AnimatedReanimated.View>
        )}

        {/* Crew / Team leader: Daily Allowance + Approved allowances – only when user is event crew for today */}
        {(role === 'crew' || role === 'team_leader') && eventsTodayList.length > 0 && (
          <AnimatedReanimated.View entering={FadeInDown.duration(360).delay(100)} style={styles.allowancesSection}>
            <View style={styles.summaryCardsRow}>
              <View style={[styles.summaryCard, styles.summaryCardAllowance, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: StatusColors.checkedIn }]}>
                <View style={[styles.summaryCardIconWrap, { backgroundColor: StatusColors.checkedIn + '18', borderColor: StatusColors.checkedIn + '35' }]}>
                  <Ionicons name="wallet-outline" size={22} color={StatusColors.checkedIn} />
                </View>
                <ThemedText style={[styles.summaryCardValue, { color: colors.text }]}>
                  {allowanceToday != null
                    ? (typeof allowanceToday === 'number' ? `KES ${allowanceToday}` : String(allowanceToday))
                    : '0.00 KES'}
                </ThemedText>
                <ThemedText style={[styles.summaryCardLabel, { color: colors.textSecondary }]}>DAILY ALLOWANCE</ThemedText>
              </View>
            </View>
            {approvedAllowances.length > 0 && (
              <>
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionTitleAccent, styles.sectionTitleAccentVibe, { backgroundColor: StatusColors.checkedIn }]} />
                  <ThemedText style={[styles.sectionTitle, { color: isDark ? themeYellow + 'dd' : colors.text }]}>
                    Allowances
                  </ThemedText>
                </View>
                <View style={[styles.activityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {approvedAllowances.slice(0, 10).map((p) => {
                    const eventName = p.event?.name ?? 'Event';
                    const amount = Number(p.total_amount);
                    const purpose = p.purpose ?? '';
                    const dateStr = p.payment_date
                      ? new Date(String(p.payment_date)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '';
                    return (
                      <View key={p.id} style={styles.allowanceRow}>
                        <View style={[styles.activityDot, { backgroundColor: StatusColors.checkedIn }]} />
                        <View style={styles.activityContent}>
                          <ThemedText style={[styles.activityTitle, { color: colors.text }]} numberOfLines={1}>
                            {eventName}{purpose ? ` · ${purpose}` : ''}
                          </ThemedText>
                          <ThemedText style={[styles.activitySub, { color: colors.textSecondary }]}>
                            KES {amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            {dateStr ? ` · ${dateStr}` : ''}
                          </ThemedText>
                        </View>
                      </View>
                    );
                  })}
                  {approvedAllowances.length > 10 && (
                    <ThemedText style={[styles.activityTime, { color: colors.textSecondary, marginTop: U.sm }]}>
                      +{approvedAllowances.length - 10} more
                    </ThemedText>
                  )}
                </View>
              </>
            )}
          </AnimatedReanimated.View>
        )}

        {/* Quick Actions – 2-column grid */}
        <AnimatedReanimated.View entering={FadeInDown.duration(400).delay(140)} style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionTitleAccent, styles.sectionTitleAccentVibe, { backgroundColor: themeYellow }]} />
            <ThemedText style={[styles.sectionTitle, { color: isDark ? themeYellow + 'dd' : colors.text }]}>
              Quick actions
            </ThemedText>
          </View>
          <View style={styles.quickGrid}>
            {visibleQuickActions.map((action, index) => {
              const href = action.id === 'checkin' && eventToday ? `/events/${eventToday.id}` : action.href;
              return (
                <AnimatedReanimated.View
                  key={action.id}
                  entering={FadeIn.delay(120 + index * 40).duration(320)}
                  style={styles.quickCardWrap}
                >
                  <Pressable
                    onPress={() => href && router.push(href as any)}
                    style={({ pressed }) => [
                      styles.quickCard,
                      { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
                    ]}
                  >
                    <View style={[styles.quickIconWrap, { backgroundColor: (isDark ? themeYellow : themeBlue) + '1a', borderColor: (isDark ? themeYellow : themeBlue) + '38' }]}>
                      <Ionicons name={action.icon as any} size={20} color={iconColor} />
                    </View>
                    <ThemedText style={[styles.quickLabel, { color: colors.text }]} numberOfLines={1}>
                      {action.label}
                    </ThemedText>
                  </Pressable>
                </AnimatedReanimated.View>
              );
            })}
          </View>
        </AnimatedReanimated.View>

        {/* Today's Events */}
        <AnimatedReanimated.View entering={FadeInDown.duration(400).delay(180)} style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionTitleAccent, styles.sectionTitleAccentVibe, { backgroundColor: VibrantColors.emerald }]} />
            <ThemedText style={[styles.sectionTitle, { color: isDark ? themeYellow + 'dd' : colors.text }]}>
              Today&apos;s events
            </ThemedText>
          </View>
          {eventsTodayList.length === 0 ? (
            <AnimatedReanimated.View
              entering={FadeIn.delay(220).duration(360)}
              style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.emptyCardIconWrap, { backgroundColor: VibrantColors.sky + '28' }]}>
                <Ionicons name="calendar-outline" size={32} color={VibrantColors.sky} />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No events today</ThemedText>
              <ThemedText style={[styles.emptySub, { color: colors.textSecondary }]}>
                Open My Events to see your schedule
              </ThemedText>
              <Pressable onPress={() => router.push('/(tabs)/events')} style={styles.emptyLink}>
                <ThemedText style={[styles.emptyLinkText, { color: colors.brandText }]}>My Events</ThemedText>
                <Ionicons name="chevron-forward" size={16} color={iconColor} />
              </Pressable>
            </AnimatedReanimated.View>
          ) : (
            eventsTodayList.map((event, index) => {
              const timeStr = event.start_time ? formatTime(event.start_time) : '';
              const venue = event.location_name ?? '';
              const status = (event.status || 'Scheduled').trim();
              return (
                <AnimatedReanimated.View
                  key={event.id}
                  entering={FadeIn.delay(220 + index * 55).duration(300)}
                >
                  <Pressable
                    onPress={() => router.push(`/events/${event.id}`)}
                    style={({ pressed }) => [
                      styles.eventCard,
                      { backgroundColor: colors.surface, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: VibrantColorsList[index % VibrantColorsList.length], opacity: pressed ? 0.92 : 1 },
                    ]}
                  >
                    <View style={styles.eventCardMain}>
                      <ThemedText style={[styles.eventCardTitle, { color: colors.text }]} numberOfLines={1}>
                        {event.name}
                      </ThemedText>
                      <ThemedText style={[styles.eventCardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                        {[venue, timeStr].filter(Boolean).join(' · ') || '—'}
                      </ThemedText>
                    </View>
                    <View style={[styles.eventBadge, { backgroundColor: VibrantColors.emerald + '22' }]}>
                      <ThemedText style={[styles.eventBadgeText, { color: VibrantColors.emerald }]}>{status}</ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={iconColor} />
                  </Pressable>
                </AnimatedReanimated.View>
              );
            })
          )}
        </AnimatedReanimated.View>

        {/* Admin: Past events */}
        {role === 'admin' && pastEvents.length > 0 && (
          <AnimatedReanimated.View entering={FadeIn.duration(400).delay(220)} style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionTitleAccent, styles.sectionTitleAccentVibe, { backgroundColor: isDark ? themeYellow : themeBlue }]} />
              <ThemedText style={[styles.sectionTitle, { color: isDark ? themeYellow + 'dd' : colors.text }]}>
                Past events
              </ThemedText>
            </View>
            {pastEvents.slice(0, 6).map((event) => {
              const evDate = event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
              const evTime = event.start_time ? formatTime(event.start_time) : '';
              const loc = event.location_name ?? '';
              return (
                <Pressable
                  key={event.id}
                  onPress={() => router.push({ pathname: '/admin/events/[id]/operations', params: { id: String(event.id) } })}
                  style={({ pressed }) => [
                    styles.eventCard,
                    { backgroundColor: colors.surface, borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: isDark ? themeYellow : themeBlue, opacity: pressed ? 0.92 : 1 },
                  ]}
                >
                  <View style={styles.eventCardMain}>
                    <ThemedText style={[styles.eventCardTitle, { color: colors.text }]} numberOfLines={1}>
                      {event.name}
                    </ThemedText>
                    <ThemedText style={[styles.eventCardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                      {[evDate, loc, evTime].filter(Boolean).join(' · ')}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={iconColor} />
                </Pressable>
              );
            })}
            {pastEvents.length > 6 && (
              <Pressable onPress={() => router.push('/admin/events')} style={styles.viewAll}>
                <ThemedText style={[styles.viewAllText, { color: colors.brandText }]}>View all ({pastEvents.length})</ThemedText>
                <Ionicons name="chevron-forward" size={16} color={iconColor} />
              </Pressable>
            )}
          </AnimatedReanimated.View>
        )}

        {/* Recent Activity – at bottom of page (warning/amber accent) */}
        {(role === 'crew' || role === 'team_leader') && (
          <AnimatedReanimated.View entering={FadeInDown.duration(360).delay(120)} style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionTitleAccent, styles.sectionTitleAccentVibe, { backgroundColor: VibrantColors.amber }]} />
              <ThemedText style={[styles.sectionTitle, { color: isDark ? themeYellow + 'dd' : colors.text }]}>
                Recent activity
              </ThemedText>
            </View>
            <View style={[styles.activityCard, { backgroundColor: isDark ? colors.surface : VibrantColors.amber + '12', borderColor: colors.border, borderLeftColor: VibrantColors.amber, borderLeftWidth: 5 }]}>
              {recentCheckinActivities.length === 0 ? (
                <View style={styles.activityItem}>
                  <View style={[styles.activityDotLarge, { backgroundColor: VibrantColors.amber + '30', borderColor: VibrantColors.amber }]}>
                    <Ionicons name="pulse-outline" size={14} color={VibrantColors.amber} />
                  </View>
                  <View style={styles.activityContent}>
                    <ThemedText style={[styles.activityTitle, { color: colors.text }]}>Check-in & updates</ThemedText>
                    <ThemedText style={[styles.activitySub, { color: colors.textSecondary }]}>No check-ins yet today</ThemedText>
                    <ThemedText style={[styles.activityTime, { color: VibrantColors.amber }]}>—</ThemedText>
                  </View>
                </View>
              ) : (
                recentCheckinActivities.map((item) => (
                  <View key={item.key} style={[styles.activityItem, recentCheckinActivities.indexOf(item) > 0 && styles.activityItemNotFirst]}>
                    <View style={[styles.activityDotLarge, { backgroundColor: VibrantColors.amber + '30', borderColor: VibrantColors.amber }]}>
                      <Ionicons name={item.icon} size={14} color={VibrantColors.amber} />
                    </View>
                    <View style={styles.activityContent}>
                      <ThemedText style={[styles.activityTitle, { color: colors.text }]}>{item.title}</ThemedText>
                      <ThemedText style={[styles.activitySub, { color: colors.textSecondary }]}>{item.sub}</ThemedText>
                      <ThemedText style={[styles.activityTime, { color: VibrantColors.amber }]}>{item.time}</ThemedText>
                    </View>
                  </View>
                ))
              )}
            </View>
          </AnimatedReanimated.View>
        )}

        {/* Active Streak (Pull Up Rate) – crew/team_leader only, just before footer */}
        {(role === 'crew' || role === 'team_leader') && (
          <AnimatedReanimated.View entering={FadeInDown.duration(360).delay(80)} style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionTitleAccent, styles.sectionTitleAccentVibe, { backgroundColor: StatusColors.checkedIn }]} />
              <ThemedText style={[styles.sectionTitle, { color: isDark ? themeYellow + 'dd' : colors.text }]}>
                Active Streak
              </ThemedText>
            </View>
            <CrewAttendanceStatistic
              key={`attendance-${user?.office_checkin_time ?? optimisticOfficeCheckinTime ?? 'none'}`}
              refreshTrigger={user?.office_checkin_time ?? optimisticOfficeCheckinTime ?? undefined}
            />
          </AnimatedReanimated.View>
        )}

        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: U.lg,
    paddingTop: U.section,
  },
  welcomeCard: {
    padding: U.xl,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    marginBottom: U.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  welcomeGreeting: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 4,
    lineHeight: 24,
  },
  welcomeMeta: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: U.xs,
  },
  welcomeMetaSmall: {
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.2,
    opacity: 0.9,
  },
  welcomeMetaBold: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.25,
    marginTop: 2,
    marginBottom: 0,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: U.xs,
    marginTop: U.sm,
  },
  statusChip: {
    flex: 1,
    minWidth: 0,
    flexBasis: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  dailyCheckInSection: {
    alignItems: 'center',
    marginBottom: U.xl,
  },
  roundCheckInWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  roundCheckInButtonWrap: {
    width: 136,
    height: 136,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  rippleRing: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    left: 0,
    top: 0,
    borderWidth: 3,
    backgroundColor: 'transparent',
  },
  roundCheckInButton: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: themeYellow,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: themeYellow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 16,
    elevation: 8,
  },
  roundCheckInButtonCheckOut: {
    backgroundColor: themeBlue,
    shadowColor: themeBlue,
    shadowOpacity: 0.4,
  },
  roundCheckInButtonOffice: {
    shadowColor: themeYellow,
    shadowOpacity: 0.35,
  },
  roundCheckInInner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 68,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundCheckInGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 68,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
  },
  roundCheckInSub: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  roundCheckInButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  roundCheckInButtonDisabled: {
    backgroundColor: themeBlue + '22',
    shadowOpacity: 0.08,
  },
  roundCheckInLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: themeBlue,
    marginTop: 6,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  roundCheckInLabelDisabled: {
    color: '#71717A',
  },
  dailyCheckInStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: U.sm,
    padding: U.lg,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
  },
  dailyCheckInStatusText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dailyCheckInTime: {
    fontSize: 14,
    marginTop: 2,
  },
  dailyCheckInSecondary: {
    marginTop: U.md,
    paddingVertical: U.lg,
    paddingHorizontal: U.xl,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
  },
  dailyCheckInSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: U.sm,
  },
  dailyCheckInSecondaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  dailyCheckInSecondaryTime: {
    fontSize: 14,
  },
  dailyCheckInSecondaryButton: {
    paddingVertical: 2,
  },
  dailyCheckInSecondaryCta: {
    fontSize: 14,
    fontWeight: '600',
  },
  todayEventCard: {
    padding: U.xl,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    marginBottom: U.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  todayEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: U.sm,
    marginBottom: U.lg,
  },
  todayEventTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    flex: 1,
  },
  confirmedBadge: {
    paddingHorizontal: U.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  confirmedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  todayEventName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: U.sm,
    lineHeight: 24,
  },
  todayEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  todayEventMeta: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  viewDetailsLink: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: U.md,
    letterSpacing: 0.2,
  },
  summaryCardsRow: {
    flexDirection: 'row',
    gap: U.lg,
    marginBottom: U.xl,
  },
  summaryCard: {
    flex: 1,
    padding: U.xl,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryCardValue: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: U.sm,
    letterSpacing: 0.2,
  },
  summaryCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  summaryCardAllowance: {
    borderLeftWidth: 4,
  },
  summaryCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  section: {
    marginBottom: U.section,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: U.lg,
    gap: U.sm,
  },
  sectionTitleAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  sectionTitleAccentVibe: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    flex: 1,
  },
  sectionTitlePlain: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: U.lg,
  },
  activityCard: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    padding: U.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  allowancesSection: {
    marginBottom: U.lg,
  },
  allowanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: U.md,
    marginBottom: U.sm,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: U.md,
  },
  activityItemNotFirst: {
    marginTop: U.lg,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  activityDotLarge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  activitySub: {
    fontSize: 13,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 11,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: U.sm,
    justifyContent: 'space-between',
  },
  quickCardWrap: {
    width: '48%',
    minWidth: '48%',
    maxWidth: '48%',
    flexShrink: 0,
  },
  quickCard: {
    padding: U.md,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 76,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: U.xs,
    borderWidth: 1,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  emptyCard: {
    padding: U.xl * 1.5,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  emptyCardIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: U.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: U.sm,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: U.md,
  },
  emptyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyLinkText: {
    fontSize: 14,
    fontWeight: '700',
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: U.lg,
    borderRadius: CARD_RADIUS_SM,
    borderWidth: 1,
    marginBottom: U.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  eventCardMain: {
    flex: 1,
    minWidth: 0,
  },
  eventCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  eventCardMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  eventBadge: {
    paddingHorizontal: U.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.md,
    marginRight: U.sm,
  },
  eventBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'capitalize',
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: U.md,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
