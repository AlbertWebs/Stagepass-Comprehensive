import { Tabs } from 'expo-router';
import React from 'react';

import { RoleBasedTabBar } from '@/components/RoleBasedTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <RoleBasedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="events" options={{ title: 'My Events' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activities' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="createEvent" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="admin" options={{ href: null }} />
      <Tabs.Screen name="recent-activity" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="quick-actions" options={{ href: null }} />
      <Tabs.Screen name="everything" options={{ href: null }} />
      <Tabs.Screen name="preferences" options={{ href: null }} />
      <Tabs.Screen name="allowances" options={{ href: null }} />
      <Tabs.Screen name="logout" options={{ title: 'Logout', href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
