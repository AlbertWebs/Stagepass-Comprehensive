/**
 * Admin-only tab: redirect to Create Event form so one tap opens the form.
 * Hidden for non-admin via href: null in layout.
 */
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { StagepassLoader } from '@/components/StagepassLoader';

export default function CreateEventRedirectScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/events/create');
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <StagepassLoader message="Opening…" />
    </View>
  );
}
