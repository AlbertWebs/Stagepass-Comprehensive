/**
 * Theme preference (light / dark / system) persisted to AsyncStorage.
 * Theme changes use a short, button-origin reveal throughout the app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useColorScheme as useRNColorScheme, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const STORAGE_KEY = '@stagepass/theme-preference';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ThemeChangeOptions = {
  origin?: { x: number; y: number };
  color?: string;
  animate?: boolean;
};

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  setPreference: (p: ThemePreference, options?: ThemeChangeOptions) => void;
  isLoading: boolean;
};

type Transition = {
  preference: ThemePreference;
  origin: { x: number; y: number };
  color: string;
  diameter: number;
  id: number;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isLoading, setIsLoading] = useState(true);
  const [transition, setTransition] = useState<Transition | null>(null);
  const system = useRNColorScheme();
  const { width, height } = useWindowDimensions();
  const activeTransition = useRef(false);
  const transitionId = useRef(0);
  const revealScale = useSharedValue(0);
  const revealOpacity = useSharedValue(0);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const persistPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    void AsyncStorage.setItem(STORAGE_KEY, p);
  }, []);

  const clearTransition = useCallback((id: number) => {
    if (transitionId.current !== id) return;
    setTransition(null);
    activeTransition.current = false;
  }, []);

  const completeTransition = useCallback((p: ThemePreference, id: number) => {
    if (transitionId.current !== id) return;
    persistPreference(p);
    revealOpacity.value = withTiming(0, { duration: 130 }, (finished) => {
      if (!finished) return;
      revealScale.value = 0;
      runOnJS(clearTransition)(id);
    });
  }, [clearTransition, persistPreference, revealOpacity, revealScale]);

  const setPreference = useCallback((p: ThemePreference, options: ThemeChangeOptions = {}) => {
    if (activeTransition.current) return;

    const currentScheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
    const nextScheme = p === 'system' ? (system === 'dark' ? 'dark' : 'light') : p;
    if (currentScheme === nextScheme || options.animate === false) {
      persistPreference(p);
      return;
    }

    activeTransition.current = true;
    const id = ++transitionId.current;
    const diameter = Math.sqrt(width * width + height * height) * 2;
    setTransition({
      preference: p,
      origin: options.origin ?? { x: width / 2, y: height / 2 },
      color: options.color ?? (nextScheme === 'dark' ? '#0F0F0F' : '#FAFAFA'),
      diameter,
      id,
    });
  }, [height, persistPreference, preference, system, width]);

  useEffect(() => {
    if (!transition) return;
    revealScale.value = 0;
    revealOpacity.value = 0.94;
    revealScale.value = withTiming(
      1,
      { duration: 390, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(completeTransition)(transition.preference, transition.id);
      }
    );
  }, [completeTransition, revealOpacity, revealScale, transition]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: revealOpacity.value,
    transform: [{ scale: revealScale.value }],
  }));

  const value: ThemePreferenceContextValue = {
    preference,
    setPreference,
    isLoading,
  };

  return (
    <ThemePreferenceContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        {transition ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                zIndex: 9999,
                elevation: 9999,
                width: transition.diameter,
                height: transition.diameter,
                borderRadius: transition.diameter / 2,
                left: transition.origin.x - transition.diameter / 2,
                top: transition.origin.y - transition.diameter / 2,
                backgroundColor: transition.color,
              },
              revealStyle,
            ]}
          />
        ) : null}
      </View>
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  const ctx = useContext(ThemePreferenceContext);
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
