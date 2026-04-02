import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

export type StagePassInputProps = TextInputProps & {
  error?: boolean;
  /** Slightly smaller padding/font for settings-style dense forms. */
  compact?: boolean;
};

export function StagePassInput({
  style,
  error,
  placeholderTextColor,
  compact,
  ...props
}: StagePassInputProps) {
  const { colors, radius, spacing } = useStagePassTheme();

  return (
    <TextInput
      style={[
        styles.base,
        {
          backgroundColor: colors.inputBackground,
          borderColor: error ? colors.error : colors.inputBorder,
          borderRadius: radius.md,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          paddingVertical: compact ? spacing.sm : spacing.md,
          color: colors.text,
          fontSize: compact ? 15 : 16,
        },
        style,
      ]}
      placeholderTextColor={placeholderTextColor ?? colors.placeholder}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});
