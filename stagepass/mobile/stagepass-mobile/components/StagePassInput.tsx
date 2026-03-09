import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { useStagePassTheme } from '@/hooks/use-stagepass-theme';

export type StagePassInputProps = TextInputProps & {
  error?: boolean;
};

export function StagePassInput({ style, error, placeholderTextColor, ...props }: StagePassInputProps) {
  const { colors, radius, spacing } = useStagePassTheme();

  return (
    <TextInput
      style={[
        styles.base,
        {
          backgroundColor: colors.inputBackground,
          borderColor: error ? colors.error : colors.inputBorder,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          color: colors.text,
          fontSize: 16,
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
