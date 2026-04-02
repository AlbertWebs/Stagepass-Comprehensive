import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { api } from '../services/api';

const FLAG_KEY = 'stagepass_biometric_login_enabled';
const TOKEN_KEY = 'stagepass_biometric_token';

export async function isBiometricHardwareAvailable(): Promise<boolean> {
  try {
    const has = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return has && enrolled;
  } catch {
    return false;
  }
}

export async function getBiometricLoginEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(FLAG_KEY)) === '1';
  } catch {
    return false;
  }
}

/** Whether a token is stored for biometric unlock (may be stale until next PIN sign-in). */
export async function hasBiometricStoredToken(): Promise<boolean> {
  try {
    const t = await SecureStore.getItemAsync(TOKEN_KEY);
    return !!t?.trim();
  } catch {
    return false;
  }
}

/**
 * Read-only: server policy for biometric (admin System Settings). Does not clear local data —
 * clearing here on login mount was wiping tokens and breaking Face ID / fingerprint.
 */
export async function fetchServerAllowsBiometricLogin(): Promise<boolean> {
  try {
    const data = await api.settings.getPublicAppConfig();
    return data.allow_biometric_mobile_login !== false;
  } catch {
    return true;
  }
}

/** Call from Profile (signed-in) when you need to enforce policy and clear local biometric if disabled. */
export async function enforceServerBiometricPolicyAsync(): Promise<boolean> {
  const allowed = await fetchServerAllowsBiometricLogin();
  if (!allowed) {
    await clearBiometricLogin();
  }
  return allowed;
}

/** User-facing label for the primary biometric method on this device. */
export async function getBiometricLabel(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Fingerprint';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Face unlock';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris';
    }
  } catch {
    // ignore
  }
  return 'Biometric';
}

/** Ionicons name matching the device biometric type (avoid fingerprint icon + "Face unlock" mismatch on Android). */
export async function getBiometricIconName(): Promise<
  'scan-outline' | 'finger-print-outline' | 'eye-outline'
> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'finger-print-outline';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'scan-outline';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'eye-outline';
    }
  } catch {
    // ignore
  }
  return 'finger-print-outline';
}

/**
 * Store API token for biometric sign-in. Prompts the user to authenticate before saving.
 */
export async function saveBiometricCredential(token: string): Promise<void> {
  const ok = await isBiometricHardwareAvailable();
  if (!ok) {
    throw new Error('Biometric authentication is not available or not enrolled on this device.');
  }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirm to enable biometric login for StagePass',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  if (!result.success) {
    throw new Error('Cancelled');
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token.trim());
  await AsyncStorage.setItem(FLAG_KEY, '1');
}

export type BiometricUnlockResult = {
  token: string | null;
  /** User dismissed the system biometric prompt */
  userCancelled: boolean;
};

/**
 * Prompt for biometric, then return stored API token (login screen).
 */
export async function unlockWithBiometric(): Promise<BiometricUnlockResult> {
  const fail = (userCancelled: boolean): BiometricUnlockResult => ({ token: null, userCancelled });

  if (!(await getBiometricLoginEnabled())) return fail(false);
  if (!(await isBiometricHardwareAvailable())) return fail(false);

  try {
    const existing = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!existing?.trim()) return fail(false);
  } catch {
    return fail(false);
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Sign in to StagePass',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  if (!result.success) {
    const err = String((result as { error?: string }).error ?? '').trim();
    const userCancelled =
      (Platform.OS === 'android' && err.length === 0) ||
      /cancel|dismiss|negative|abort/i.test(err) ||
      err === 'user_cancel' ||
      err === 'app_cancel' ||
      err === 'system_cancel' ||
      err === 'UserCancel' ||
      err === 'SystemCancel';
    return fail(userCancelled);
  }

  let trimmed = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const t = await SecureStore.getItemAsync(TOKEN_KEY);
      trimmed = t?.trim() ?? '';
      if (trimmed) break;
    } catch {
      // retry
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 60));
    }
  }
  if (!trimmed) return fail(false);
  return { token: trimmed, userCancelled: false };
}

/** After a normal PIN login, keep biometric token in sync if the user opted in. */
export async function refreshBiometricCredentialIfEnabled(token: string): Promise<void> {
  const enabled = await getBiometricLoginEnabled();
  if (!enabled) return;
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token.trim());
  } catch {
    // ignore
  }
}

/** Remove stored API token only (e.g. after logout or 401); keeps opt-in so user need not re-enable in Profile. */
export async function invalidateBiometricSessionToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export async function clearBiometricLogin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // ignore
  }
  try {
    await AsyncStorage.removeItem(FLAG_KEY);
  } catch {
    // ignore
  }
}
