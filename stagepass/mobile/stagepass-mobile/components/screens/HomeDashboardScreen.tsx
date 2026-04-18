/**
 * Enterprise home dashboard: minimal header, welcome card, quick actions grid,
 * today's events, role-based visibility. Proportional spacing, soft shadows, clear hierarchy.
 * Enhanced UX: staggered entrance animations, smooth scroll, refined visuals.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useDispatch, useSelector } from 'react-redux';
import { setUser } from '~/store/authSlice';
import type { RoleName } from '~/services/api';
import { QUICK_ACTIONS } from '@/constants/quickActions';
import { CrewAttendanceStatistic } from '@/components/CrewAttendanceStatistic';
import { HomeHeader } from '@/components/HomeHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Cards, Icons, Typography, UI } from '@/constants/ui';
import { BorderRadius, Spacing, StatusColors, themeBlue, themeYellow, VibrantColors, VibrantColorsList } from '@/constants/theme';
import { getOfficeCheckinConfig } from '@/constants/officeCheckin';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { NAV_PRESSED_OPACITY, useNavigationPress } from '@/src/utils/navigationPress';
import { useGeofence } from '~/hooks/useGeofence';
import { api, type User as ApiUser, type Payment } from '~/services/api';
import type { Event as EventType } from '~/services/api';
import {
  DEFAULT_HOMEPAGE_PREFERENCES,
  HOMEPAGE_SECTION_KEYS,
  type HomepagePreferences,
  type HomepageSectionKey,
} from '~/services/api';
import { isWithinGeofence } from '~/utils/geofence';
import { computeWallClockShiftHours } from '~/utils/shiftHours';
import { PREF_HOMEPAGE_PREFERENCES_LOCAL, PREF_SHOW_WELCOME_STATS_CARDS } from '~/constants/preferences';

const TAB_BAR_HEIGHT = 58;
const OFFICE_CHECKIN_EARLIEST_HOUR = 6;

type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

function getDayPeriod(date: Date): DayPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function getGreeting(period: DayPeriod): string {
  if (period === 'morning') return 'Good morning';
  if (period === 'afternoon') return 'Good afternoon';
  if (period === 'evening') return 'Good evening';
  return 'Good night';
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

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Parse office_latitude / office_longitude from API (number or numeric string). */
function parseOfficeCoord(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const t = value.trim().replace(/,/g, '.');
    if (t === '') return null;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
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

function formatHoursLabel(hours?: number | null): string {
  const mins = Math.max(0, Math.round(Number(hours ?? 0) * 60));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function eventDateOnly(event?: { date?: string | null }): string {
  const raw = typeof event?.date === 'string' ? event.date.trim() : '';
  if (!raw) return '';
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
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
  /** Crew: assigned equipment count. Optional. */
  equipmentCount?: number;
  /** Approved payments/allowances (from http://localhost:3000/approvals). Shown under Allowances for crew/team_leader. */
  approvedAllowances?: Payment[];
};

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
  const handleNav = useNavigationPress();
  const { colors, isDark } = useStagePassTheme();
  const iconColor = isDark ? themeYellow : themeBlue;
  const iconOutlineColor = isDark ? themeYellow : themeBlue;
  /** Light mode: match Everything page card background. */
  const welcomeCardBg = isDark ? '#1E212A' : '#FFFFFF';
  const cardBg = isDark ? '#1E212A' : '#FFFFFF';
  const quickCardBg = isDark ? '#1E212A' : '#FFFFFF';
  const homeBorderColor = isDark ? colors.border : 'rgba(37, 99, 235, 0.16)';
  const welcomeCardBorder = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(37, 99, 235, 0.16)';
  const quickCardShadow = isDark
    ? { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 }
    : { shadowColor: '#1E3A8A', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 };
  const eventCardShadow = isDark
    ? { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 }
    : { shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 };
  const welcomeChipAccent = isDark ? '#93C5FD' : themeBlue;
  const welcomeChipBg = isDark ? 'rgba(147, 197, 253, 0.14)' : 'rgba(37, 99, 235, 0.08)';
  const welcomeChipBorder = isDark ? 'rgba(147, 197, 253, 0.34)' : 'rgba(37, 99, 235, 0.2)';
  const dispatch = useDispatch();
  const user = useSelector((s: { auth: { user: ApiUser | null } }) => s.auth.user);
  const authToken = useSelector((s: { auth: { token: string | null } }) => s.auth.token);
  const userName = (user?.name ?? '').trim();
  const [localHomepagePrefs, setLocalHomepagePrefs] = useState<HomepagePreferences | null>(null);
  const normalizeHomepagePrefs = (prefs?: HomepagePreferences | null): HomepagePreferences => {
    const base = DEFAULT_HOMEPAGE_PREFERENCES;
    if (!prefs) return base;
    const visibility = { ...base.visibility, ...(prefs.visibility ?? {}) } as HomepagePreferences['visibility'];
    const incoming = Array.isArray(prefs.order) ? prefs.order : [];
    const order: HomepageSectionKey[] = [];
    incoming.forEach((k) => {
      if (HOMEPAGE_SECTION_KEYS.includes(k) && !order.includes(k)) order.push(k);
    });
    HOMEPAGE_SECTION_KEYS.forEach((k) => {
      if (!order.includes(k)) order.push(k);
    });
    return {
      visibility,
      order,
      layout: prefs.layout === 'compact' ? 'compact' : 'comfortable',
    };
  };
  const homepagePrefs = normalizeHomepagePrefs(user?.homepage_preferences ?? localHomepagePrefs ?? null);
  const isCompactLayout = homepagePrefs.layout === 'compact';
  const sectionVisible = homepagePrefs.visibility;

  // Ensure office check-in state is fresh after login (login response has no office_* fields).
  useEffect(() => {
    api.auth.me().then((me) => dispatch(setUser(me))).catch(() => {});
  }, [dispatch]);
  const displayName = userName ? userName.split(/\s+/)[0] : '';
  const currentTime = useCurrentTime(30_000);
  /** 1s tick for live office shift hours display */
  const shiftClock = useCurrentTime(1_000);
  const dayPeriod = getDayPeriod(currentTime);
  const timeLabel = currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const welcomePatternTheme = useMemo(() => {
    const map: Record<DayPeriod, { strong: string; soft: string; filled: string }> = {
      morning: {
        strong: isDark ? 'rgba(250, 204, 21, 0.12)' : 'rgba(245, 158, 11, 0.14)',
        soft: isDark ? 'rgba(250, 204, 21, 0.10)' : 'rgba(245, 158, 11, 0.10)',
        filled: isDark ? 'rgba(250, 204, 21, 0.08)' : 'rgba(245, 158, 11, 0.08)',
      },
      afternoon: {
        strong: isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.14)',
        soft: isDark ? 'rgba(16, 185, 129, 0.10)' : 'rgba(16, 185, 129, 0.10)',
        filled: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.08)',
      },
      evening: {
        strong: isDark ? 'rgba(99, 102, 241, 0.14)' : 'rgba(37, 99, 235, 0.12)',
        soft: isDark ? 'rgba(99, 102, 241, 0.11)' : 'rgba(37, 99, 235, 0.10)',
        filled: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(37, 99, 235, 0.08)',
      },
      night: {
        strong: isDark ? 'rgba(168, 85, 247, 0.14)' : 'rgba(79, 70, 229, 0.12)',
        soft: isDark ? 'rgba(168, 85, 247, 0.11)' : 'rgba(79, 70, 229, 0.10)',
        filled: isDark ? 'rgba(168, 85, 247, 0.08)' : 'rgba(79, 70, 229, 0.08)',
      },
    };
    return map[dayPeriod];
  }, [dayPeriod, isDark]);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [officeCheckinWindow, setOfficeCheckinWindow] = useState<{ start: string; end: string }>({ start: '09:00', end: '10:00' });
  const [officeConfigFromApi, setOfficeConfigFromApi] = useState<{ latitude: number; longitude: number; radiusMeters: number } | null>(null);
  const [officeCheckinStep, setOfficeCheckinStep] = useState<'idle' | 'checking_in' | 'location_confirmed' | 'you_made_it'>('idle');
  const [officeCheckoutStep, setOfficeCheckoutStep] = useState<'idle' | 'checking_out' | 'success_thankyou' | 'see_you'>('idle');
  const [optimisticOfficeCheckedIn, setOptimisticOfficeCheckedIn] = useState(false);
  const [optimisticOfficeCheckinTime, setOptimisticOfficeCheckinTime] = useState<string | null>(null);
  const [dismissedCheckedOutCard, setDismissedCheckedOutCard] = useState(false);
  const [showWelcomeStatsCards, setShowWelcomeStatsCards] = useState(true);
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
    if (showCheckoutCta && officeCheckoutStep === 'idle') return { label: 'Office checkout', sub: 'Tap to end office shift' };
    if (officeCheckinStep === 'checking_in') return { label: 'Checking in…', sub: 'Getting location' };
    if (officeCheckinStep === 'location_confirmed') return { label: 'Location confirmed', sub: 'Confirming check-in…' };
    if (officeCheckinStep === 'you_made_it') return { label: 'You made it in !!', sub: 'Welcome to the office' };
    return { label: 'Check in office', sub: 'TAP TO START SHIFT' };
  })();
  const officeCheckinSecondaryCta = officeCheckoutStep !== 'idle'
    ? (officeCheckoutStep === 'checking_out' ? 'Checking out..' : officeCheckoutStep === 'success_thankyou' ? 'Success, Thank You' : getSeeYouMessage())
    : showCheckoutCta
      ? 'Office checkout'
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
  const dayOfWeek = currentTime.getDay();
  const isOfficeOpenToday = dayOfWeek !== 0 && dayOfWeek !== 6;

  const applyOfficeCheckinConfig = useCallback((s: Awaited<ReturnType<typeof api.settings.getOfficeCheckinConfig>>) => {
    setOfficeCheckinWindow({
      start: s?.office_checkin_start_time ?? '09:00',
      end: s?.office_checkin_end_time ?? '10:00',
    });
    const lat = parseOfficeCoord(s?.office_latitude);
    const lng = parseOfficeCoord(s?.office_longitude);
    const rawRadius = s?.office_radius_m;
    const radius =
      typeof rawRadius === 'number' && Number.isFinite(rawRadius)
        ? rawRadius
        : parseFloat(String(rawRadius ?? '').replace(/,/g, '.')) || 100;
    if (lat != null && lng != null) {
      setOfficeConfigFromApi({ latitude: lat, longitude: lng, radiusMeters: radius > 0 ? radius : 100 });
    } else {
      setOfficeConfigFromApi(null);
    }
  }, []);

  /** Load after token exists (cold start) and when Home gains focus so admin office updates apply. */
  useFocusEffect(
    useCallback(() => {
      if (!authToken) return undefined;
      let cancelled = false;
      api.settings
        .getOfficeCheckinConfig()
        .then((s) => {
          if (!cancelled) applyOfficeCheckinConfig(s);
        })
        .catch(() => {
          if (!cancelled) setOfficeConfigFromApi(null);
        });
      return () => {
        cancelled = true;
      };
    }, [authToken, applyOfficeCheckinConfig])
  );

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(PREF_HOMEPAGE_PREFERENCES_LOCAL)
      .then((v) => {
        if (!mounted || !v) return;
        try {
          const parsed = JSON.parse(v) as HomepagePreferences;
          setLocalHomepagePrefs(normalizeHomepagePrefs(parsed));
        } catch {
          // ignore malformed local cache
        }
      })
      .catch(() => {});

    AsyncStorage.getItem(PREF_SHOW_WELCOME_STATS_CARDS)
      .then((v) => {
        if (!mounted) return;
        if (v == null) setShowWelcomeStatsCards(true);
        else setShowWelcomeStatsCards(v === '1');
      })
      .catch(() => {
        if (mounted) setShowWelcomeStatsCards(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Re-read local UI preference whenever Home gains focus.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(PREF_SHOW_WELCOME_STATS_CARDS)
        .then((v) => {
          if (!active) return;
          if (v == null) setShowWelcomeStatsCards(true);
          else setShowWelcomeStatsCards(v === '1');
        })
        .catch(() => {
          if (active) setShowWelcomeStatsCards(true);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  const currentUserId = user?.id;
  const myAssignment = currentUserId != null
    ? eventToday?.crew?.find((c: { id?: number }) => c.id === currentUserId)
    : eventToday?.crew?.find((c: { pivot?: unknown }) => c.pivot);
  const pivotData = myAssignment && typeof myAssignment === 'object' && 'pivot' in myAssignment
    ? (myAssignment.pivot as { checkin_time?: string; checkout_time?: string })
    : undefined;
  const hasEventCheckedIn = !!(pivotData?.checkin_time);
  const hasEventCheckedOut = !!(pivotData?.checkout_time);
  const showEventCheckedOutCard = (() => {
    if (!hasEventCheckedOut || !pivotData?.checkout_time) return false;
    try {
      return isSameLocalDay(new Date(pivotData.checkout_time), new Date());
    } catch {
      return false;
    }
  })();
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
  const officeCheckinTimeStr = user?.office_checkin_time
    ? (() => {
        try {
          return new Date(user.office_checkin_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } catch {
          return user.office_checkin_time;
        }
      })()
    : '';
  const officeCheckoutTimeStr = user?.office_checkout_time
    ? (() => {
        try {
          return new Date(user.office_checkout_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } catch {
          return user.office_checkout_time;
        }
      })()
    : '';
  const officeExtraHours = Number(user?.office_extra_hours ?? 0);
  const officeTotalHours = Number(user?.office_total_hours ?? 0);
  const officeStandardHoursStored = Number(user?.office_standard_hours ?? 0);
  const officeDayTypeLabel = user?.office_day_type === 'holiday'
    ? (user?.office_holiday_name || 'Holiday')
    : user?.office_day_type === 'sunday'
      ? 'Sunday'
      : 'Normal day';
  const officeExtraAlertShownRef = useRef(false);

  const officeShiftLive = useMemo(() => {
    const checkinIso = user?.office_checkin_time;
    if (!checkinIso || !officeCheckedInToday) return null;
    if (officeCheckedOutToday) {
      return {
        totalHours: officeTotalHours,
        standardHours: officeStandardHoursStored,
        extraHours: officeExtraHours,
        statusLine: 'Session ended',
        inExtra: officeExtraHours > 0,
      };
    }
    const live = computeWallClockShiftHours(checkinIso, shiftClock.getTime());
    return {
      totalHours: live.totalHours,
      standardHours: live.standardHours,
      extraHours: live.extraHours,
      statusLine: live.status === 'within_standard' ? 'Within Standard Hours' : 'Extra Hours Running',
      inExtra: live.extraHours > 0,
    };
  }, [
    user?.office_checkin_time,
    officeCheckedInToday,
    officeCheckedOutToday,
    officeTotalHours,
    officeStandardHoursStored,
    officeExtraHours,
    shiftClock,
  ]);

  useEffect(() => {
    if (!showCheckoutCta || officeCheckedOutToday) return;
    const id = setInterval(() => {
      api.auth
        .me()
        .then((me) => dispatch(setUser(me)))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, [showCheckoutCta, officeCheckedOutToday, dispatch]);

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
    const nowHour = new Date().getHours();
    if (nowHour < OFFICE_CHECKIN_EARLIEST_HOUR) {
      Alert.alert('Too early', 'Office check-in starts at 6:00 AM.');
      return;
    }
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
    Alert.alert(
      'Confirm checkout',
      'Are you sure you want to check out now?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check out',
          onPress: async () => {
            setCheckInLoading(true);
            setOfficeCheckoutStep('checking_out');
            try {
              let latitude: number | undefined;
              let longitude: number | undefined;
              try {
                const loc = await Location.getCurrentPositionAsync({});
                latitude = loc.coords.latitude;
                longitude = loc.coords.longitude;
                setUserLocation({ latitude, longitude });
              } catch {
                // Continue checkout even if location capture fails.
              }

              await api.attendance.officeCheckout(latitude, longitude);
              setOfficeCheckoutStep('success_thankyou');
              await new Promise((r) => setTimeout(r, 1200));
              setOfficeCheckoutStep('see_you');
              await new Promise((r) => setTimeout(r, 1600));
              await onRefresh?.();
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : 'Try again.';
              const notCheckedIn = /not checked in|have not checked in/i.test(String(message));
              setOptimisticOfficeCheckedIn(false);
              setOptimisticOfficeCheckinTime(null);
              await onRefresh?.();
              Alert.alert(
                notCheckedIn ? 'Check in first' : 'Checkout failed',
                notCheckedIn ? 'You haven\'t checked in at the office today. Tap "Check in office" when you\'re at the office to start your shift, then you can checkout.' : message
              );
            } finally {
              setCheckInLoading(false);
              setOfficeCheckoutStep('idle');
            }
          },
        },
      ]
    );
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
            'Server does not support office check-in yet. You are within the configured office radius.'
          );
        } else {
          Alert.alert('Check-in failed', msg);
        }
      } finally {
        setCheckInLoading(false);
        return;
      }
    }

    handleNav(() => router.push('/(tabs)/events'));
  }, [eventToday, hasEventCheckedIn, userLocation, checkInLoading, checkCanCheckIn, onRefresh, officeConfig, router, handleNav]);

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

  useEffect(() => {
    if (!officeCheckedInToday || officeCheckedOutToday) {
      officeExtraAlertShownRef.current = false;
      return;
    }
    const extra = officeShiftLive?.extraHours ?? 0;
    if (!officeExtraAlertShownRef.current && extra > 1 / 60) {
      officeExtraAlertShownRef.current = true;
      Alert.alert(
        'Extra hours',
        'Extra hours are starting now. Your standard 8 working hours have been completed.'
      );
    }
  }, [officeCheckedInToday, officeCheckedOutToday, officeShiftLive]);

  useEffect(() => {
    if (!hasEventCheckedOut) setDismissedCheckedOutCard(false);
  }, [hasEventCheckedOut]);

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const eventsTodayCount = (() => {
    // For crew/team leader, count only today's events that are still active for this user.
    if ((role === 'crew' || role === 'team_leader') && currentUserId != null) {
      return eventsTodayList.filter((e) => {
        const me = e.crew?.find((c: { id?: number; pivot?: { checkout_time?: string | null } }) => c.id === currentUserId);
        const checkedOut = Boolean(me?.pivot?.checkout_time);
        return !checkedOut;
      }).length;
    }
    return eventsTodayList.length;
  })();
  const todayLocalDate = toLocalDateString(currentTime);
  const hasAssignedEventTodayForUser = (() => {
    if (!currentUserId) return false;
    return eventsTodayList.some((e) => {
      if (eventDateOnly(e) !== todayLocalDate) return false;
      return Boolean(e.crew?.some((c: { id?: number }) => c.id === currentUserId));
    });
  })();

  const visibleQuickActions = QUICK_ACTIONS.filter((a) => {
    if (a.id === 'everything') return false;
    if (!sectionVisible.my_events && a.id === 'events') return false;
    if (!sectionVisible.assigned_tasks && a.id === 'tasks') return false;
    if (!a.roles) return true;
    if (a.id === 'checkin' && eventToday && !hasEventCheckedIn) return a.roles.includes(role);
    return a.roles.includes(role);
  });

  const rippleProgress = useSharedValue(0);
  const rippleProgress2 = useSharedValue(0);
  const rippleEasing = Easing.out(Easing.cubic);
  const RIPPLE_DURATION = 4800;

  const showEventCheckInRipple = Boolean(eventToday && !hasEventCheckedIn);
  const showEventCheckOutRipple = Boolean(eventToday && hasEventCheckedIn && !hasEventCheckedOut);
  // Keep ripple for office CTA in all states where office CTA may be visible.
  const showOfficeRipple = Boolean(
    (role === 'crew' || role === 'team_leader' || role === 'admin') &&
    !hasApprovedTimeOffToday &&
    isOfficeOpenToday &&
    !officeCheckedOutToday &&
    (!eventToday || hasEventCheckedOut || !hasEventCheckedIn)
  );
  const rippleActive = showEventCheckInRipple || showEventCheckOutRipple || showOfficeRipple;

  useEffect(() => {
    if (!rippleActive) {
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
  }, [rippleActive, rippleProgress, rippleProgress2]);

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

  // Gentle pulse on the checkout button when it's the active CTA (idle, checked in).
  const checkoutPulse = useSharedValue(0);
  useEffect(() => {
    if (showCheckoutCta && officeCheckoutStep === 'idle' && !checkInLoading) {
      checkoutPulse.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      checkoutPulse.value = withTiming(0, { duration: 200 });
    }
  }, [showCheckoutCta, officeCheckoutStep, checkInLoading, checkoutPulse]);

  const checkoutButtonAnimatedStyle = useAnimatedStyle(() => {
    const scale = 1 + 0.028 * checkoutPulse.value;
    return { transform: [{ scale }] };
  });

  return (
    <ThemedView style={styles.container}>
      <HomeHeader title="Home" notificationCount={notificationCount} />
      <View style={styles.scrollWrapper}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          decelerationRate="normal"
          removeClippedSubviews={false}
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
        {/* Welcome / Status card – single layer so no inner rect can obscure rounded corners */}
        <AnimatedReanimated.View
          entering={FadeInDown.duration(420).delay(0)}
          style={[
            styles.welcomeCard,
            isCompactLayout ? styles.welcomeCardCompact : null,
            { backgroundColor: welcomeCardBg, borderColor: welcomeCardBorder },
            isDark
              ? {
                  shadowColor: '#000',
                  shadowOpacity: 0.25,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 8,
                }
              : {
                  shadowColor: themeBlue,
                  shadowOpacity: 0.14,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 7,
                },
          ]}
        >
          <View pointerEvents="none" style={styles.welcomePatternLayer}>
            <View
              style={[
                styles.welcomeHexShape,
                styles.welcomeHexOne,
                { borderColor: welcomePatternTheme.strong, backgroundColor: 'transparent' },
              ]}
            />
            <View
              style={[
                styles.welcomeHexShapeSmall,
                styles.welcomeHexTwo,
                { borderColor: welcomePatternTheme.soft, backgroundColor: 'transparent' },
              ]}
            />
            <View
              style={[
                styles.welcomeHexShapeDot,
                styles.welcomeHexThree,
                { backgroundColor: welcomePatternTheme.filled },
              ]}
            />
          </View>
          <ThemedText style={[styles.welcomeGreeting, { color: colors.text }]}>
            {getGreeting(dayPeriod)}{displayName ? `, ${displayName}` : ''}
          </ThemedText>
          <ThemedText style={[styles.welcomeMeta, { color: colors.textSecondary }]}>
            {eventsTodayCount === 0
              ? 'No events scheduled for today.'
              : `You have ${eventsTodayCount} event${eventsTodayCount !== 1 ? 's' : ''} scheduled for today.`}
          </ThemedText>
          <ThemedText style={[styles.welcomeMetaBold, { color: colors.text }]}>
            {roleLabel(role)} · {todayLabel} · {timeLabel}
          </ThemedText>
          {showWelcomeStatsCards ? (
          <View style={styles.statusRow}>
            {homepagePrefs.order.filter((k) => ['upcoming_events', 'assigned_tasks', 'announcements'].includes(k)).map((key) => {
              if (key === 'upcoming_events' && sectionVisible.upcoming_events) {
                return (
                  <View key={key} style={[styles.statusChip, { backgroundColor: welcomeChipBg, borderColor: welcomeChipBorder }]}>
                    <Ionicons name="calendar" size={Icons.xs} color={welcomeChipAccent} />
                    <ThemedText style={[styles.statusChipText, { color: welcomeChipAccent }]} numberOfLines={1} ellipsizeMode="tail">
                      {eventsTodayCount} event{eventsTodayCount !== 1 ? 's' : ''}
                    </ThemedText>
                  </View>
                );
              }
              if (key === 'assigned_tasks' && sectionVisible.assigned_tasks) {
                return (
                  <View key={key} style={[styles.statusChip, { backgroundColor: welcomeChipBg, borderColor: welcomeChipBorder }]}>
                    <Ionicons name="checkbox" size={Icons.xs} color={welcomeChipAccent} />
                    <ThemedText style={[styles.statusChipText, { color: welcomeChipAccent }]} numberOfLines={1} ellipsizeMode="tail">
                      {taskCount} task{taskCount !== 1 ? 's' : ''}
                    </ThemedText>
                  </View>
                );
              }
              if (key === 'announcements' && sectionVisible.announcements) {
                return (
                  <View key={key} style={[styles.statusChip, { backgroundColor: welcomeChipBg, borderColor: welcomeChipBorder }]}>
                    <Ionicons name="notifications-outline" size={Icons.xs} color={welcomeChipAccent} />
                    <ThemedText style={[styles.statusChipText, { color: welcomeChipAccent }]} numberOfLines={1} ellipsizeMode="tail">
                      {notificationCount} notice{notificationCount !== 1 ? 's' : ''}
                    </ThemedText>
                  </View>
                );
              }
              return null;
            })}
          </View>
          ) : null}
        </AnimatedReanimated.View>

        {/* Main CTA: Office check-in / checkout only. Event check-in remains on the event details screen. */}
        {(role === 'crew' || role === 'team_leader' || role === 'admin') && (
          <AnimatedReanimated.View entering={FadeInDown.duration(380).delay(50)} style={styles.dailyCheckInSection}>
            {false ? (
              /* Event day: Check-in → Check-out (with confirm) → Checked out */
              <>
              {hasEventCheckedOut ? (
                <>
                  {showEventCheckedOutCard && !dismissedCheckedOutCard ? (
                    <View style={[styles.dailyCheckInStatus, styles.dailyCheckInStatusDismissible, { backgroundColor: StatusColors.checkedIn + '18', borderColor: StatusColors.checkedIn + '44' }]}>
                      <View style={styles.dailyCheckInStatusContent}>
                        <Ionicons name="checkmark-done-circle" size={Icons.xl} color={StatusColors.checkedIn} />
                        <View style={styles.dailyCheckInStatusTextWrap}>
                          <ThemedText style={[styles.dailyCheckInStatusText, { color: StatusColors.checkedIn }]}>
                            Checked out
                          </ThemedText>
                          {checkoutTimeStr && (
                            <ThemedText style={[styles.dailyCheckInTime, { color: colors.textSecondary }]}>{checkoutTimeStr}</ThemedText>
                          )}
                        </View>
                      </View>
                      <Pressable
                        onPress={() => setDismissedCheckedOutCard(true)}
                        hitSlop={12}
                        style={({ pressed }) => [styles.checkedOutCloseBtn, { opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Ionicons name="close" size={Icons.header} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  ) : null}
                  {(role === 'crew' || role === 'team_leader' || role === 'admin') && !hasApprovedTimeOffToday && isOfficeOpenToday && !officeCheckedOutToday ? (
                    <View style={[styles.roundCheckInWrap, styles.officeAfterEventCheckoutWrap]}>
                      <AnimatedReanimated.View style={[styles.roundCheckInButtonWrap, showCheckoutCta ? checkoutButtonAnimatedStyle : undefined]}>
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
                              <Ionicons name={officeCheckinStep === 'you_made_it' || officeCheckoutStep === 'success_thankyou' || officeCheckoutStep === 'see_you' ? 'checkmark-circle' : showCheckoutCta ? 'exit' : 'location'} size={Icons.standard} color={officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary} />
                              <ThemedText style={[styles.roundCheckInLabel, styles.roundCheckInLabelDisabled, { color: officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary }]} numberOfLines={1}>{officeCheckinButtonLabel.label}</ThemedText>
                              <ThemedText style={[styles.roundCheckInSub, { color: officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary }]} numberOfLines={1}>OFFICE SHIFT</ThemedText>
                            </View>
                          ) : (
                            <LinearGradient
                              colors={showCheckoutCta ? [themeBlue, '#1e3a5f', '#0f1838'] : ['#facc15', themeYellow, '#b89107']}
                              style={styles.roundCheckInGradient}
                            >
                              <Ionicons name={showCheckoutCta ? 'exit' : 'location'} size={Icons.standard} color={showCheckoutCta ? '#fff' : themeBlue} />
                              <ThemedText style={[styles.roundCheckInLabel, { color: showCheckoutCta ? '#fff' : themeBlue }]} numberOfLines={1}>{officeCheckinButtonLabel.label}</ThemedText>
                              <ThemedText style={[styles.roundCheckInSub, { color: showCheckoutCta ? '#fff' : themeBlue }]} numberOfLines={1}>OFFICE SHIFT</ThemedText>
                            </LinearGradient>
                          )}
                        </Pressable>
                      </AnimatedReanimated.View>
                    </View>
                  ) : null}
                </>
              ) : hasEventCheckedIn ? (
                <View style={styles.roundCheckInWrap}>
                  <AnimatedReanimated.View style={styles.roundCheckInButtonWrap}>
                    <AnimatedReanimated.View style={[styles.rippleRing, { borderColor: themeBlue }, rippleStyle]} pointerEvents="none" />
                    <AnimatedReanimated.View style={[styles.rippleRing, { borderColor: themeBlue }, rippleStyle2]} pointerEvents="none" />
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
                        <Ionicons name="exit-outline" size={Icons.standard} color="#fff" />
                        <ThemedText style={[styles.roundCheckInLabel, { color: '#fff' }]}>
                          {checkInLoading ? 'Checking out…' : 'Event checkout'}
                        </ThemedText>
                        <ThemedText style={[styles.roundCheckInSub, { color: 'rgba(255,255,255,0.95)' }]}>
                          END EVENT SHIFT
                        </ThemedText>
                      </LinearGradient>
                    </Pressable>
                  </AnimatedReanimated.View>
                </View>
              ) : (
                /* Event check-in is on the event details page; home shows office only or a link to event */
                <View style={styles.roundCheckInRow}>
                  {(role === 'crew' || role === 'team_leader' || role === 'admin') && !hasApprovedTimeOffToday && isOfficeOpenToday && !officeCheckedOutToday ? (
                    <View style={styles.roundCheckInWrap}>
                        <AnimatedReanimated.View style={[styles.roundCheckInButtonWrap, showCheckoutCta ? checkoutButtonAnimatedStyle : undefined]}>
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
                                <Ionicons name={officeCheckinStep === 'you_made_it' || officeCheckoutStep === 'success_thankyou' || officeCheckoutStep === 'see_you' ? 'checkmark-circle' : showCheckoutCta ? 'exit' : 'location'} size={Icons.standard} color={officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary} />
                                <ThemedText style={[styles.roundCheckInLabel, styles.roundCheckInLabelDisabled, { color: officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary }]} numberOfLines={1}>{officeCheckinButtonLabel.label}</ThemedText>
                                <ThemedText style={[styles.roundCheckInSub, { color: officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary }]} numberOfLines={1}>OFFICE SHIFT</ThemedText>
                              </View>
                            ) : (
                              <LinearGradient
                                colors={showCheckoutCta ? [themeBlue, '#1e3a5f', '#0f1838'] : ['#facc15', themeYellow, '#b89107']}
                                style={styles.roundCheckInGradient}
                              >
                                <Ionicons name={showCheckoutCta ? 'exit' : 'location'} size={Icons.standard} color={showCheckoutCta ? '#fff' : themeBlue} />
                                <ThemedText style={[styles.roundCheckInLabel, { color: showCheckoutCta ? '#fff' : themeBlue }]} numberOfLines={1}>{officeCheckinButtonLabel.label}</ThemedText>
                                <ThemedText style={[styles.roundCheckInSub, { color: showCheckoutCta ? '#fff' : themeBlue }]} numberOfLines={1}>OFFICE SHIFT</ThemedText>
                              </LinearGradient>
                            )}
                          </Pressable>
                        </AnimatedReanimated.View>
                    </View>
                  ) : (
                    <View style={[styles.dailyCheckInStatus, styles.dailyCheckInStatusCompact, { backgroundColor: cardBg, borderColor: homeBorderColor }]}>
                      <Ionicons name="calendar-outline" size={Icons.standard} color={colors.textSecondary} />
                      <ThemedText style={[styles.dailyCheckInStatusTextCompact, { color: colors.textSecondary }]}>
                        Open My Events to check in at event
                      </ThemedText>
                    </View>
                  )}
                </View>
              )}

              {(role === 'crew' || role === 'team_leader' || role === 'admin') &&
                !hasApprovedTimeOffToday &&
                isOfficeOpenToday &&
                showCheckoutCta &&
                officeShiftLive &&
                !officeCheckedOutToday && (
                  <View
                    style={[
                      styles.dailyCheckInSecondary,
                      { backgroundColor: cardBg, borderColor: homeBorderColor, marginBottom: Spacing.sm },
                    ]}
                  >
                    <View style={{ paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm }}>
                      <ThemedText style={{ fontWeight: '600', fontSize: Typography.body, marginBottom: 6 }}>
                        Extra hours tracking
                      </ThemedText>
                      <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
                        Check-in {officeCheckinTimeStr || '—'}
                      </ThemedText>
                      <ThemedText style={{ color: colors.text, marginTop: 8 }}>
                        Working duration: {formatHoursLabel(officeShiftLive.totalHours)}
                      </ThemedText>
                      <ThemedText style={{ color: colors.text, marginTop: 4 }}>
                        Standard (0–8h): {formatHoursLabel(officeShiftLive.standardHours)}
                      </ThemedText>
                      <ThemedText
                        style={{
                          color: officeShiftLive.inExtra ? '#f97316' : colors.textSecondary,
                          marginTop: 4,
                        }}
                      >
                        Extra: {formatHoursLabel(officeShiftLive.extraHours)}
                      </ThemedText>
                      <ThemedText
                        style={{
                          marginTop: 10,
                          fontSize: 13,
                          fontWeight: '600',
                          color: officeShiftLive.inExtra ? '#f97316' : StatusColors.checkedIn,
                        }}
                      >
                        {officeShiftLive.statusLine}
                      </ThemedText>
                    </View>
                  </View>
                )}

              {/* Daily check-in (office): done or checkout row when event today */}
              {(role === 'crew' || role === 'team_leader' || role === 'admin') && !hasApprovedTimeOffToday && isOfficeOpenToday && (officeCheckedOutToday || showCheckoutCta) && (
                <View style={[styles.dailyCheckInSecondary, { backgroundColor: cardBg, borderColor: homeBorderColor }]}>
                  {officeCheckedOutToday ? (
                    <View style={styles.dailyCheckInSecondaryRow}>
                      <Ionicons name="checkmark-done-circle" size={Icons.standard} color={StatusColors.checkedIn} />
                      <View style={styles.dailyCheckInSecondaryInfo}>
                        <ThemedText style={[styles.dailyCheckInSecondaryLabel, { color: colors.textSecondary }]}>Daily check-in done</ThemedText>
                        <ThemedText style={[styles.dailyCheckInSecondaryTime, { color: colors.textSecondary }]}>{officeCheckinTimeStr && officeCheckoutTimeStr ? `${officeCheckinTimeStr} – ${officeCheckoutTimeStr}` : 'Done'}</ThemedText>
                        <ThemedText style={[styles.dailyCheckInSecondaryTime, { color: officeExtraHours > 0 ? '#f97316' : colors.textSecondary }]}>
                          Worked {formatHoursLabel(officeTotalHours)} · Standard {formatHoursLabel(officeStandardHoursStored)} · Extra{' '}
                          {formatHoursLabel(officeExtraHours)} · {officeDayTypeLabel}
                        </ThemedText>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={handleOfficeCheckOut}
                      disabled={checkInLoading}
                      style={({ pressed }) => [styles.dailyCheckInSecondaryRow, styles.dailyCheckInSecondaryButton, { opacity: pressed && !checkInLoading ? 0.8 : 1 }]}
                    >
                      <Ionicons name="exit-outline" size={Icons.standard} color={iconColor} />
                      <ThemedText style={[styles.dailyCheckInSecondaryLabel, { color: colors.text }]}>Office shift</ThemedText>
                      <ThemedText style={[styles.dailyCheckInSecondaryCta, { color: iconColor }]}>{officeCheckinSecondaryCta}</ThemedText>
                    </Pressable>
                  )}
                  {false && (
                    <ThemedText style={[styles.dailyCheckInHint, { color: colors.textSecondary }]}>
                      Check in at office first if you’re there, then tap the green button above when you arrive at the event.
                    </ThemedText>
                  )}
                </View>
              )}
              </>
            ) : hasApprovedTimeOffToday ? (
              /* Approved time off today: no daily check-in button */
              <View style={[styles.dailyCheckInStatus, { backgroundColor: cardBg, borderColor: homeBorderColor }]}>
                <Ionicons name="calendar-outline" size={Icons.xl} color={colors.textSecondary} />
                <ThemedText style={[styles.dailyCheckInStatusText, { color: colors.textSecondary }]}>You're on time off today</ThemedText>
              </View>
            ) : !isOfficeOpenToday ? (
              /* Weekend: office closed, no check-in button – compact to match other inline items */
              <View style={[styles.dailyCheckInStatus, styles.dailyCheckInStatusCompact, { backgroundColor: cardBg, borderColor: homeBorderColor }]}>
                <Ionicons name="business-outline" size={Icons.standard} color={colors.textSecondary} />
                <ThemedText style={[styles.dailyCheckInStatusTextCompact, { color: colors.textSecondary }]}>Office closed (weekend)</ThemedText>
              </View>
            ) : (isPermanentEmployee || role === 'team_leader' || role === 'admin') ? (
              /* No event today: Daily (office) check-in for permanent crew, team leaders, and admin. After checkout, hide button until next day. */
              hasCheckedIn && officeCheckedOutToday ? (
                <View style={[styles.dailyCheckInStatus, { backgroundColor: cardBg, borderColor: homeBorderColor }]}>
                  <Ionicons name="checkmark-done-circle" size={Icons.xl} color={StatusColors.checkedIn} />
                  <ThemedText style={[styles.dailyCheckInStatusText, { color: colors.textSecondary }]}>Done for today</ThemedText>
                  <ThemedText style={[styles.dailyCheckInTime, { color: colors.textSecondary }]}>{getSeeYouMessage()}</ThemedText>
                </View>
              ) : (
                <View style={styles.roundCheckInWrap}>
                  <AnimatedReanimated.View style={[styles.roundCheckInButtonWrap, showCheckoutCta ? checkoutButtonAnimatedStyle : undefined]}>
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
                          <Ionicons name={officeCheckinStep === 'you_made_it' || officeCheckoutStep === 'success_thankyou' || officeCheckoutStep === 'see_you' ? 'checkmark-circle' : showCheckoutCta ? 'exit' : 'location'} size={Icons.standard} color={officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary} />
                          <ThemedText style={[styles.roundCheckInLabel, styles.roundCheckInLabelDisabled, { color: officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary }]}>{officeCheckinButtonLabel.label}</ThemedText>
                          <ThemedText style={[styles.roundCheckInSub, { color: officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary }]}>{officeCheckinButtonLabel.sub}</ThemedText>
                        </View>
                      ) : (
                        <LinearGradient
                          colors={showCheckoutCta ? [themeBlue, '#1e3a5f', '#0f1838'] : ['#facc15', themeYellow, '#b89107']}
                          style={styles.roundCheckInGradient}
                        >
                          <Ionicons name={showCheckoutCta ? 'exit' : 'location'} size={Icons.standard} color={showCheckoutCta ? '#fff' : themeBlue} />
                          <ThemedText style={[styles.roundCheckInLabel, { color: showCheckoutCta ? '#fff' : themeBlue }]}>{officeCheckinButtonLabel.label}</ThemedText>
                          <ThemedText style={[styles.roundCheckInSub, { color: showCheckoutCta ? '#fff' : themeBlue }]}>{officeCheckinButtonLabel.sub}</ThemedText>
                        </LinearGradient>
                      )}
                    </Pressable>
                  </AnimatedReanimated.View>
                </View>
              )
            ) : officeCheckedOutToday ? (
              /* Temporary crew, no event today, but already checked out: hide button until next day */
              <View style={[styles.dailyCheckInStatus, { backgroundColor: cardBg, borderColor: homeBorderColor }]}>
                <Ionicons name="checkmark-done-circle" size={Icons.xl} color={StatusColors.checkedIn} />
                <ThemedText style={[styles.dailyCheckInStatusText, { color: colors.textSecondary }]}>Done for today</ThemedText>
                <ThemedText style={[styles.dailyCheckInTime, { color: colors.textSecondary }]}>{getSeeYouMessage()}</ThemedText>
              </View>
            ) : (
              /* Temporary crew, no event today: show Daily check-in (backend may reject if not allowed) */
              <View style={styles.roundCheckInWrap}>
                <AnimatedReanimated.View style={[styles.roundCheckInButtonWrap, showCheckoutCta ? checkoutButtonAnimatedStyle : undefined]}>
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
                        <Ionicons name={officeCheckinStep === 'you_made_it' || officeCheckoutStep === 'success_thankyou' || officeCheckoutStep === 'see_you' ? 'checkmark-circle' : showCheckoutCta ? 'exit' : 'location'} size={Icons.standard} color={officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary} />
                        <ThemedText style={[styles.roundCheckInLabel, styles.roundCheckInLabelDisabled, { color: officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary }]}>{officeCheckinButtonLabel.label}</ThemedText>
                        <ThemedText style={[styles.roundCheckInSub, { color: officeCheckinStep === 'you_made_it' || officeCheckoutStep !== 'idle' ? StatusColors.checkedIn : colors.textSecondary }]}>{officeCheckinButtonLabel.sub}</ThemedText>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={showCheckoutCta ? [themeBlue, '#1e3a5f', '#0f1838'] : ['#facc15', themeYellow, '#b89107']}
                        style={styles.roundCheckInGradient}
                      >
                        <Ionicons name={showCheckoutCta ? 'exit' : 'location'} size={Icons.standard} color={showCheckoutCta ? '#fff' : themeBlue} />
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

        {/* Quick Actions – 3 per row */}
        {sectionVisible.my_events || sectionVisible.assigned_tasks ? (
        <AnimatedReanimated.View entering={FadeInDown.duration(400).delay(140)} style={[styles.section, isCompactLayout ? styles.sectionCompact : null]}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionTitleAccent, styles.sectionTitleAccentVibe, { backgroundColor: themeYellow }]} />
            <View style={[styles.sectionTitleIconWrap, { backgroundColor: isDark ? 'rgba(249,250,251,0.12)' : themeYellow + '28' }]}>
              <Ionicons name="flash" size={Icons.small} color={isDark ? '#F9FAFB' : themeYellow} />
            </View>
            <ThemedText style={[styles.sectionTitle, { color: isDark ? '#F9FAFB' : '#0F172A' }]}>
              Quick actions
            </ThemedText>
            <Pressable onPress={() => handleNav(() => router.push('/(tabs)/everything'))} style={({ pressed }) => ({ opacity: pressed ? NAV_PRESSED_OPACITY : 1 })}>
              <ThemedText style={[styles.seeAllLink, { color: isDark ? colors.brandText : themeYellow }]}>See all</ThemedText>
            </Pressable>
          </View>
          <View style={styles.quickGrid}>
            {(() => {
              const COLS = 3;
              const rows: typeof visibleQuickActions[] = [];
              for (let i = 0; i < visibleQuickActions.length; i += COLS) {
                rows.push(visibleQuickActions.slice(i, i + COLS));
              }
              return rows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.quickGridRow}>
                  {row.map((action, colIndex) => {
                    const href = action.href;
                    const showEventDot = hasAssignedEventTodayForUser && action.id === 'events';
                    const index = rowIndex * COLS + colIndex;
                    return (
                      <AnimatedReanimated.View
                        key={action.id}
                        entering={FadeIn.delay(120 + index * 40).duration(320)}
                        style={styles.quickCardWrap}
                      >
                        <Pressable
                          onPress={() => href && handleNav(() => router.push(href as any))}
                          style={({ pressed }) => [
                            styles.quickCard,
                            {
                              backgroundColor: quickCardBg,
                              borderColor: homeBorderColor,
                              opacity: pressed ? NAV_PRESSED_OPACITY : 1,
                              transform: [{ scale: pressed ? 0.985 : 1 }],
                            },
                            quickCardShadow,
                          ]}
                        >
                          {showEventDot ? (
                            <View style={styles.quickCardEventDot} />
                          ) : null}
                          <View style={[styles.quickIconWrap, { backgroundColor: themeYellow + '1a', borderColor: themeYellow + '38' }]}>
                            <Ionicons name={action.icon as any} size={Icons.standard} color={themeYellow} />
                          </View>
                          <ThemedText style={[styles.quickLabel, { color: colors.text }]} numberOfLines={1}>
                            {action.label}
                          </ThemedText>
                        </Pressable>
                      </AnimatedReanimated.View>
                    );
                  })}
                </View>
              ));
            })()}
          </View>
        </AnimatedReanimated.View>
        ) : null}
        <View style={[styles.softSectionBreak, { backgroundColor: isDark ? colors.border + '99' : '#D1D5DB' }]} />

        {/* Admin: Past events */}
        {role === 'admin' && pastEvents.length > 0 && (
          <AnimatedReanimated.View entering={FadeIn.duration(400).delay(220)} style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionTitleAccent, styles.sectionTitleAccentVibe, { backgroundColor: isDark ? themeYellow : themeBlue }]} />
              <View style={[styles.sectionTitleIconWrap, { backgroundColor: isDark ? 'rgba(249,250,251,0.12)' : themeBlue + '28' }]}>
                <Ionicons name="calendar-outline" size={Icons.small} color={isDark ? '#F9FAFB' : themeBlue} />
              </View>
              <ThemedText style={[styles.sectionTitle, { color: isDark ? '#F9FAFB' : '#0F172A' }]}>
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
                  onPress={() =>
                    handleNav(() =>
                      router.push({
                        pathname: '/(tabs)/admin/events/[id]/operations',
                        params: { id: String(event.id) },
                      })
                    )
                  }
                  style={({ pressed }) => [
                    styles.eventCard,
                    { backgroundColor: cardBg, borderColor: homeBorderColor, borderLeftWidth: 3, borderLeftColor: isDark ? themeYellow : themeBlue, opacity: pressed ? NAV_PRESSED_OPACITY : 1 },
                    eventCardShadow,
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
                  <Ionicons name="chevron-forward" size={Icons.header} color={iconColor} />
                </Pressable>
              );
            })}
            {pastEvents.length > 6 && (
              <Pressable onPress={() => handleNav(() => router.push('/admin/events'))} style={({ pressed }) => [styles.viewAll, pressed && { opacity: NAV_PRESSED_OPACITY }]}>
                <ThemedText style={[styles.viewAllText, { color: colors.brandText }]}>View all ({pastEvents.length})</ThemedText>
                <Ionicons name="chevron-forward" size={Icons.medium} color={iconColor} />
              </Pressable>
            )}
          </AnimatedReanimated.View>
        )}

        {/* Active Streak (Pull Up Rate) – crew/team_leader only (keep as last item) */}
        {(role === 'crew' || role === 'team_leader') && sectionVisible.attendance_stats && (
          <>
            <AnimatedReanimated.View entering={FadeInDown.duration(360).delay(80)} style={[styles.section, styles.sectionLast]}>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionTitleAccent, styles.sectionTitleAccentVibe, { backgroundColor: StatusColors.checkedIn }]} />
                <View style={[styles.sectionTitleIconWrap, { backgroundColor: isDark ? 'rgba(249,250,251,0.12)' : StatusColors.checkedIn + '28' }]}>
                  <Ionicons name="trending-up" size={Icons.small} color={isDark ? '#F9FAFB' : StatusColors.checkedIn} />
                </View>
                <ThemedText style={[styles.sectionTitle, { color: isDark ? '#F9FAFB' : '#0F172A' }]}>
                  Active Streak
                </ThemedText>
              </View>
              <CrewAttendanceStatistic
                key={`attendance-${user?.office_checkin_time ?? optimisticOfficeCheckinTime ?? 'none'}-ev-${pivotData?.checkin_time ?? 'no'}`}
                refreshTrigger={user?.office_checkin_time ?? optimisticOfficeCheckinTime ?? pivotData?.checkin_time ?? undefined}
              />
            </AnimatedReanimated.View>
          </>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  welcomeCard: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg + 4,
    marginBottom: Spacing.lg,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    overflow: 'hidden',
  },
  welcomePatternLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  welcomeHex: {
    position: 'absolute',
  },
  welcomeHexShape: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderWidth: 1.5,
    borderRadius: 14,
    transform: [{ rotate: '30deg' }],
  },
  welcomeHexShapeSmall: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderWidth: 1.5,
    borderRadius: 10,
    transform: [{ rotate: '30deg' }],
  },
  welcomeHexShapeDot: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 5,
    transform: [{ rotate: '30deg' }],
  },
  welcomeHexOne: {
    top: -4,
    right: -8,
    transform: [{ rotate: '12deg' }],
  },
  welcomeHexTwo: {
    bottom: 10,
    right: 44,
    transform: [{ rotate: '-8deg' }],
  },
  welcomeHexThree: {
    top: 20,
    left: 16,
    transform: [{ rotate: '10deg' }],
  },
  welcomeCardCompact: {
    paddingVertical: Spacing.md + 2,
    marginBottom: Spacing.md,
  },
  welcomeGreeting: {
    fontSize: Typography.titleHero,
    fontWeight: Typography.titleLargeWeight,
    letterSpacing: 0.2,
    marginBottom: 6,
    lineHeight: 28,
  },
  welcomeMeta: {
    fontSize: Typography.bodySmall,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  welcomeMetaSmall: {
    fontSize: Typography.label,
    marginTop: 2,
    letterSpacing: 0.2,
    opacity: 0.9,
  },
  welcomeMetaBold: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.labelWeight,
    letterSpacing: 0.25,
    marginTop: 4,
    marginBottom: 0,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  statusChip: {
    flex: 1,
    minWidth: 0,
    flexBasis: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  statusChipText: {
    fontSize: Typography.statLabel,
    fontWeight: Typography.statLabelWeight,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  dailyCheckInSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  officeAfterEventCheckoutWrap: {
    marginTop: Spacing.md,
  },
  roundCheckInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xxl,
  },
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
  roundCheckInButtonEvent: {
    shadowColor: themeBlue,
    shadowOpacity: 0.4,
  },
  roundCheckInButtonOffice: {
    shadowColor: themeYellow,
    shadowOpacity: 0.35,
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
  roundCheckInSub: {
    fontSize: 7,
    fontWeight: Typography.statLabelWeight,
    marginTop: 1,
    letterSpacing: 0.2,
    textAlign: 'center',
    paddingHorizontal: 8,
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
    fontSize: 12,
    fontWeight: Typography.titleCardWeight,
    color: themeBlue,
    marginTop: 4,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  roundCheckInLabelDisabled: {
    color: '#71717A',
  },
  dailyCheckInStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dailyCheckInStatusCompact: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  dailyCheckInStatusDismissible: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  dailyCheckInStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  dailyCheckInStatusTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  checkedOutCloseBtn: {
    padding: Spacing.xs,
    marginTop: -Spacing.xs,
    marginRight: -Spacing.xs,
  },
  dailyCheckInStatusText: {
    fontSize: Typography.body,
    fontWeight: Typography.titleCardWeight,
    letterSpacing: 0.2,
  },
  dailyCheckInStatusTextCompact: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.buttonTextWeight,
    letterSpacing: 0.2,
  },
  dailyCheckInTime: {
    fontSize: Typography.bodySmall,
    marginTop: 2,
  },
  dailyCheckInSecondary: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dailyCheckInSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dailyCheckInSecondaryInfo: {
    flex: 1,
  },
  dailyCheckInSecondaryLabel: {
    fontSize: Typography.buttonText,
    fontWeight: Typography.buttonTextWeight,
  },
  dailyCheckInSecondaryTime: {
    fontSize: Typography.bodySmall,
  },
  dailyCheckInSecondaryButton: {
    paddingVertical: 2,
  },
  dailyCheckInSecondaryCta: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.buttonTextWeight,
  },
  dailyCheckInHint: {
    fontSize: Typography.label,
    marginTop: Spacing.xs,
    lineHeight: 16,
  },
  todayEventCard: {
    padding: Spacing.lg,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  todayEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  todayEventTitle: {
    fontSize: Typography.titleSection,
    fontWeight: Typography.titleSectionWeight,
    letterSpacing: Typography.titleSectionLetterSpacing,
    textTransform: 'uppercase',
    flex: 1,
  },
  confirmedBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: 9999,
    overflow: 'hidden',
  },
  confirmedBadgeText: {
    fontSize: Typography.statLabel,
    fontWeight: Typography.statLabelWeight,
    letterSpacing: 0.4,
  },
  todayEventName: {
    fontSize: Typography.titleLarge,
    fontWeight: Typography.titleLargeWeight,
    letterSpacing: 0.2,
    marginBottom: Spacing.sm,
    lineHeight: 24,
  },
  todayEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  todayEventMeta: {
    fontSize: Typography.bodySmall,
    flex: 1,
    lineHeight: 18,
  },
  viewDetailsLink: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.buttonTextWeight,
    marginTop: Spacing.md,
    letterSpacing: 0.2,
  },
  summaryCardsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 100,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryCardValue: {
    fontSize: Typography.statValue,
    fontWeight: Typography.statValueWeight,
    marginTop: Spacing.sm,
    letterSpacing: 0.2,
  },
  summaryCardLabel: {
    fontSize: Typography.statLabel,
    fontWeight: Typography.statLabelWeight,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  summaryCardAllowance: {
    borderLeftWidth: 4,
  },
  allowanceSectionHeader: {
    marginBottom: Spacing.md,
  },
  allowanceSectionTitle: {
    fontSize: Typography.titleCard,
    fontWeight: Typography.titleCardWeight,
    letterSpacing: 0.2,
  },
  summaryCardAllowanceEnhanced: {
    shadowRadius: 10,
    elevation: 2,
  },
  summaryCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionCompact: {
    marginBottom: Spacing.lg,
  },
  sectionLast: {
    marginBottom: Spacing.sm,
  },
  softSectionBreak: {
    height: 1,
    opacity: 0.55,
    marginTop: -Spacing.lg,
    marginBottom: Spacing.lg + 2,
    borderRadius: 999,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionTitleAccent: {
    width: 3,
    height: 16,
    borderRadius: 0,
  },
  sectionTitleAccentVibe: {
    width: 3,
    height: 16,
    borderRadius: 0,
  },
  sectionTitleIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todaysEventsSectionHeader: {
    marginBottom: Spacing.lg,
  },
  todaysEventsSectionTitle: {
    fontSize: Typography.titleCard,
    fontWeight: Typography.titleCardWeight,
    letterSpacing: 0.2,
  },
  sectionTitle: {
    fontSize: Typography.titleSection,
    fontWeight: Typography.titleSectionWeight,
    letterSpacing: Typography.titleSectionLetterSpacing,
    textTransform: 'uppercase',
    flex: 1,
  },
  seeAllLink: {
    fontSize: Typography.label,
    fontWeight: Typography.labelWeight,
    letterSpacing: 0.2,
    textDecorationLine: 'underline',
  },
  sectionTitlePlain: {
    fontSize: Typography.buttonText,
    fontWeight: Typography.buttonTextWeight,
    letterSpacing: 0.2,
    marginBottom: Spacing.lg,
  },
  activityCard: {
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    padding: Spacing.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  allowancesSection: {
    marginBottom: Spacing.lg,
  },
  allowanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  activityTimeline: {
    flexDirection: 'column',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  activityLeftColumn: {
    alignItems: 'center',
    width: 28,
  },
  activityTimelineLine: {
    width: 2,
    flex: 1,
    minHeight: Spacing.lg,
    marginTop: 4,
    borderRadius: 1,
  },
  activityItemNotFirst: {
    marginTop: Spacing.lg,
  },
  activityTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 2,
  },
  activityTimeAgo: {
    fontSize: Typography.titleSection,
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
    overflow: 'hidden',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.buttonTextWeight,
    marginBottom: 2,
  },
  activitySub: {
    fontSize: Typography.bodySmall,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: Typography.titleSection,
  },
  quickGrid: {
    gap: Spacing.sm,
  },
  quickGridRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickCardWrap: {
    flex: 1,
    minWidth: 0,
  },
  quickCard: {
    padding: Spacing.md,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 76,
    overflow: 'hidden',
  },
  quickCardEventDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    borderWidth: 1,
    overflow: 'hidden',
  },
  quickLabel: {
    fontSize: Typography.label,
    fontWeight: Typography.labelWeight,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  emptyCard: {
    padding: Spacing.lg * 1.5,
    borderRadius: Cards.borderRadius,
    borderWidth: 1,
    alignItems: 'center',
    borderStyle: 'dashed',
    overflow: 'hidden',
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
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  emptyTitle: {
    fontSize: Typography.titleCard,
    fontWeight: Typography.titleCardWeight,
    letterSpacing: 0.2,
    marginTop: Spacing.sm,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: Typography.bodySmall,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  emptyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyLinkText: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.buttonTextWeight,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Cards.borderRadiusSmall,
    borderWidth: 1,
    marginBottom: Spacing.sm,
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
    fontSize: Typography.buttonText,
    fontWeight: Typography.titleCardWeight,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  eventCardMeta: {
    fontSize: Typography.bodySmall,
    lineHeight: 18,
  },
  eventBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
  },
  eventBadgeText: {
    fontSize: Typography.statLabel,
    fontWeight: Typography.statLabelWeight,
    letterSpacing: 0.3,
    textTransform: 'capitalize',
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
  },
  viewAllText: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.buttonTextWeight,
  },
});
