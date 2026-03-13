/**
 * StagePass theme – yellow #eab308 and blue #0f1838 for brand/accent.
 * "Creative Solutions | Technical Excellence"
 */

import { Platform } from 'react-native';

// Brand colors – use only these in the mobile app
export const themeYellow = '#eab308';
export const themeBlue = '#0f1838';
export const themeBlueLight = '#e6e8f0';

const primary = themeYellow;
const primaryDark = '#b89107';
const primaryLight = '#fde047';

export const StagePassColors = {
  primary,
  primaryDark,
  primaryLight,
  themeBlue,
  themeYellow,
  // Dark mode – blue icons/text become yellow on dark backgrounds
  dark: {
    background: '#0F0F0F',
    surface: '#1A1A1A',
    surfaceElevated: '#242424',
    text: '#FAFAFA',
    textSecondary: '#A1A1AA',
    border: '#2D2D2D',
    borderFocus: themeYellow,
    inputBackground: '#1A1A1A',
    inputBorder: '#2D2D2D',
    placeholder: '#71717A',
    success: '#22C55E',
    error: '#EF4444',
    tint: themeYellow,
    tabIconDefault: '#71717A',
    tabIconSelected: themeYellow,
    brandIcon: themeYellow,
    brandText: themeYellow,
  },
  // Light mode
  light: {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    text: '#0F0F0F',
    textSecondary: '#52525B',
    border: '#E4E4E7',
    borderFocus: themeBlue,
    inputBackground: '#FFFFFF',
    inputBorder: '#E4E4E7',
    placeholder: '#71717A',
    success: '#16A34A',
    error: '#DC2626',
    tint: themeYellow,
    tabIconDefault: '#71717A',
    tabIconSelected: themeYellow,
    brandIcon: themeBlue,
    brandText: themeBlue,
  },
} as const;

const tintColorLight = StagePassColors.primaryDark;
const tintColorDark = StagePassColors.primary;

export const Colors = {
  light: {
    text: StagePassColors.light.text,
    background: StagePassColors.light.background,
    tint: tintColorLight,
    icon: StagePassColors.light.textSecondary,
    tabIconDefault: StagePassColors.light.tabIconDefault,
    tabIconSelected: StagePassColors.light.tabIconSelected,
  },
  dark: {
    text: StagePassColors.dark.text,
    background: StagePassColors.dark.background,
    tint: tintColorDark,
    icon: StagePassColors.dark.textSecondary,
    tabIconDefault: StagePassColors.dark.tabIconDefault,
    tabIconSelected: StagePassColors.dark.tabIconSelected,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
} as const;

/** Status colors per UX spec: Green = Checked In, Orange = Pending, Red = Missing/Critical */
export const StatusColors = {
  checkedIn: '#16A34A',
  pending: '#EA580C',
  missing: '#DC2626',
} as const;

/** Vibrant accent colors for cards, icons, and sections (standard palette for more visual variety). */
export const VibrantColors = {
  emerald: '#10b981',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  sky: '#0ea5e9',
  rose: '#f43f5e',
  indigo: '#6366f1',
  teal: '#14b8a6',
  orange: '#f97316',
} as const;

/** Ordered list for cycling (e.g. quick action cards, section accents). */
export const VibrantColorsList = [
  VibrantColors.sky,
  VibrantColors.violet,
  VibrantColors.emerald,
  VibrantColors.amber,
  VibrantColors.indigo,
  VibrantColors.teal,
  VibrantColors.rose,
  VibrantColors.orange,
] as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
