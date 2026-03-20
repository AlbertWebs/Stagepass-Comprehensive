/**
 * Admin section: stack only (no tab bar). Uses main (tabs) bottom nav.
 * Non-admin redirects to home, except crew can access the time-off request screen.
 */
import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAppRole } from '~/hooks/useAppRole';

export default function AdminLayout() {
  const role = useAppRole();
  const router = useRouter();
  const segments = useSegments();
  const isTimeOffScreen = Array.isArray(segments) && segments.includes('timeoff');
  const canAccessAdmin = role === 'admin' || role === 'team_leader' || (role === 'crew' && isTimeOffScreen);

  useEffect(() => {
    if (!canAccessAdmin) {
      router.replace('/(tabs)');
    }
  }, [canAccessAdmin, router]);

  if (!canAccessAdmin) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
