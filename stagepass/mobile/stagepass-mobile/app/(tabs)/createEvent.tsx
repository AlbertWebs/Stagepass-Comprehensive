/**
 * Admin-only tab: redirect to Create Event form when this tab is opened directly.
 * Tab bar now navigates straight to /admin/events/create; this handles direct navigation to createEvent.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { StagepassLoader } from '@/components/StagepassLoader';

export default function CreateEventRedirectScreen() {
  const router = useRouter();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (didRedirect.current) return;
    didRedirect.current = true;
    router.push('/admin/events/create');
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <StagepassLoader message="Opening…" />
    </View>
  );
}
