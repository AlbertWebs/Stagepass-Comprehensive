# Stagepass Mobile – UI consistency guide

Use the **global UI tokens** in `constants/ui.ts` everywhere so typography, icon sizes, spacing, and components stay consistent across the app.

## Import

```ts
import { Typography, Icons, Buttons, Cards, Form, UI } from '@/constants/ui';
import { Spacing } from '@/constants/theme'; // when you need raw spacing
```

## Typography

| Use case | Token | ThemedText type |
|----------|--------|------------------|
| Page / screen title | `Typography.titleLarge` (20, bold) | `titleLarge` |
| Section title (e.g. "Quick actions") | `Typography.titleSection` (11, uppercase) | `titleSection` |
| Card / list title | `Typography.titleCard` (17, bold) | `titleCard` |
| Body text | `Typography.body` (16) | `body` |
| Secondary / small text | `Typography.bodySmall` (14) | `bodySmall` |
| Form / stat labels | `Typography.label` (12, bold) | `label` |
| Button text | `Typography.buttonText` (15, bold) | `buttonText` |
| Stat value (number) | `Typography.statValue` (19, bold) | `statValue` |
| Stat label | `Typography.statLabel` (10, bold) | `statLabel` |

Prefer `<ThemedText type="titleCard">` (and other types) so styles stay centralized.

## Icons

| Use case | Token |
|----------|--------|
| Nav / header / icon+label | `Icons.standard` (20) or `Icons.header` (20) |
| List row chevron | `Icons.medium` (16) |
| Inline with small text (chips, badges) | `Icons.small` (14) |
| Dense UI | `Icons.xs` (12) |
| Large CTA (e.g. check-in button) | `Icons.large` (32) |
| Hero / empty state | `Icons.xl` (24) |

Use everywhere: `<Ionicons name="calendar" size={Icons.standard} color={...} />`.

## Buttons

- Min height: `Buttons.minHeight` (48)
- Padding, radius, font: `Buttons.paddingVertical`, `Buttons.borderRadius`, `Buttons.fontSize`, `Buttons.fontWeight`
- Icon inside button: `Buttons.iconSize` (= `Icons.standard`)

## Cards

- Padding: `Cards.padding` (16)
- Radius: `Cards.borderRadius` (16), `Cards.borderRadiusSmall` (8)
- Margin between cards: `Cards.marginBottom`

## Form

- Input text size: `Form.inputText` (16)
- Input min height: `Form.inputMinHeight` (48)
- Input radius: `Form.inputBorderRadius`
- Label: use `Typography.label` / ThemedText `label`

## Spacing

Prefer semantic tokens where they fit:

- `UI.sectionGap` – between major sections
- `UI.rowGap` – between items in a row
- `Spacing.xs` … `Spacing.xxl`, `Spacing.section` – when you need a specific step

Avoid local constants like `const U = { ... }` or `CARD_RADIUS`; use `Spacing.*` and `Cards.borderRadius` instead.

## Checklist for new screens

1. Page title: `Typography.titleLarge` or ThemedText `titleLarge`.
2. Section titles: `Typography.titleSection` or `titleSection`.
3. All icons: `Icons.*` (no raw numbers).
4. Buttons: `Buttons.minHeight`, `Typography.buttonText` (or ThemedText `buttonText`).
5. Cards: `Cards.padding`, `Cards.borderRadius`.
6. No hardcoded `fontSize: 14` etc.; use `Typography.*` or ThemedText types.
