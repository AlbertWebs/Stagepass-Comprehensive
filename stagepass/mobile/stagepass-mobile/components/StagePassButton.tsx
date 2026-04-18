import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';
import { ThemedText } from '@/components/themed-text';
import {
  BEVEL_DESTRUCTIVE,
  BEVEL_PRIMARY,
  BEVEL_SECONDARY,
  BUTTON_3D_PRESSED,
  BUTTON_3D_SHADOW,
  BUTTON_3D_SHADOW_SOFT,
  bevelOutlineDark,
  bevelOutlineLight,
} from '@/constants/button3d';

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
  const { colors, radius, spacing, isDark } = useStagePassTheme();

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

  const bevelForVariant = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return BEVEL_PRIMARY;
      case 'secondary':
        return BEVEL_SECONDARY;
      case 'destructive':
        return BEVEL_DESTRUCTIVE;
      case 'outline':
        return isDark ? bevelOutlineDark() : bevelOutlineLight();
      default:
        return {};
    }
  };

  const shadowForVariant = (): ViewStyle => {
    if (variant === 'outline') return BUTTON_3D_SHADOW_SOFT;
    return BUTTON_3D_SHADOW;
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        shadowForVariant(),
        {
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          opacity: disabled ? 0.6 : 1,
        },
        variantStyles[variant],
        bevelForVariant(),
        pressed && !disabled && !loading && [BUTTON_3D_PRESSED, styles.pressedScale],
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  pressedScale: {
    transform: [{ scale: 0.985 }],
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
