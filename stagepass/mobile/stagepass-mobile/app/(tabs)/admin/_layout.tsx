/**
 * Admin section: stack only (no tab bar). Uses main (tabs) bottom nav.
 * Non-admin redirects to home, except:
 * - crew can open time-off
 * - crew who are event team leaders (event detail "Event operations") can open per-event admin routes
 *
 * Uses pathname for event sub-routes: nested layouts often omit `events` from useSegments(),
 * which incorrectly sent crew leaders and briefly-hydrated users to the home tab.
 */
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useAppRole } from '~/hooks/useAppRole';
import type { User } from '~/services/api';

/** Crew may open these under admin/events/[id]/… (tail match tolerates one-frame pathname lag). */
const CREW_EVENT_TAIL = /\/(operations|crew|checklist|manage-checkin|edit|message|create-task)(\/|$|\?)/i;

function isCrewEventWorkflowPath(path: string, segmentsJoined: string): boolean {
  if (CREW_EVENT_TAIL.test(path) && path.includes('admin/events')) return true;
  const strict =
    /admin\/events\/[^/]+\/(?:operations|crew|checklist|manage-checkin|edit|message|create-task)(?:\/|$|\?)/i;
  return strict.test(segmentsJoined);
}

export default function AdminLayout() {
  const role = useAppRole();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const segments = useSegments();
  const isLoading = useSelector((s: { auth: { isLoading: boolean } }) => s.auth.isLoading);
  const user = useSelector((s: { auth: { user: User | null } }) => s.auth.user);

  const isTimeOffScreen = Array.isArray(segments) && segments.includes('timeoff');
  const isCrewEventWorkflow =
    role === 'crew' && isCrewEventWorkflowPath(pathname, segments.join('/'));
  const canAccessAdmin =
    role === 'admin' ||
    role === 'team_leader' ||
    role === 'operations' ||
    (role === 'crew' && (isTimeOffScreen || isCrewEventWorkflow));

  const roleReady = !isLoading && user != null;
  const showAdminStack = canAccessAdmin || !roleReady;

  useEffect(() => {
    if (!roleReady) return;
    if (!canAccessAdmin) {
      router.replace('/(tabs)');
    }
  }, [roleReady, canAccessAdmin, router]);

  if (!showAdminStack) {
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
