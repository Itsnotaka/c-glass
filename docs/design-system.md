# Glass Design System

> Living reference for spacing, typography, radius, and component primitives.
> For the rationale behind these decisions, see [ADR-001](decisions/001-design-tokens-and-spatial-system.md).

## Spatial Grid

Glass uses a **4px fixed grid**. All spacing values (gap, padding, margin) must be multiples of 4.

```
4   8   12   16   20   24   32   40   48
```

### Exceptions

- **2px** is allowed only for micro insets inside interactive elements (pill toggle internal padding, compact icon-button inset). Never for layout spacing.
- **6px** is allowed only as a border-radius value, not a spacing value.

### Tailwind Mapping

| Grid step | Tailwind class  | Pixels |
| --------- | --------------- | ------ |
| 1         | `gap-1` / `p-1` | 4px    |
| 2         | `gap-2` / `p-2` | 8px    |
| 3         | `gap-3` / `p-3` | 12px   |
| 4         | `gap-4` / `p-4` | 16px   |
| 5         | `gap-5` / `p-5` | 20px   |
| 6         | `gap-6` / `p-6` | 24px   |
| 8         | `gap-8` / `p-8` | 32px   |

Use Tailwind's default spacing scale. Do not use half-steps (`gap-1.5`, `p-2.5`) for layout spacing. Half-steps (2px) are only for micro interactive element internals.

### Common Patterns

```
Section padding:    p-4  (16px)
Card padding:       p-3  (12px)
Row gap:            gap-2 (8px)
Inline icon gap:    gap-1 (4px)
Toolbar padding:    px-3 py-2 (12px horizontal, 8px vertical)
```

---

## Typography

### Scale

All sizes are **relative to the user's base font size** (`--glass-ui-font-size-user`, default 13px, range 11-16px).

| Token     | CSS variable           | Calculation  | At 13px | Use                             |
| --------- | ---------------------- | ------------ | ------- | ------------------------------- |
| `caption` | `--glass-text-caption` | `base - 3px` | 10px    | Badges, counts, tertiary labels |
| `detail`  | `--glass-text-detail`  | `base - 2px` | 11px    | Timestamps, metadata, secondary |
| `body`    | `--glass-text-body`    | `base` (1em) | 13px    | Primary text, inputs, buttons   |
| `title`   | `--glass-text-title`   | `base + 2px` | 15px    | Section headers                 |
| `heading` | `--glass-text-heading` | `base + 5px` | 18px    | Page titles                     |

### Tailwind Usage

```html
<p class="text-body">Primary content</p>
<span class="text-detail text-muted-foreground">Yesterday at 3:42 PM</span>
<span class="text-caption font-medium">28</span>
<h2 class="text-title font-semibold">Section Title</h2>
<h1 class="text-heading font-semibold tracking-tight">Page Title</h1>
```

### Component Usage

```tsx
<Text size="body">Primary content</Text>
<Text size="detail" color="muted">Yesterday at 3:42 PM</Text>
<Text size="caption" weight="medium">28</Text>
<Text size="title" weight="semibold" as="h2">Section Title</Text>
<Text size="heading" weight="semibold" as="h1">Page Title</Text>
```

### Forbidden Values

Do not use these. They are off-scale:

- `text-[12px]` -- use `text-detail` (11px) or `text-body` (13px)
- `text-[14px]` / `text-sm` -- use `text-body` (13px) or `text-title` (15px)
- `text-xs` -- use `text-detail` (11px) for the Tailwind 12px replacement
- `text-base` -- use `text-body` (13px) which tracks the user preference

### Scaling Behavior

When the user changes their font size in Appearance settings:

| User sets | caption | detail | body | title | heading |
| --------- | ------- | ------ | ---- | ----- | ------- |
| 11px      | 8px     | 9px    | 11px | 13px  | 16px    |
| 13px      | 10px    | 11px   | 13px | 15px  | 18px    |
| 15px      | 12px    | 13px   | 15px | 17px  | 20px    |
| 16px      | 13px    | 14px   | 16px | 18px  | 21px    |

---

## Border Radius

Three semantic tiers. Do not use arbitrary radius values.

| Token     | CSS variable             | Value | Use                                  |
| --------- | ------------------------ | ----- | ------------------------------------ |
| `control` | `--glass-radius-control` | 6px   | Buttons, inputs, toggles, menu items |
| `card`    | `--glass-radius-card`    | 10px  | Panels, cards, popovers, dialogs     |
| `pill`    | `--glass-radius-pill`    | 20px  | Chips, pills, full-round elements    |

### Tailwind Usage

