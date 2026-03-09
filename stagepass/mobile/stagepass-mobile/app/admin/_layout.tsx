/**
 * Admin section: only accessible when user role is admin.
 * Redirects non-admin to home.
 */
import { Redirect, Stack } from 'expo-router';
import { useAppRole } from '~/hooks/useAppRole';

export default function AdminLayout() {
  const role = useAppRole();

  if (role !== 'admin') {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
