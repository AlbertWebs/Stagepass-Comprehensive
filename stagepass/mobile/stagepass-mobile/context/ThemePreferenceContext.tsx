/**
 * Theme preference (light / dark / system) persisted to AsyncStorage.
 * Theme changes use a short, button-origin reveal throughout the app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useColorScheme as useRNColorScheme, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Image as SvgImage, Mask, Rect } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

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
  snapshot: string;
  preference: ThemePreference;
  id: number;
};

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isLoading, setIsLoading] = useState(true);
  const [transition, setTransition] = useState<Transition | null>(null);
  const system = useRNColorScheme();
  const windowSize = useWindowDimensions();
  const [screenSize, setScreenSize] = useState({ width: windowSize.width, height: windowSize.height });
  const { width, height } = screenSize;
  const activeTransition = useRef(false);
  const transitionId = useRef(0);
  const screenRef = useRef<React.ElementRef<typeof View>>(null);
  const revealY = useSharedValue(0);
  const revealFromBottom = useSharedValue(0);

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
    if (p !== 'light' && p !== 'dark' && p !== 'system') return;
    setPreferenceState(p);
    void AsyncStorage.setItem(STORAGE_KEY, p);
  }, []);

  const clearTransition = useCallback((id: number) => {
    if (transitionId.current !== id) return;
    setTransition(null);
    activeTransition.current = false;
  }, []);

  const completeTransition = useCallback((id: number) => {
    if (transitionId.current !== id) return;
    clearTransition(id);
  }, [clearTransition]);

  const setPreference = useCallback((p: ThemePreference, options: ThemeChangeOptions = {}) => {
    if (p !== 'light' && p !== 'dark' && p !== 'system') return;
    if (activeTransition.current) return;

    const currentScheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
    const nextScheme = p === 'system' ? (system === 'dark' ? 'dark' : 'light') : p;
    if (currentScheme === nextScheme || options.animate === false) {
      persistPreference(p);
      return;
    }

    activeTransition.current = true;
    const id = ++transitionId.current;
    void (async () => {
      try {
        const snapshot = await captureRef(screenRef, { format: 'png', result: 'tmpfile' });
        if (transitionId.current !== id) return;
    revealY.value = 0;
        setTransition({ snapshot, preference: p, id });
      } catch {
        // Keep the theme switch reliable if native screen capture is unavailable.
        persistPreference(p);
        activeTransition.current = false;
      }
    })();
  }, [persistPreference, preference, revealY, system]);

  const startReveal = useCallback((id: number, nextPreference: ThemePreference) => {
    if (transitionId.current !== id) return;
    if (nextPreference !== 'light' && nextPreference !== 'dark' && nextPreference !== 'system') {
      clearTransition(id);
      return;
    }

    // Wait until the captured old screen is actually drawable before changing the live screen.
    persistPreference(nextPreference);
    revealFromBottom.value = nextPreference === 'light' ? 1 : 0;
    revealY.value = withTiming(
      height,
      { duration: 900, easing: Easing.inOut(Easing.quad) },
      (finished) => {
        if (finished) runOnJS(completeTransition)(id);
      }
    );
  }, [clearTransition, completeTransition, height, persistPreference, revealFromBottom, revealY]);

  const maskRectProps = useAnimatedProps(() => ({
    height: revealY.value,
    y: revealFromBottom.value ? height - revealY.value : 0,
  }));

  const value: ThemePreferenceContextValue = {
    preference,
    setPreference,
    isLoading,
  };

  return (
    <ThemePreferenceContext.Provider value={value}>
      <View
        ref={screenRef}
        collapsable={false}
        onLayout={({ nativeEvent }) => {
          const { width: measuredWidth, height: measuredHeight } = nativeEvent.layout;
          if (measuredWidth > 0 && measuredHeight > 0) {
            setScreenSize((current) =>
              current.width === measuredWidth && current.height === measuredHeight
                ? current
                : { width: measuredWidth, height: measuredHeight }
            );
          }
        }}
        style={{ flex: 1 }}
      >
        {children}
        {transition ? (
          <Svg pointerEvents="none" width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, zIndex: 9999, elevation: 9999 }}>
            <Defs>
              <Mask id="theme-reveal-mask" x="0" y="0" width={width} height={height}>
                <Rect width={width} height={height} fill="white" />
                <AnimatedRect x={0} y={0} width={width} fill="black" animatedProps={maskRectProps} />
              </Mask>
            </Defs>
            <SvgImage
              href={{ uri: transition.snapshot }}
              x={0}
              y={0}
              width={width}
              height={height}
              preserveAspectRatio="none"
              mask="url(#theme-reveal-mask)"
              onLoad={() => startReveal(transition.id, transition.preference)}
            />
          </Svg>
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
