import { useEffectiveColorScheme } from '@/context/ThemePreferenceContext';

/** Returns the effective color scheme (user preference or system). */
export function useColorScheme(): 'light' | 'dark' {
  return useEffectiveColorScheme();
}
