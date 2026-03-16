/**
 * Quick actions shown on home and Quick Actions page. Filter by role at use site.
 */
import type { RoleName } from '~/services/api';

export type QuickAction = {
  id: string;
  label: string;
  icon: string;
  href: string;
  roles?: RoleName[];
};

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'create', label: 'Create Event', icon: 'add-circle', href: '/admin/events/create', roles: ['admin'] },
  { id: 'events', label: 'My Events', icon: 'calendar', href: '/(tabs)/events' },
  { id: 'checkin', label: 'Crew Check-in', icon: 'location', href: '/(tabs)/events', roles: ['crew', 'team_leader'] },
  { id: 'activity', label: 'Activities', icon: 'notifications', href: '/(tabs)/activity' },
  { id: 'tasks', label: 'Tasks', icon: 'checkbox', href: '/(tabs)/tasks', roles: ['crew', 'team_leader'] },
  { id: 'allowances', label: 'Allowances', icon: 'wallet-outline', href: '/(tabs)/allowances', roles: ['crew', 'team_leader'] },
  { id: 'requestoff', label: 'Request off', icon: 'time-outline', href: '/admin/timeoff' },
  { id: 'managecheckin', label: 'Manage check-in', icon: 'location', href: '/admin/manage-checkin', roles: ['admin', 'team_leader'] },
  { id: 'checklist', label: 'Checklist', icon: 'checkbox', href: '/admin/checklists', roles: ['admin', 'team_leader'] },
  { id: 'equipment', label: 'Equipment', icon: 'cube', href: '/admin/equipment', roles: ['admin', 'logistics'] },
  { id: 'reports', label: 'Reports', icon: 'bar-chart', href: '/admin/reports', roles: ['admin'] },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', href: '/admin/settings', roles: ['admin', 'team_leader'] },
];
