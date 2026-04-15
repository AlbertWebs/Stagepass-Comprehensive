/**
 * Role-based bottom tab bar: different items for user vs admin.
 * User: Home, My Events, Activities, Profile.
 * Admin: Dashboard, Crew, Projects (center, emphasized), Reports, Profile.
 * Logout is in the header (top right).
 */
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter, usePathname } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Icons } from '@/constants/ui';
import { themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useAppRole } from '~/hooks/useAppRole';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationPress, NAV_PRESSED_OPACITY } from '@/src/utils/navigationPress';
import { api } from '~/services/api';
import { useSelector } from 'react-redux';

/** Match header (top right) icons – Icons.header = 20 */
const TAB_ICON_SIZE = Icons.header;
const LABEL_FONT_SIZE = 8;
const MIN_BOTTOM = Platform.OS === 'android' ? 12 : 8;
const TAB_MIN_HEIGHT = 36;
const HIT_SLOP = { top: 8, bottom: 8, left: 12, right: 12 };
const INACTIVE_COLOR_LIGHT = '#6B7280';
const INACTIVE_COLOR_DARK = '#A1A1AA';

const todayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function eventDateOnly(event: { date?: string | null }): string {
  if (!event.date || typeof event.date !== 'string') return '';
  const s = event.date.trim();
  return s.length >= 10 ? s.substring(0, 10) : s;
}

type TabItemConfig =
  | { name: string; route: string; label: string; iconName: IconSymbolName; center?: boolean }
  | { name: string; route: string; label: string; iconIonicons: keyof typeof Ionicons.glyphMap; center?: boolean };

/** User (crew/team_leader): Home, My Events, Activities, Tasks, Profile */
const USER_TABS: TabItemConfig[] = [
  { name: 'index', route: 'index', label: 'Home', iconName: 'house.fill' },
  { name: 'events', route: 'events', label: 'My Events', iconName: 'calendar' },
  { name: 'activity', route: 'activity', label: 'Activities', iconIonicons: 'notifications-outline' },
  { name: 'tasks', route: 'tasks', label: 'Tasks', iconIonicons: 'checkbox-outline' },
  { name: 'profile', route: 'profile', label: 'Profile', iconName: 'person.fill' },
];

/** Admin: Dashboard, Crew (users), Projects (center / events list), Reports, Profile */
const ADMIN_TABS: TabItemConfig[] = [
  { name: 'index', route: 'index', label: 'Dashboard', iconName: 'house.fill' },
  { name: 'admin', route: 'admin', label: 'Crew', iconIonicons: 'people' },
  { name: 'adminProjects', route: 'adminProjects', label: 'Projects', iconIonicons: 'folder-open' },
  { name: 'adminReports', route: 'adminReports', label: 'Reports', iconIonicons: 'document-text' },
  { name: 'profile', route: 'profile', label: 'Profile', iconName: 'person.fill' },
];