```html
<button class="rounded-glass-control">Action</button>
<div class="rounded-glass-card">Card content</div>
<span class="rounded-glass-pill">Chip</span>
```

### Forbidden Values

Do not use these without justification:

- `rounded-sm` (4px) -- use `rounded-glass-control` (6px)
- `rounded-lg` (8px) -- use `rounded-glass-control` (6px) for controls, `rounded-glass-card` (10px) for cards
- `rounded-xl` (12px) -- use `rounded-glass-card` (10px)
- `rounded-[18px]`, `rounded-[14px]` -- use `rounded-glass-pill` (20px) or `rounded-glass-card` (10px)

### Nested Radius

When a control sits inside a card with padding, the inner radius should be smaller than the outer to maintain visual concentricity:

```html
<!-- Card with p-2 (8px padding), inner control radius = card radius - padding -->
<div class="rounded-glass-card p-2">
  <!-- Inner radius ≈ 10px - 8px = 2px, but use control (6px) as minimum -->
  <button class="rounded-glass-control">Action</button>
</div>
```

---

## CSS Tokens

All tokens are defined as CSS custom properties in `glass.css` and bridged to Tailwind in `index.css`.

### Token Reference

```css
/* glass.css */
:root {
  /* Spatial grid (informational -- use Tailwind spacing scale directly) */
  --glass-space-unit: 4px;

  /* Typography */
  --glass-text-caption: calc(var(--glass-ui-font-size-user, 13px) - 3px);
  --glass-text-detail: calc(var(--glass-ui-font-size-user, 13px) - 2px);
  --glass-text-body: var(--glass-ui-font-size-user, 13px);
  --glass-text-title: calc(var(--glass-ui-font-size-user, 13px) + 2px);
  --glass-text-heading: calc(var(--glass-ui-font-size-user, 13px) + 5px);

  /* Border radius */
  --glass-radius-control: 6px;
  --glass-radius-card: 10px;
  --glass-radius-pill: 20px;
}
```

### Tailwind Bridge

```css
/* index.css @theme inline */
@theme inline {
  --font-size-caption: var(--glass-text-caption);
  --font-size-detail: var(--glass-text-detail);
  --font-size-body: var(--glass-text-body);
  --font-size-title: var(--glass-text-title);
  --font-size-heading: var(--glass-text-heading);

  --radius-glass-control: var(--glass-radius-control);
  --radius-glass-card: var(--glass-radius-card);
  --radius-glass-pill: var(--glass-radius-pill);
}
```

This enables `text-caption`, `text-detail`, `text-body`, `text-title`, `text-heading` and `rounded-glass-control`, `rounded-glass-card`, `rounded-glass-pill` as Tailwind utility classes.

---

## Component Primitives

All primitives live in `apps/web/src/components/ui/`. Import from `~/components/ui/<name>`.

### Text

Semantic text rendering component. Enforces the type scale.

```tsx
import { Text } from "~/components/ui/text";

<Text size="body">Default body text</Text>
<Text size="detail" color="muted">Secondary info</Text>
<Text size="caption" weight="medium">28</Text>
<Text size="heading" weight="semibold" as="h1">Page Title</Text>
```

#### Props

| Prop        | Type                                                                | Default  |
| ----------- | ------------------------------------------------------------------- | -------- |
| `size`      | `"caption" \| "detail" \| "body" \| "title" \| "heading"`           | `"body"` |
| `weight`    | `"normal" \| "medium" \| "semibold" \| "bold"`                      | inherits |
| `color`     | `"default" \| "muted" \| "foreground"`                              | inherits |
| `as`        | `"span" \| "p" \| "h1" \| "h2" \| "h3" \| "h4" \| "label" \| "div"` | `"span"` |
| `className` | `string`                                                            | --       |

### Badge

Status and label badges with color variants.

```tsx
import { Badge } from "~/components/ui/badge";

<Badge>Default</Badge>
<Badge variant="addition">+12</Badge>
<Badge variant="deletion">-3</Badge>
<Badge variant="warning">Modified</Badge>
<Badge variant="info">OAuth</Badge>
```

#### Props

| Prop        | Type                                                                            | Default     |
| ----------- | ------------------------------------------------------------------------------- | ----------- |
| `variant`   | `"neutral" \| "addition" \| "deletion" \| "warning" \| "info" \| "destructive"` | `"neutral"` |
| `className` | `string`                                                                        | --          |

Badges always render at `caption` size with `font-medium`. Border and background colors are derived from the variant.

### SegmentedControl

Tab-style toggle for switching between options.

```tsx
import { SegmentedControl } from "~/components/ui/segmented-control";

<SegmentedControl
  value={style}
  onChange={setStyle}
  options={[
    { value: "unified", label: "Unified" },
    { value: "split", label: "Split" },
  ]}
/>;
```

