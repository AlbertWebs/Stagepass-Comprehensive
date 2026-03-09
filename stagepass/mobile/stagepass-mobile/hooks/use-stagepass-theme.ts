import { useMemo } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BorderRadius, Spacing, StagePassColors } from '@/constants/theme';

export function useStagePassTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return useMemo(() => {
    const colors = isDark ? StagePassColors.dark : StagePassColors.light;
    return {
      colors,
      isDark,
      primary: StagePassColors.primary,
      primaryDark: StagePassColors.primaryDark,
      spacing: Spacing,
      radius: BorderRadius,
    };
  }, [isDark]);
}
