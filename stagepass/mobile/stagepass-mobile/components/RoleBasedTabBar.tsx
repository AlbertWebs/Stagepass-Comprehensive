/**
 * Role-based bottom tab bar: different items for user vs admin.
 * User: Home, My Events, Activities, Profile.
 * Admin: Dashboard, Crew, Projects (center, emphasized), Reports, Profile.
 * Logout is in the header (top right).
 */
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter, usePathname } from 'expo-router';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { themeBlue, themeYellow } from '@/constants/theme';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { useAppRole } from '~/hooks/useAppRole';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationPress, NAV_PRESSED_OPACITY } from '@/src/utils/navigationPress';

const ICON_SIZE = 18;
const ICON_SIZE_ACTIVE = 20;
const PROJECTS_ICON_SIZE = 26;
const LABEL_FONT_SIZE = 9;
const PROJECTS_LABEL_SIZE = 10;
const MIN_BOTTOM = Platform.OS === 'android' ? 12 : 6;
const INACTIVE_COLOR_LIGHT = '#6B7280';
const INACTIVE_COLOR_DARK = '#A1A1AA';

type TabItemConfig =
  | { name: string; route: string; label: string; iconName: IconSymbolName; center?: boolean }
  | { name: string; route: string; label: string; iconIonicons: keyof typeof Ionicons.glyphMap; center?: boolean };

/** Crew: Home, My Events, Activities, Profile */
const USER_TABS: TabItemConfig[] = [
  { name: 'index', route: 'index', label: 'Home', iconName: 'house.fill' },
  { name: 'events', route: 'events', label: 'My Events', iconName: 'calendar' },
  { name: 'activity', route: 'activity', label: 'Activities', iconIonicons: 'notifications-outline' },
  { name: 'profile', route: 'profile', label: 'Profile', iconName: 'person.fill' },
];

/** Admin: Dashboard, Crew (users), Projects (center / events list), Reports, Profile */
const ADMIN_TABS: TabItemConfig[] = [
  { name: 'index', route: 'index', label: 'Dashboard', iconName: 'house.fill' },
  { name: 'admin', route: 'admin', label: 'Crew', iconIonicons: 'people' },
  { name: 'adminProjects', route: 'adminProjects', label: 'Projects', iconIonicons: 'folder-open', center: true },
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

  const handleNav = useNavigationPress();

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
    <View style={[styles.bar, { paddingBottom: bottomInset, backgroundColor: barBg, borderTopColor: barBorder, shadowColor: isDark ? 'transparent' : '#000' }]}>
      {tabs.map((tab) => {
        const isAdminRoute = tab.name === 'admin' || tab.name === 'adminReports' || tab.name === 'adminProjects';
        const isActive = isAdminRoute
          ? (pathname?.includes('/admin/users') && tab.name === 'admin') ||
            (pathname?.includes('/admin/reports') && tab.name === 'adminReports') ||
            (pathname?.includes('/admin/events') && tab.name === 'adminProjects')
          : activeRouteName === tab.name;
        const color = isActive ? activeColor : inactiveColor;
        const isCenter = 'center' in tab && tab.center === true;

        const iconSize = isCenter ? PROJECTS_ICON_SIZE : (isActive ? ICON_SIZE_ACTIVE : ICON_SIZE);
        const label = tab.label.toUpperCase();

        const iconEl = 'iconIonicons' in tab ? (
          <Ionicons name={tab.iconIonicons} size={iconSize} color={isCenter && isActive ? themeBlue : color} />
        ) : (
          <IconSymbol name={tab.iconName} size={iconSize} color={color} />
        );
        const projectsIconColor = isActive ? themeBlue : inactiveColor;
        const projectsIconEl = 'iconIonicons' in tab ? (
          <Ionicons name={tab.iconIonicons} size={iconSize} color={projectsIconColor} />
        ) : null;

        const content = isCenter ? (
          <View style={styles.projectsTabInner}>
            <View style={[styles.projectsTabIconWrap, isActive && styles.projectsTabIconWrapActive, { borderColor: color }]}>
              {isActive ? (
                <LinearGradient
                  colors={[themeYellow, '#d4a506']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              ) : null}
              <View style={styles.projectsTabIconInner}>{projectsIconEl}</View>
            </View>
            <Text style={[styles.projectsLabel, { color }, isActive && styles.projectsLabelActive]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ) : (
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
            style={({ pressed }) => [
              styles.tabItem,
              isCenter && styles.tabItemCenter,
              !isCenter && isActive && { backgroundColor: activeColor + '14' },
              pressed && { opacity: NAV_PRESSED_OPACITY },
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
  tabItemCenter: {
    flex: 1.35,
  },
  projectsTabInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectsTabIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    overflow: 'hidden',
  },
  projectsTabIconWrapActive: {
    borderColor: themeBlue,
    shadowColor: themeYellow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  projectsTabIconInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectsLabel: {
    fontSize: PROJECTS_LABEL_SIZE,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  projectsLabelActive: {
    fontWeight: '800',
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
});
