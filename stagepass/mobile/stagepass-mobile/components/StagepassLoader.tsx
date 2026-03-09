/**
 * StagepassLoader – the mobile app’s only preloader.
 * Used on app launch, API loading, login, check-in, and event loading.
 * Theme colors (blue + yellow), Stagepass AV branding, smooth animation.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { themeBlue, themeYellow } from '@/constants/theme';

type StagepassLoaderProps = {
  message?: string;
  fullScreen?: boolean;
};

export function StagepassLoader({ message = 'Loading…', fullScreen = true }: StagepassLoaderProps) {
  const spinValue = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.6)).current;
  const dot2 = useRef(new Animated.Value(0.6)).current;
  const dot3 = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, [spinValue]);

  useEffect(() => {
    const bounce = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 240,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0.6,
            duration: 240,
            useNativeDriver: true,
          }),
        ])
      );
    const a1 = bounce(dot1, 0);
    const a2 = bounce(dot2, 200);
    const a3 = bounce(dot3, 400);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const scaleDot1 = dot1.interpolate({ inputRange: [0.6, 1], outputRange: [0.6, 1] });
  const opacityDot1 = dot1.interpolate({ inputRange: [0.6, 1], outputRange: [0.5, 1] });
  const scaleDot2 = dot2.interpolate({ inputRange: [0.6, 1], outputRange: [0.6, 1] });
  const opacityDot2 = dot2.interpolate({ inputRange: [0.6, 1], outputRange: [0.5, 1] });
  const scaleDot3 = dot3.interpolate({ inputRange: [0.6, 1], outputRange: [0.6, 1] });
  const opacityDot3 = dot3.interpolate({ inputRange: [0.6, 1], outputRange: [0.5, 1] });

  const content = (
    <View style={[styles.wrapper, fullScreen && styles.fullScreen]}>
      <View style={styles.logoRow}>
        <Animated.View style={[styles.ring, { transform: [{ rotate: spin }] }]} />
        <View style={styles.innerLogo}>
          <Text style={styles.sLetter}>S</Text>
        </View>
      </View>
      <View style={styles.textRow}>
        <Text style={styles.title}>Stagepass AV</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      <View style={styles.dots} pointerEvents="none">
        <Animated.View style={[styles.dot, { transform: [{ scale: scaleDot1 }], opacity: opacityDot1 }]} />
        <Animated.View style={[styles.dot, { transform: [{ scale: scaleDot2 }], opacity: opacityDot2 }]} />
        <Animated.View style={[styles.dot, { transform: [{ scale: scaleDot3 }], opacity: opacityDot3 }]} />
      </View>
    </View>
  );

  if (fullScreen) {
    return (
      <View style={styles.overlay} accessibilityRole="progressbar" accessibilityLiveRegion="polite">
        {content}
      </View>
    );
  }

  return content;
}

const SIZE = 44;
const INNER = 32;
const DOT = 6;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: 'rgba(248, 250, 252, 0.98)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fullScreen: {
    flex: 1,
    minHeight: '100%',
    width: '100%',
  },
  logoRow: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: 12,
    borderWidth: 2,
    borderTopColor: themeYellow,
    borderRightColor: themeBlue,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  innerLogo: {
    width: INNER,
    height: INNER,
    borderRadius: 8,
    backgroundColor: themeYellow,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: themeYellow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  sLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  textRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: themeBlue,
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 12,
    color: themeYellow,
    marginTop: 4,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: themeYellow,
    marginHorizontal: 4,
  },
});
