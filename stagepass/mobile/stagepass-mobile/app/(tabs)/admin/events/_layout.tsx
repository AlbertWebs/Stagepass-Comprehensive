/**
 * Events tab: Stack so list, create, [id]/edit, crew, operations all work.
 */
import { Stack } from 'expo-router';

export default function AdminEventsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
