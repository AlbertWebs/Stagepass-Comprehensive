import type { User } from '@/services/api';

const SUPER_ADMIN_ROLES = new Set(['super_admin', 'admin', 'director']);

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;
  const roleNames = (user.roles ?? []).map((role) => role.name.toLowerCase());
  if (roleNames.some((name) => SUPER_ADMIN_ROLES.has(name))) return true;
  return user.permissions?.includes(permission) ?? false;
}

export function isSuperAdministrator(user: User | null): boolean {
  return Boolean(user?.roles?.some((role) => SUPER_ADMIN_ROLES.has(role.name.toLowerCase())));
}
