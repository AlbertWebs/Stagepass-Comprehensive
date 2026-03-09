import { useEffect, useState } from 'react';
import { useEffectiveColorScheme } from '@/context/ThemePreferenceContext';

/**
 * Web: use theme preference with hydration for static rendering.
 */
export function useColorScheme(): 'light' | 'dark' {
  const [hasHydrated, setHasHydrated] = useState(false);
  const effective = useEffectiveColorScheme();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (!hasHydrated) return 'light';
  return effective;
}
