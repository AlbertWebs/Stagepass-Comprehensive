import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { StagePassColors, themeBlue } from '@/constants/theme';

type CheckInButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
};

export function CheckInButton({
  onPress,
  disabled = false,
  loading = false,
  label = 'CHECK IN',
}: CheckInButtonProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (disabled || loading) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [disabled, loading, pulse]);

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale: disabled || loading ? 1 : pulse }] }]}>
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: disabled ? '#94a3b8' : StagePassColors.primary, opacity: pressed || loading ? 0.85 : 1 },
        ]}
      >
        <Text style={styles.label}>{loading ? '…' : label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const SIZE = 160;
const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', marginVertical: 24 },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  label: { fontSize: 22, fontWeight: '800', color: themeBlue, letterSpacing: 1.2 },
});
