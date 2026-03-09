import { useSelector } from 'react-redux';
import { getRole, type RoleName, type User } from '../services/api';

type AuthState = { user: User | null };

export function useAppRole(): RoleName {
  const user = useSelector((s: { auth: AuthState }) => s.auth.user);
  return getRole(user);
}

/** Alias for useAppRole – role-based app experience */
export const useUserRole = useAppRole;

export function useUser(): User | null {
  return useSelector((s: { auth: AuthState }) => s.auth.user);
}
