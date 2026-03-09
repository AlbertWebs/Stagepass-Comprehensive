import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { themeBlue, themeYellow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const TAB_ICON_SIZE = 18;
const TAB_ICON_SIZE_FOCUSED = 20;
/** Minimum bottom padding so tab bar sits above Android system nav bar when insets.bottom is 0 */
const MIN_TAB_BAR_BOTTOM = Platform.OS === 'android' ? 48 : 12;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const activeColor = themeYellow;
  const inactiveColor = 'rgba(255,255,255,0.55)';
  const tabBarBottom = Math.max(insets.bottom, MIN_TAB_BAR_BOTTOM);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: themeBlue,
          borderTopWidth: 3,
          borderTopColor: themeYellow,
          paddingTop: 6,
          paddingBottom: tabBarBottom,
          paddingHorizontal: 4,
          elevation: 16,
          shadowColor: themeBlue,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          paddingHorizontal: 2,
          minWidth: 0,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <IconSymbol
              name="house.fill"
              size={focused ? TAB_ICON_SIZE_FOCUSED : TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'My Events',
          tabBarIcon: ({ focused, color }) => (
            <IconSymbol
              name="calendar"
              size={focused ? TAB_ICON_SIZE_FOCUSED : TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activities',
          tabBarIcon: ({ focused, color }) => (
            <IconSymbol
              name="clock.fill"
              size={focused ? TAB_ICON_SIZE_FOCUSED : TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <IconSymbol
              name="person.fill"
              size={focused ? TAB_ICON_SIZE_FOCUSED : TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="logout"
        options={{
          title: 'Logout',
          tabBarIcon: ({ focused, color }) => (
            <IconSymbol
              name="rectangle.portrait.and.arrow.right"
              size={focused ? TAB_ICON_SIZE_FOCUSED : TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
