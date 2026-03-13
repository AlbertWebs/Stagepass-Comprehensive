/**
 * Role-based bottom tab bar: different items for user vs admin.
 * User: Home, My Events, Activities, Profile.
 * Admin: Home, My Events, Create Event (emphasized), Profile.
 * Logout is in the header (top right).
 * Elegant, proportional, one-hand friendly, with clear active state and tap feedback.
 */
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter, usePathname } from 'expo-router';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useAppRole } from '~/hooks/useAppRole';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ICON_SIZE = 18;
const ICON_SIZE_ACTIVE = 20;
const LABEL_FONT_SIZE = 9;
const MIN_BOTTOM = Platform.OS === 'android' ? 12 : 6;
const INACTIVE_COLOR_LIGHT = '#6B7280';
const INACTIVE_COLOR_DARK = '#A1A1AA';

type TabItemConfig =
  | { name: string; route: string; label: string; iconName: IconSymbolName }
  | { name: string; route: string; label: string; iconIonicons: keyof typeof Ionicons.glyphMap };

/** Crew: Home, My Events, Activities, Profile (logout in Profile/header) */
const USER_TABS: TabItemConfig[] = [
  { name: 'index', route: 'index', label: 'Home', iconName: 'house.fill' },
  { name: 'events', route: 'events', label: 'My Events', iconName: 'calendar' },
  { name: 'activity', route: 'activity', label: 'Activities', iconIonicons: 'notifications-outline' },
  { name: 'profile', route: 'profile', label: 'Profile', iconName: 'person.fill' },
];

/** Team Leader / Admin: Dashboard, Events, Crew, Reports, Profile */
const ADMIN_TABS: TabItemConfig[] = [
  { name: 'index', route: 'index', label: 'Dashboard', iconName: 'house.fill' },
  { name: 'events', route: 'events', label: 'Events', iconName: 'calendar' },
  { name: 'admin', route: 'admin', label: 'Crew', iconIonicons: 'people' },
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

  const barBg = colors.surface;
  const barBorder = colors.border;
  const activeColor = isDark ? themeYellow : themeBlue;
  const inactiveColor = isDark ? INACTIVE_COLOR_DARK : INACTIVE_COLOR_LIGHT;

  const onTabPress = (routeName: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (routeName === 'admin') {
      router.push('/(tabs)/admin/manage-checkin');
      return;
    }
    if (routeName === 'adminReports') {
      router.push('/(tabs)/admin/reports');
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
  };

  return (
    <View style={[styles.bar, { paddingBottom: bottomInset, backgroundColor: barBg, borderTopColor: barBorder, shadowColor: isDark ? 'transparent' : '#000' }]}>
      {tabs.map((tab) => {
        const isAdminRoute = tab.name === 'admin' || tab.name === 'adminReports';
        const isActive = isAdminRoute
          ? (pathname?.includes('/admin/manage-checkin') && tab.name === 'admin') ||
            (pathname?.includes('/admin/reports') && tab.name === 'adminReports')
          : activeRouteName === tab.name;
        const color = isActive ? activeColor : inactiveColor;

        const iconSize = isActive ? ICON_SIZE_ACTIVE : ICON_SIZE;
        const label = tab.label.toUpperCase();

        const content = (
          <>
            {'iconIonicons' in tab ? (
              <Ionicons name={tab.iconIonicons} size={iconSize} color={color} />
            ) : (
              <IconSymbol name={tab.iconName} size={iconSize} color={color} />
            )}
            <Text style={[styles.label, { color }, isActive && styles.labelActive]} numberOfLines={1}>
              {label}
            </Text>
          </>
        );

        return (
          <Pressable
            key={tab.name}
            onPress={() => onTabPress(tab.route)}
            style={({ pressed }) => [
              styles.tabItem,
              isActive && { backgroundColor: activeColor + '14' },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingHorizontal: 2,
    paddingBottom: 4,
    minHeight: 48,
    borderTopWidth: 1,
    elevation: 6,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    minWidth: 0,
    borderRadius: 10,
    marginHorizontal: 2,
  },
  label: {
    fontSize: LABEL_FONT_SIZE,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.4,
  },
  labelActive: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
