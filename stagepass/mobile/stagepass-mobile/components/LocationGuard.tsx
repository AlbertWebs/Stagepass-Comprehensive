/**
 * LocationGuard – shows message when user is outside event geofence.
 * Use to display "You must be at the event location to check in." when validation fails.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

type LocationGuardProps = {
  message: string;
  visible: boolean;
};

export function LocationGuard({ message, visible }: LocationGuardProps) {
  const { colors } = useStagePassTheme();
  if (!visible) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ThemedText style={[styles.text, { color: colors.textSecondary }]}>{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: {
    fontSize: 14,
    textAlign: 'center',
  },
});
