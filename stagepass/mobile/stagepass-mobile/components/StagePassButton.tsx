import { ActivityIndicator, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { ThemedText } from '@/components/themed-text';

type Variant = 'primary' | 'secondary' | 'outline';

export type StagePassButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
};

export function StagePassButton({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
}: StagePassButtonProps) {
  const { colors, radius, spacing } = useStagePassTheme();

  const variantStyles: Record<Variant, ViewStyle> = {
    primary: {
      backgroundColor: colors.tint,
    },
    secondary: {
      backgroundColor: colors.success,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          opacity: disabled ? 0.6 : 1,
        },
        variantStyles[variant],
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.text : '#FFFFFF'} />
      ) : (
        <ThemedText
          style={[
            styles.text,
            { color: variant === 'outline' ? colors.text : '#FFFFFF' },
          ]}
        >
          {title}
        </ThemedText>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
