/**
 * Pressable for navigation links with shared animation (Projects/Crew style).
 * - Same pressed opacity and haptic as tab bar
 * - Prevents double-tap during lockout
 * Use for: tabs, header breadcrumb, more menu, Everything, quick actions, lists, etc.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, type PressableProps, type ViewStyle } from 'react-native';
import { useNavigationPress, NAV_PRESSED_OPACITY } from '@/src/utils/navigationPress';

export type NavPressableProps = Omit<PressableProps, 'onPress'> & {
  /** Route to push (e.g. '/(tabs)/events' or { pathname: '/events/[id]', params: { id: '1' } }) */
  href?: string | { pathname: string; params?: Record<string, string> };
  /** Called when pressed; use instead of href for custom nav (still gets haptic + lockout) */
  onPress?: () => void;
  /** Merge into the style when pressed (default: opacity NAV_PRESSED_OPACITY) */
  pressedStyle?: ViewStyle;
};

export function NavPressable({ href, onPress, style, pressedStyle, children, ...rest }: NavPressableProps) {
  const router = useRouter();
  const handleNav = useNavigationPress();

  const handlePress = () => {
    if (href !== undefined) {
      handleNav(() => {
        if (typeof href === 'string') {
          router.push(href as any);
        } else {
          router.push(href as any);
        }
      });
    } else if (onPress) {
      handleNav(onPress);
    }
  };

  return (
    <Pressable
      onPress={href !== undefined || onPress ? handlePress : undefined}
      style={({ pressed }) => [
        style as ViewStyle,
        pressed && (pressedStyle ?? styles.pressed),
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: NAV_PRESSED_OPACITY,
  },
});
