# Mobile app theme (StagePass)

The mobile app theme is aligned with [StagePass Audio Visual](http://stagepass.co.ke/) branding.

## Brand

- **Tagline**: Creative Solutions · Technical Excellence  
- **Positioning**: Africa’s events technology experts; professional AV and event production.

## Design choices

- **Dark-first feel**: Event/AV context; dark backgrounds (`#0F0F0F`, `#1A1A1A`) with clear hierarchy.
- **Accent**: Amber/gold (`#D4A012`) for primary actions and highlights – “creative” and premium.
- **Light mode**: Same accent (darker `#B8860B` for contrast) on light backgrounds for accessibility.

## Tokens (see `constants/theme.ts`)

- **StagePassColors**: `primary`, `primaryDark`, and `dark` / `light` objects (background, surface, text, textSecondary, border, input, placeholder, success, error, tint, tab icons).
- **Spacing**: `xs`–`section` (4–32).
- **BorderRadius**: `sm`–`full`.

## Usage

- Use `useStagePassTheme()` for `colors`, `spacing`, `radius`, `isDark`.
- Use `StagePassInput` and `StagePassButton` for forms and CTAs so they stay on-brand and theme-aware.
