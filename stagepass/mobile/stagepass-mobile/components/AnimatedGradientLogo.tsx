/**
 * Animated favicon with blue–yellow gradient ring. Used on login and splash.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { themeBlue, themeYellow } from '@/constants/theme';

const SIZE = 88;
const INNER = 72;
const LOGO = 44;

type Props = {
  innerBackgroundColor?: string;
};

export function AnimatedGradientLogo({ innerBackgroundColor = '#1A1A1A' }: Props) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );
  }, [rotation]);

  const animatedRing = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.ringOuter}>
        <Animated.View style={[styles.gradientWrap, animatedRing]}>
          <LinearGradient
            colors={[themeBlue, themeYellow, themeBlue]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <View style={[styles.inner, { backgroundColor: innerBackgroundColor }]}>
        <Image
          source={require('../assets/images/fav.png')}
          style={styles.logo}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
  },
  gradientWrap: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
  },
  inner: {
    position: 'absolute',
    left: (SIZE - INNER) / 2,
    top: (SIZE - INNER) / 2,
    width: INNER,
    height: INNER,
    borderRadius: INNER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: LOGO,
    height: LOGO,
  },
});