#### Props

| Prop        | Type                                      | Default     |
| ----------- | ----------------------------------------- | ----------- |
| `value`     | `string`                                  | --          |
| `onChange`  | `(value: string) => void`                 | --          |
| `options`   | `Array<{ value: string; label: string }>` | --          |
| `size`      | `"sm" \| "default"`                       | `"default"` |
| `className` | `string`                                  | --          |

### Label

Form and section labels with semantic sizing.

```tsx
import { Label } from "~/components/ui/label";

<Label>Field name</Label>
<Label size="section">Section Title</Label>
```

#### Props

| Prop        | Type                     | Default     |
| ----------- | ------------------------ | ----------- |
| `size`      | `"default" \| "section"` | `"default"` |
| `htmlFor`   | `string`                 | --          |
| `className` | `string`                 | --          |

Default labels use `body` size with `font-medium`. Section labels use `detail` size with `font-medium` and `text-muted-foreground`.

### Kbd

Keyboard shortcut display.

```tsx
import { Kbd } from "~/components/ui/kbd";

<Kbd>⌘K</Kbd>
<Kbd keys={["⌘", "Shift", "P"]} />
```

#### Props

| Prop        | Type        | Default |
| ----------- | ----------- | ------- |
| `keys`      | `string[]`  | --      |
| `children`  | `ReactNode` | --      |
| `className` | `string`    | --      |

Renders at `caption` size with a subtle border and background. Use either `keys` (renders each key in its own `<kbd>`) or `children` (raw content).

---

## Migration Checklist

When editing a component file, apply these substitutions:

### Font Sizes

| Find          | Replace with                 | Notes                                            |
| ------------- | ---------------------------- | ------------------------------------------------ |
| `text-[10px]` | `text-caption`               | All instances                                    |
| `text-[11px]` | `text-detail`                | All instances                                    |
| `text-[12px]` | `text-detail` or `text-body` | Audit: secondary info -> detail, primary -> body |
| `text-[13px]` | `text-body`                  | All instances                                    |
| `text-xs`     | `text-detail`                | 12px -> 11px                                     |
| `text-sm`     | `text-body`                  | 14px -> 13px (body tracks user pref)             |
| `text-base`   | `text-body`                  | 16px -> 13px (body tracks user pref)             |

### Border Radius

| Find             | Replace with                                                            |
| ---------------- | ----------------------------------------------------------------------- |
| `rounded-sm`     | `rounded-glass-control`                                                 |
| `rounded-md`     | `rounded-glass-control`                                                 |
| `rounded-lg`     | `rounded-glass-control` (controls) or `rounded-glass-card` (containers) |
| `rounded-xl`     | `rounded-glass-card`                                                    |
| `rounded-2xl`    | `rounded-glass-card`                                                    |
| `rounded-[14px]` | `rounded-glass-card`                                                    |
| `rounded-[18px]` | `rounded-glass-pill`                                                    |
| `rounded-[20px]` | `rounded-glass-pill`                                                    |

### Spacing (Audit Only)

Remove non-grid values. Common fixes:

| Find      | Replace with       | Pixels                            |
| --------- | ------------------ | --------------------------------- |
| `gap-1.5` | `gap-1` or `gap-2` | 6px -> 4px or 8px                 |
| `gap-0.5` | `gap-1`            | 2px -> 4px (unless micro element) |
| `p-1.5`   | `p-1` or `p-2`     | 6px -> 4px or 8px                 |
| `px-2.5`  | `px-2` or `px-3`   | 10px -> 8px or 12px               |
| `py-0.5`  | `py-1`             | 2px -> 4px (unless micro element) |

### Badge Patterns

Replace inline badge markup:

```html
<!-- Before -->
<span
  class="shrink-0 rounded border border-glass-diff-addition/40 bg-glass-diff-addition-bg px-1 py-0.5 text-[10px]/[1] font-medium text-glass-diff-addition"
>
  +12
</span>

<!-- After -->
<Badge variant="addition">+12</Badge>
```

### Segmented Controls

Replace inline toggle groups:

```html
<!-- Before -->
<div class="flex items-center rounded-lg border border-glass-border/40 bg-glass-hover/15 p-0.5">
  <button class="rounded px-2 py-1 text-[10px]/[1] font-medium ...">Unified</button>
  <button class="rounded px-2 py-1 text-[10px]/[1] font-medium ...">Split</button>
</div>

<!-- After -->
<SegmentedControl
  value={style}
  onChange={setStyle}
  options={[
    { value: "unified", label: "Unified" },
    { value: "split", label: "Split" },
  ]}
/>
```
