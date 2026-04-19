import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: disabled ? '#94a3b8' : StagePassColors.primary,
          opacity: pressed || loading ? 0.85 : 1,
        },
      ]}
    >
      <Text style={styles.label}>{loading ? '…' : label}</Text>
    </Pressable>
  );
}

const SIZE = 160;
const styles = StyleSheet.create({
  button: {
    alignSelf: 'center',
    marginVertical: 24,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { fontSize: 22, fontWeight: '800', color: themeBlue, letterSpacing: 1.2 },
});
