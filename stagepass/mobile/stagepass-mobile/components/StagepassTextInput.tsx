import { TextInput as NativeTextInput, StyleSheet, type TextInputProps, type TextStyle } from 'react-native';

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

export function StagepassTextInput({ style, ...props }: TextInputProps) {
  const resolvedStyle = StyleSheet.flatten(style);
  return <NativeTextInput {...props} style={[{ fontFamily: outfitFamily(resolvedStyle) }, style]} />;
}
