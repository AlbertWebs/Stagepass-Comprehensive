import { Text as NativeText, StyleSheet, type TextProps, type TextStyle } from 'react-native';

function outfitFamily(style: TextStyle | null | undefined): string {
  if (style?.fontFamily) return style.fontFamily;
  const weight = style?.fontWeight;
  const numericWeight = typeof weight === 'number' ? weight : Number(weight);
  if (weight === 'bold' || numericWeight >= 800) return 'Outfit_800ExtraBold';
  if (numericWeight >= 700) return 'Outfit_700Bold';
  if (numericWeight >= 600) return 'Outfit_600SemiBold';
  if (numericWeight >= 500) return 'Outfit_500Medium';
  return 'Outfit_400Regular';
}

export function StagepassText({ style, ...props }: TextProps) {
  const resolvedStyle = StyleSheet.flatten(style);
  return <NativeText {...props} style={[{ fontFamily: outfitFamily(resolvedStyle) }, style]} />;
}
