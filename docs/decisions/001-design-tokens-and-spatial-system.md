# ADR-001: Design Tokens and Spatial System

- **Status**: Accepted
- **Date**: 2026-04-05
- **Authors**: Daniel

## Context

The Glass UI has grown organically. An audit of `apps/web/src` reveals:

- **114 arbitrary font-size declarations** across four pixel values (`text-[10px]` 23x, `text-[11px]` 29x, `text-[12px]` 39x, `text-[13px]` 23x) plus Tailwind defaults (`text-xs` 20x, `text-sm` 36x).
- **No spacing scale**. Gaps use 7 different values (`gap-0.5` through `gap-6`). Padding uses 20+ distinct values.
- **10+ radius values** from `rounded-sm` (4px) to `rounded-[20px]`, with no semantic mapping between component type and radius.
- **No `<Text>` component**. All text styling is inline, making it impossible to enforce consistency or respond to user preference changes.
- **Badge/pill patterns repeated 12+ times** with slight variations in spacing, radius, and font size.
- **Segmented controls hand-rolled** in at least 3 locations with different internal spacing.

The app's Appearance settings let users set `--glass-ui-font-size-user` between 11px and 16px. The 114 hardcoded pixel font sizes **ignore this preference entirely** -- when a user sets 16px, half the UI stays at 10-13px.

### Reference

The design direction draws from Cron's spatial system (Raphael Schaad, design lead):

- Every element aligns to a visible spatial grid
- Consistent corner radius (6px on interactive controls)
- Named text styles (`Body-sm-13px/Medium`)
- Relationships between elements are defined by the grid, not ad-hoc values

## Decision

### Spatial Grid: 4px Fixed

All spacing (gap, padding, margin) snaps to a **4px grid**: 4, 8, 12, 16, 20, 24, 32, 40, 48.

- **2px** is allowed only inside micro interactive elements (pill toggle internal padding, icon-button insets).
- **6px** is allowed only for border-radius (not spacing).
- Spacing does **not** scale with the user's font size preference. The grid is an absolute constant -- the visual rhythm anchors to pixels. Text flows within grid cells; cells don't stretch with text.

**Why fixed?** A proportional grid (spacing tied to font size) creates a "native app" feel but loses the designed, tool-like precision of a Cron-style layout. At the 11-16px range, fixed 4px spacing keeps the UI dense and intentional.

### Type Scale: 5 Steps, Relative to User Preference

| Token     | Offset from base | At 13px default | Use                             |
| --------- | ---------------- | --------------- | ------------------------------- |
| `caption` | base - 3px       | 10px            | Badges, counts, tertiary labels |
| `detail`  | base - 2px       | 11px            | Timestamps, metadata, secondary |
| `body`    | 1em (base)       | 13px            | Primary text, inputs, buttons   |
| `title`   | base + 2px       | 15px            | Section headers                 |
| `heading` | base + 5px       | 18px            | Page titles                     |

- **12px and 14px are eliminated.** The current codebase uses 12px and 13px almost interchangeably (62 combined uses). One must win for body -- 13px wins because it matches the default `--glass-ui-font-size-user` and the reference (`Body-sm-13px/Medium`). 12px falls into neither `detail` (11px) nor `body` (13px) and must be migrated to one or the other per context.
- All sizes are **relative to the user's base font size** using CSS `calc()` from `--glass-ui-font-size-user`. When a user sets 15px, caption becomes 12px, detail becomes 13px, body becomes 15px, etc.

**Why relative?** The font size preference exists for accessibility. If someone needs 16px body text, they need proportionally sized detail and caption text, not frozen 11px text next to 16px text.

**Why not `em`?** Nested `em` compounds. CSS variables with `calc()` give absolute control while still tracking the user's preference.

### Radius Scale: 3 Semantic Tiers

| Token     | Value | Use                                  |
| --------- | ----- | ------------------------------------ |
| `control` | 6px   | Buttons, inputs, toggles, menu items |
| `card`    | 10px  | Panels, cards, popovers, dialogs     |
| `pill`    | 20px  | Chips, pills, full-round badges      |

- 6px on controls matches the reference (Corner radius 6px) and creates a crisper, tool-like feel vs. the current 8px.
- 10px on cards replaces the current 12px (`--glass-radius-card`), tightening the overall feel.
- 20px on pills preserves the current `--glass-radius-chip`.

### Token Delivery

Raw CSS custom properties in `glass.css` (the source of truth). Tailwind bridge in `index.css` via `@theme inline` (for utility class access). This follows the existing pattern where `glass.css` owns the raw variables and `index.css` bridges them.

### Components

Five new primitives in `apps/web/src/components/ui/`:

1. **`<Text>`** -- Semantic `size` prop (`caption | detail | body | title | heading`), optional `weight`, `color`, `as` (element tag). Enforces the type scale. Replaces all inline `text-[Npx]`.
2. **`<Badge>`** -- Status and label badges. Variants for color (neutral, addition, deletion, warning, info). Fixed `caption` size. Replaces 12+ inline badge patterns.
3. **`<SegmentedControl>`** -- Tab-style toggle group. Replaces the hand-rolled Unified/Split pattern. Controlled via `value`/`onChange`.
4. **`<Label>`** -- Form and section labels. Wraps the `data-glass-settings-label` pattern with semantic sizing.
5. **`<Kbd>`** -- Keyboard shortcut display. Replaces inline `data-[slot=kbd]` styling.

### Migration

Full sweep of all 30+ component files:

- Replace all `text-[10px]` with `text-caption` (or `<Text size="caption">`)
- Replace all `text-[11px]` with `text-detail`
- Replace all `text-[12px]` with `text-detail` or `text-body` per context
- Replace all `text-[13px]` with `text-body`
- Align all border-radius to the 3-tier scale
- Align all spacing to 4px grid increments

## Consequences

### Positive

- User font preference actually works across the entire UI.
- New UI automatically looks consistent -- developers pick from 5 font sizes, 3 radii, and a fixed spacing grid instead of guessing pixel values.
- Badges, segmented controls, and labels are no longer copy-pasted inline.
- The design doc serves as a living reference for contributors.

### Negative

- **Large migration surface.** 114+ font-size instances, 12+ badge patterns, 10+ radius values across 30+ files. Risk of visual regressions.
- **Reduced flexibility.** Developers can no longer pick arbitrary pixel sizes without violating the system. This is intentional but may create friction for edge cases.
- **Relative type scale adds complexity.** `calc(var(--glass-ui-font-size-user) - 3px)` is less obvious than `10px`. The `<Text>` component and Tailwind utilities (`text-caption`) abstract this, but raw CSS usage requires understanding the variable.

### Risks

- The 12px elimination requires auditing each of the 39 instances to determine whether it should become `detail` (11px) or `body` (13px). Some may feel wrong at either value and need layout adjustments.
- Changing the control radius from 8px to 6px affects `<Button>` and `<Input>`, which are used everywhere. Visual diff review is critical.
- Fixed spacing + relative type means at 16px base font, text may feel tight in 4px-gap layouts. Monitor this at the extremes of the preference range.
