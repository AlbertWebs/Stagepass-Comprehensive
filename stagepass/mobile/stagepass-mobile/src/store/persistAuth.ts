import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { setAuthToken } from '../services/api';

const TOKEN_KEY = 'stagepass_token';
const LOCKOUT_UNTIL_KEY = 'stagepass_login_lockout_until';
const LAST_USERNAME_KEY = 'stagepass_last_username';

export async function loadStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearStoredToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  setAuthToken(null);
}

export async function hydrateAuth(
  token: string | null,
  setCredentials: (payload: { user: unknown; token: string }) => void
): Promise<void> {
  if (!token) return;
  setAuthToken(token);
  try {
    const { api } = await import('../services/api');
    const user = await api.auth.me();
    setCredentials({ user, token });
  } catch {
    setAuthToken(null);
    await clearStoredToken();
  }
}

/** Lockout after failed login attempts. Returns timestamp (ms) until which login is locked, or null. */
export async function getLoginLockoutUntil(): Promise<number | null> {
  try {
    const s = await SecureStore.getItemAsync(LOCKOUT_UNTIL_KEY);
    if (!s) return null;
    const t = parseInt(s, 10);
    return isNaN(t) ? null : t;
  } catch {
    return null;
  }
}

export async function setLoginLockoutUntil(ms: number): Promise<void> {
  await SecureStore.setItemAsync(LOCKOUT_UNTIL_KEY, String(ms));
}

export async function clearLoginLockout(): Promise<void> {
  await SecureStore.deleteItemAsync(LOCKOUT_UNTIL_KEY);
}

/** Last successful login username – pre-fill on return so user only enters PIN. */
export async function getLastUsername(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_USERNAME_KEY);
  } catch {
    return null;
  }
}

export async function setLastUsername(username: string): Promise<void> {
  const trimmed = username.trim();
  if (!trimmed) return;
  try {
    await AsyncStorage.setItem(LAST_USERNAME_KEY, trimmed);
  } catch {
    // ignore
  }
}
