/**
 * Theme preference (light / dark / system) persisted to AsyncStorage.
 * Use useThemePreference() to get/set, useEffectiveColorScheme() for the resolved scheme.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const STORAGE_KEY = '@stagepass/theme-preference';

export type ThemePreference = 'light' | 'dark' | 'system';

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  isLoading: boolean;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p);
  }, []);

  const value: ThemePreferenceContextValue = {
    preference,
    setPreference,
    isLoading,
  };

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  const ctx = useContext(ThemePreferenceContext);
  const system = useRNColorScheme();
  const fallback: ThemePreferenceContextValue = {
    preference: 'system',
    setPreference: () => {},
    isLoading: false,
  };
  if (!ctx) return fallback;
  return ctx;
}

/** Resolved color scheme: 'light' or 'dark' for the app to use. */
export function useEffectiveColorScheme(): 'light' | 'dark' {
  const ctx = useContext(ThemePreferenceContext);
  const system = useRNColorScheme();

  if (!ctx) {
    return (system === 'dark' ? 'dark' : 'light') as 'light' | 'dark';
  }
  if (ctx.preference === 'system') {
    return (system === 'dark' ? 'dark' : 'light') as 'light' | 'dark';
  }
  return ctx.preference;
}
