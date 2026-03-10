/**
 * Admin section: bottom tab nav (Events, Users, More). Non-admin redirects to home.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticTab } from '@/components/haptic-tab';
import { themeBlue, themeYellow } from '@/constants/theme';
import { useAppRole } from '~/hooks/useAppRole';

const TAB_ICON_SIZE = 20;
const MIN_TAB_BAR_BOTTOM = Platform.OS === 'android' ? 48 : 12;

export default function AdminLayout() {
  const role = useAppRole();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarBottom = Math.max(insets.bottom, MIN_TAB_BAR_BOTTOM);

  const canAccessAdmin = role === 'admin' || role === 'team_leader';

  useEffect(() => {
    if (!canAccessAdmin) {
      router.replace('/(tabs)');
    }
  }, [canAccessAdmin, router]);

  if (!canAccessAdmin) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: themeYellow,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
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
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarItemStyle: {
          paddingVertical: 4,
          paddingHorizontal: 4,
          minWidth: 0,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name="calendar" size={focused ? 22 : TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name="people" size={focused ? 22 : TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name="apps" size={focused ? 22 : TAB_ICON_SIZE} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="communications" options={{ href: null }} />
      <Tabs.Screen name="equipment" options={{ href: null }} />
      <Tabs.Screen name="clients" options={{ href: null }} />
      <Tabs.Screen name="reports" options={{ href: null }} />
      <Tabs.Screen name="payments" options={{ href: null }} />
      <Tabs.Screen name="timeoff" options={{ href: null }} />
      <Tabs.Screen name="audit" options={{ href: null }} />
      <Tabs.Screen name="manage-checkin" options={{ href: null }} />
      <Tabs.Screen name="checklists" options={{ href: null }} />
    </Tabs>
  );
}
