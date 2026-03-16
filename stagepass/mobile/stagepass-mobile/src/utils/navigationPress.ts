/**
 * Shared navigation press behavior: same as Projects/Crew tab bar.
 * Use for all nav links so tap animation and haptic are consistent app-wide.
 */
import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Pressed opacity used on Projects/Crew tabs – reuse everywhere for nav links */
export const NAV_PRESSED_OPACITY = 0.75;

/** Short delay (ms) before running navigation so press feedback is visible */
export const NAV_PRESS_DELAY_MS = 80;

/** Time (ms) to ignore further taps after a nav press (prevents double-tap) */
export const NAV_LOCKOUT_MS = 380;

function triggerHaptic() {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

/**
 * Returns a stable handler that runs the given navigation callback with:
 * - Haptic feedback (iOS)
 * - Optional short delay so press animation is visible
 * - Lockout to prevent double-taps
 * Use for any navigation link (tabs, header, menus, lists).
 */
export function useNavigationPress() {
  const lockUntilRef = useRef(0);

  return useCallback((navigate: () => void) => {
    const now = Date.now();
    if (now < lockUntilRef.current) return;
    lockUntilRef.current = now + NAV_LOCKOUT_MS;
    triggerHaptic();
    if (NAV_PRESS_DELAY_MS > 0) {
      setTimeout(() => navigate(), NAV_PRESS_DELAY_MS);
    } else {
      navigate();
    }
  }, []);
}
