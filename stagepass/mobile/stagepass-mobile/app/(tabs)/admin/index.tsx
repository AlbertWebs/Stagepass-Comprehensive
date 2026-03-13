/**
 * Admin dashboard entry. Redirects to Events management.
 */
import { Redirect } from 'expo-router';

export default function AdminIndexScreen() {
  return <Redirect href="/admin/events" />;
}
