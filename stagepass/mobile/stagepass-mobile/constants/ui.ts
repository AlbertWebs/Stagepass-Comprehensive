/**
 * Global UI consistency tokens for the Stagepass mobile app.
 * Use these everywhere instead of hardcoded font sizes, icon sizes, or spacing
 * so all screens feel unified and professionally designed.
 *
 * Usage:
 *   import { Typography, Icons, Buttons, Cards } from '@/constants/ui';
 *   style={{ fontSize: Typography.body, ... }}
 *   <Ionicons name="calendar" size={Icons.standard} />
 */

import { BorderRadius, Spacing } from './theme';

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const Typography = {
  /**
   * App header bar title — same size as Home tab “Home” (HomeHeader / AppHeader).
   * Use `ThemedText type="titleLarge"` for any top bar title; do not use other sizes for headers.
   */
  titleLarge: 22,
  titleLargeLineHeight: 28,
  titleLargeWeight: '700' as const,
  /** Matches header title tracking (HomeHeader) */
  titleLargeLetterSpacing: 0.2,

  /** Hero / welcome title (e.g. login "Welcome Back", logo wordmark) */
  titleHero: 22,
  titleWelcome: 24,
  titleWelcomeWeight: '700' as const,

  /** Section title (e.g. "Quick actions", "Daily allowance") – slightly smaller than page title */
  titleSection: 11,
  titleSectionLineHeight: 14,
  titleSectionWeight: '800' as const,
  titleSectionLetterSpacing: 0.6,

  /** Card title / list item primary text */
  titleCard: 17,
  titleCardLineHeight: 22,
  titleCardWeight: '800' as const,

  /** Body text – default readable size across pages */
  body: 16,
  bodyLineHeight: 24,
  bodyWeight: '400' as const,

  /** Body emphasis (semi-bold) */
  bodySemiBold: 16,
  bodySemiBoldWeight: '600' as const,

  /** Body bold */
  bodyBold: 16,
  bodyBoldWeight: '700' as const,

  /** Secondary / description text, meta info */
  bodySmall: 14,
  bodySmallLineHeight: 20,
  bodySmallWeight: '400' as const,

  /** Labels (form labels, stat labels, chip labels) */
  label: 12,
  labelLineHeight: 16,
  labelWeight: '700' as const,
  labelLetterSpacing: 0.5,

  /** Small labels (badges, overlines) */
  labelSmall: 10,
  labelSmallWeight: '700' as const,
  labelSmallLetterSpacing: 0.5,

  /** Button text – consistent across all buttons */
  buttonText: 15,
  buttonTextWeight: '700' as const,

  /** Link text */
  link: 14,
  linkWeight: '700' as const,

  /** Stat / value numbers (e.g. dashboard stats) */
  statValue: 19,
  statValueWeight: '800' as const,
  statLabel: 10,
  statLabelWeight: '700' as const,
} as const;

// =============================================================================
// ICON SIZES
// =============================================================================

export const Icons = {
  /** Standard icon next to label (nav, list rows, card headers) – use everywhere for icon+label */
  standard: 20,
  /** Slightly smaller for inline with small text (chips, badges) */
  small: 14,
  /** Extra small (section accents, dense UI) */
  xs: 12,
  /** Header / navigation icons (back, menu, actions) */
  header: 20,
  /** Medium (e.g. list row chevrons) */
  medium: 16,
  /** Large CTA icons (e.g. check-in button) */
  large: 32,
  /** Extra large hero icons */
  xl: 24,
} as const;

// =============================================================================
// BUTTONS
// =============================================================================

export const Buttons = {
  /** Minimum touchable height for primary/secondary buttons */
  minHeight: 48,
  /** Vertical padding for button content */
  paddingVertical: Spacing.lg,
  /** Horizontal padding for button content */
  paddingHorizontal: Spacing.xl,
  /** Border radius for buttons */
  borderRadius: BorderRadius.lg,
  /** Icon size inside buttons */
  iconSize: Icons.standard,
  /** Font size for button label */
  fontSize: Typography.buttonText,
  fontWeight: Typography.buttonTextWeight,
} as const;

// =============================================================================
// CARDS
// =============================================================================

export const Cards = {
  /** Horizontal and vertical padding inside cards */
  padding: Spacing.lg,
  /** Padding for compact cards */
  paddingCompact: Spacing.md,
  /** Border radius for cards */
  borderRadius: 16,
  borderRadiusSmall: 8,
  /** Gap between elements inside a card */
  gap: Spacing.sm,
  /** Margin between cards or sections */
  marginBottom: Spacing.lg,
  /** Border width */
  borderWidth: 1,
} as const;

// =============================================================================
// FORM ELEMENTS
// =============================================================================

export const Form = {
  /** Input text size */
  inputText: 16,
  /** Label text size (same as Typography.label) */
  labelSize: Typography.label,
  /** Input height for single-line fields */
  inputMinHeight: 48,
  /** Input border radius */
  inputBorderRadius: BorderRadius.md,
} as const;

// =============================================================================
// SPACING (re-export + semantic aliases)
// =============================================================================

export const UI = {
  /** Section spacing (between major blocks) */
  sectionGap: Spacing.section,
  /** Row gap (between items in a row) */
  rowGap: Spacing.sm,
  /** Vertical rhythm between text/items */
  stackGap: Spacing.md,
} as const;
