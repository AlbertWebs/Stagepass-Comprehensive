import { ActivityIndicator, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { ThemedText } from '@/components/themed-text';

type Variant = 'primary' | 'secondary' | 'outline' | 'destructive';

export type StagePassButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
};

const LIGHT_TEXT_VARIANTS: Variant[] = ['primary', 'secondary', 'destructive'];

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
    destructive: {
      backgroundColor: colors.error,
      borderWidth: 0,
    },
  };

  const textColor = LIGHT_TEXT_VARIANTS.includes(variant) ? '#FFFFFF' : colors.text;
  const loadingColor = LIGHT_TEXT_VARIANTS.includes(variant) ? '#FFFFFF' : colors.text;

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
        <ActivityIndicator color={loadingColor} />
      ) : (
        <ThemedText
          style={[
            styles.text,
            { color: textColor },
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
