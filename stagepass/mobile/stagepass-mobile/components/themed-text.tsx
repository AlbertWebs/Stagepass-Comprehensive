import { StyleSheet, Text, type TextProps } from 'react-native';

import { Typography } from '@/constants/ui';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  /** Use token-based types for UI consistency. Legacy types still supported. */
  type?:
    | 'default'
    | 'title'
    | 'defaultSemiBold'
    | 'defaultBold'
    | 'subtitle'
    | 'link'
    | 'titleLarge'
    | 'titleSection'
    | 'titleCard'
    | 'body'
    | 'bodySmall'
    | 'label'
    | 'labelSmall'
    | 'buttonText'
    | 'statValue'
    | 'statLabel';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'defaultBold' ? styles.defaultBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        type === 'titleLarge' ? styles.titleLarge : undefined,
        type === 'titleSection' ? styles.titleSection : undefined,
        type === 'titleCard' ? styles.titleCard : undefined,
        type === 'body' ? styles.body : undefined,
        type === 'bodySmall' ? styles.bodySmall : undefined,
        type === 'label' ? styles.label : undefined,
        type === 'labelSmall' ? styles.labelSmall : undefined,
        type === 'buttonText' ? styles.buttonText : undefined,
        type === 'statValue' ? styles.statValue : undefined,
        type === 'statLabel' ? styles.statLabel : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: Typography.body,
    lineHeight: Typography.bodyLineHeight,
    fontWeight: Typography.bodyWeight,
  },
  defaultSemiBold: {
    fontSize: Typography.bodySemiBold,
    lineHeight: Typography.bodyLineHeight,
    fontWeight: Typography.bodySemiBoldWeight,
  },
  defaultBold: {
    fontSize: Typography.bodyBold,
    lineHeight: Typography.bodyLineHeight,
    fontWeight: Typography.bodyBoldWeight,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  link: {
    fontSize: Typography.link,
    lineHeight: Typography.bodyLineHeight,
    fontWeight: Typography.linkWeight,
  },
  titleLarge: {
    fontSize: Typography.titleLarge,
    lineHeight: Typography.titleLargeLineHeight,
    fontWeight: Typography.titleLargeWeight,
  },
  titleSection: {
    fontSize: Typography.titleSection,
    lineHeight: Typography.titleSectionLineHeight,
    fontWeight: Typography.titleSectionWeight,
    letterSpacing: Typography.titleSectionLetterSpacing,
    textTransform: 'uppercase',
  },
  titleCard: {
    fontSize: Typography.titleCard,
    lineHeight: Typography.titleCardLineHeight,
    fontWeight: Typography.titleCardWeight,
  },
  body: {
    fontSize: Typography.body,
    lineHeight: Typography.bodyLineHeight,
    fontWeight: Typography.bodyWeight,
  },
  bodySmall: {
    fontSize: Typography.bodySmall,
    lineHeight: Typography.bodySmallLineHeight,
    fontWeight: Typography.bodySmallWeight,
  },
  label: {
    fontSize: Typography.label,
    lineHeight: Typography.labelLineHeight,
    fontWeight: Typography.labelWeight,
    letterSpacing: Typography.labelLetterSpacing,
  },
  labelSmall: {
    fontSize: Typography.labelSmall,
    fontWeight: Typography.labelSmallWeight,
    letterSpacing: Typography.labelSmallLetterSpacing,
  },
  buttonText: {
    fontSize: Typography.buttonText,
    fontWeight: Typography.buttonTextWeight,
  },
  statValue: {
    fontSize: Typography.statValue,
    fontWeight: Typography.statValueWeight,
  },
  statLabel: {
    fontSize: Typography.statLabel,
    fontWeight: Typography.statLabelWeight,
  },
});
