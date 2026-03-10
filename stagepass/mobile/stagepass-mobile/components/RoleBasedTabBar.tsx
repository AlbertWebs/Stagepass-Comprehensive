/**
 * Role-based bottom tab bar: different items for user vs admin.
 * User: Home, My Events, Activities, Profile.
 * Admin: Home, My Events, Create Event (emphasized), Profile.
 * Logout is in the header (top right).
 * Elegant, proportional, one-hand friendly, with clear active state and tap feedback.
 */
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { themeBlue, themeYellow } from '@/constants/theme';
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

const ICON_SIZE = 22;
const ICON_SIZE_ACTIVE = 24;
const CREATE_FAB_SIZE = 56;
const CREATE_ICON_SIZE = 28;
const LABEL_FONT_SIZE = 10;
const MIN_BOTTOM = Platform.OS === 'android' ? 16 : 8;
/** How much the Create Event button overshoots above the bar (negative = upward) */
const CREATE_OVERSHOOT = 20;

type TabItemConfig =
  | { name: string; route: string; label: string; iconName: IconSymbolName }
  | { name: string; route: string; label: string; iconIonicons: keyof typeof Ionicons.glyphMap };

const USER_TABS: TabItemConfig[] = [
  { name: 'index', route: 'index', label: 'Home', iconName: 'house.fill' },
  { name: 'events', route: 'events', label: 'My Events', iconName: 'calendar' },
  { name: 'activity', route: 'activity', label: 'Activities', iconName: 'clock.fill' },
  { name: 'tasks', route: 'tasks', label: 'Tasks', iconIonicons: 'checkbox' },
  { name: 'profile', route: 'profile', label: 'Profile', iconName: 'person.fill' },
];

const ADMIN_TABS: TabItemConfig[] = [
  { name: 'index', route: 'index', label: 'Home', iconName: 'house.fill' },
  { name: 'events', route: 'events', label: 'My Events', iconName: 'calendar' },
  { name: 'createEvent', route: 'createEvent', label: 'Create Event', iconIonicons: 'add-circle' },
  { name: 'tasks', route: 'tasks', label: 'Tasks', iconIonicons: 'checkbox' },
  { name: 'profile', route: 'profile', label: 'Profile', iconName: 'person.fill' },
];

export function RoleBasedTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const role = useAppRole();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, MIN_BOTTOM);
  const isAdmin = role === 'admin';
  const tabs = isAdmin ? ADMIN_TABS : USER_TABS;
  const activeRouteName = state.routes[state.index]?.name;

  const onTabPress = (routeName: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    <View style={[styles.bar, { paddingBottom: bottom }]}>
      {tabs.map((tab) => {
        const isActive = activeRouteName === tab.name;
        const isCreateEvent = tab.name === 'createEvent';
        const color = isActive ? themeYellow : 'rgba(255,255,255,0.55)';

        if (isCreateEvent) {
          return (
            <View key={tab.name} style={styles.createEventSlot}>
              <Pressable
                onPress={() => onTabPress(tab.route)}
                style={({ pressed }) => [
                  styles.createEventFab,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
              >
                <Ionicons name="add-circle" size={CREATE_ICON_SIZE} color={themeBlue} />
              </Pressable>
              <Text style={styles.createEventLabel} numberOfLines={1}>
                {tab.label}
              </Text>
            </View>
          );
        }

        const iconSize = isActive ? ICON_SIZE_ACTIVE : ICON_SIZE;
        const content = (
          <>
            {'iconIonicons' in tab ? (
              <Ionicons name={tab.iconIonicons} size={iconSize} color={color} />
            ) : (
              <IconSymbol name={tab.iconName} size={iconSize} color={color} />
            )}
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </>
        );

        return (
          <Pressable
            key={tab.name}
            onPress={() => onTabPress(tab.route)}
            style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            {isActive && <View style={styles.activeDot} />}
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
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 4,
    minHeight: 52,
    backgroundColor: themeBlue,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minWidth: 0,
  },
  activeDot: {
    position: 'absolute',
    top: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: themeYellow,
  },
  createEventSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
    minWidth: 0,
  },
  createEventFab: {
    width: CREATE_FAB_SIZE,
    height: CREATE_FAB_SIZE,
    borderRadius: CREATE_FAB_SIZE / 2,
    backgroundColor: themeYellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -CREATE_OVERSHOOT,
    borderWidth: 3,
    borderColor: themeBlue,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  createEventLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
    color: 'rgba(255,255,255,0.9)',
  },
  label: {
    fontSize: LABEL_FONT_SIZE,
    fontWeight: '600',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