export function RoleBasedTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const role = useAppRole();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useStagePassTheme();
  const bottomInset = Math.max(insets.bottom, MIN_BOTTOM);
  const isTeamLeaderOrAdmin = role === 'admin' || role === 'team_leader';
  const tabs = isTeamLeaderOrAdmin ? ADMIN_TABS : USER_TABS;
  const activeRouteName = state.routes[state.index]?.name;
  const [hasEventToday, setHasEventToday] = useState(false);
  const dotPulse = useRef(new Animated.Value(0)).current;
  const authUser = useSelector((s: { auth: { user: { id?: number } | null } }) => s.auth.user);

  const barBg = colors.surface;
  const barBorder = colors.border;
  const activeColor = isDark ? themeYellow : themeYellow;
  const inactiveColor = isDark ? INACTIVE_COLOR_DARK : INACTIVE_COLOR_LIGHT;
  const lightBarBg = '#FFFFFF';
  const lightBarBorder = 'rgba(37, 99, 235, 0.16)';

  const handleNav = useNavigationPress();

  const refreshEventTodayDot = useCallback(async () => {
    if (isTeamLeaderOrAdmin) {
      setHasEventToday(false);
      return;
    }
    try {
      const today = todayDateString();
      const res = await api.events.myEventToday(today);
      if (res?.event) {
        const currentUserId = authUser?.id;
        const assignment = currentUserId != null
          ? res.event.crew?.find((c: { id?: number }) => c.id === currentUserId)
          : res.event.crew?.find((c: { pivot?: unknown }) => Boolean(c.pivot));
        const pivot = assignment && typeof assignment === 'object' && 'pivot' in assignment
          ? (assignment.pivot as { checkin_time?: string | null } | undefined)
          : undefined;
        const alreadyCheckedIn = Boolean(pivot?.checkin_time);
        setHasEventToday(!alreadyCheckedIn);
        return;
      }

      // Fallback: some users still have today's assignment visible in list even when myEventToday is empty.
      const listRes = await api.events.list({ per_page: 100 });
      const list = Array.isArray(listRes?.data) ? listRes.data : [];
      const hasToday = list.some((e: { date?: string | null }) => eventDateOnly(e) === today);
      setHasEventToday(hasToday);
    } catch {
      setHasEventToday(false);
    }
  }, [isTeamLeaderOrAdmin, authUser?.id]);

  useFocusEffect(
    useCallback(() => {
      refreshEventTodayDot();
    }, [refreshEventTodayDot])
  );

  // Also refresh when tab/route changes so the dot stays in sync.
  useEffect(() => {
    refreshEventTodayDot();
  }, [refreshEventTodayDot, pathname, state.index]);

  useEffect(() => {
    if (!hasEventToday) {
      dotPulse.stopAnimation();
      dotPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dotPulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hasEventToday, dotPulse]);

  const onTabPress = (routeName: string) => {
    handleNav(() => {
      if (routeName === 'admin') {
        router.push('/(tabs)/admin/users');
        return;
      }
      if (routeName === 'adminProjects') {
        router.push('/(tabs)/admin/events');
        return;
      }
      if (routeName === 'adminReports') {
        router.push('/(tabs)/admin/reports');
        return;
      }
      if (routeName === 'events') {
        router.push('/(tabs)/events');
        return;
      }
      const event = navigation.emit({
        type: 'tabPress',
        target: state.routes.find((r) => r.name === routeName)?.key ?? '',
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) {
        navigation.navigate(routeName as never);
      }
    });
  };

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: bottomInset,
          backgroundColor: isDark ? barBg : lightBarBg,
          borderTopColor: isDark ? barBorder : lightBarBorder,
          shadowColor: isDark ? 'transparent' : '#0F172A',
          shadowOpacity: isDark ? 0 : 0.08,
          shadowRadius: isDark ? 8 : 12,
        },
      ]}
    >
      {tabs.map((tab) => {
        const isAdminRoute = tab.name === 'admin' || tab.name === 'adminReports' || tab.name === 'adminProjects';
        const isActive = isAdminRoute
          ? (pathname?.includes('/admin/users') && tab.name === 'admin') ||
            (pathname?.includes('/admin/reports') && tab.name === 'adminReports') ||
            (pathname?.includes('/admin/events') && tab.name === 'adminProjects')
          : activeRouteName === tab.name;
        const color = isActive ? activeColor : inactiveColor;

        const iconSize = TAB_ICON_SIZE;
        const label = tab.label.toUpperCase();

        const iconEl = (
          <View style={styles.iconWrap}>
            {'iconIonicons' in tab ? (
              <Ionicons name={tab.iconIonicons} size={iconSize} color={color} />
            ) : (
              <IconSymbol name={tab.iconName} size={iconSize} color={color} />
            )}
            {tab.name === 'events' && hasEventToday && !isActive ? (
              <Animated.View
                style={[
                  styles.eventTodayDotGlow,
                  {
                    transform: [
                      {
                        scale: dotPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.4],
                        }),
                      },
                    ],
                    opacity: dotPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.45, 0.12],
                    }),
                  },
                ]}
              />
            ) : null}
            {tab.name === 'events' && hasEventToday && !isActive ? (
              <View style={styles.eventTodayDot} />
            ) : null}
          </View>
        );

        const content = (
          <>
            {iconEl}
            <Text style={[styles.label, { color }, isActive && styles.labelActive]} numberOfLines={1}>
              {label}
            </Text>
          </>
        );

        return (
          <Pressable
            key={tab.name}
            onPress={() => onTabPress(tab.route)}
            hitSlop={HIT_SLOP}
            style={({ pressed }) => [
              styles.tabItem,
              pressed && { opacity: NAV_PRESSED_OPACITY },
            ]}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            {isActive ? (
              <View style={styles.tabItemContent}>
                <View style={[styles.activeDot, { backgroundColor: activeColor }]} />
                {content}
              </View>
            ) : (
              content
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 5,
    paddingHorizontal: 4,
    paddingBottom: 1,
    minHeight: 42,
    borderTopWidth: 1,
    elevation: 8,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    overflow: 'visible',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TAB_MIN_HEIGHT,
    paddingVertical: 2,
    paddingHorizontal: 3,
    minWidth: 0,
    borderRadius: 13,
    marginHorizontal: 2,
  },
  tabItemContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrap: {
    position: 'relative',
  },
  eventTodayDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  eventTodayDotGlow: {
    position: 'absolute',
    top: -5,
    right: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 1,
  },
  label: {
    fontSize: LABEL_FONT_SIZE,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  labelActive: {
    fontWeight: '700',
  },
});
