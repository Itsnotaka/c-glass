# Glass Design System v2

> Tighter spacing, refined tokens. Matches Cursor Glass aesthetic.

## Spatial Grid

Glass uses a **4px fixed grid** with tighter defaults.

```
2   4   8   12   16   20   24   32   40   48
```

### Primary Spacing

| Pixels | Token     | Use                                      |
| ------ | --------- | ---------------------------------------- |
| 4px    | `space-1` | Tight padding, icon gaps, micro elements |
| 8px    | `space-2` | Standard gaps, button padding            |
| 12px   | `space-3` | Card padding, section gaps               |
| 16px   | `space-4` | Page padding, large gaps                 |

### Exceptions (Tight Mode)

- **2px**: Micro insets inside interactive elements only
- **6px**: Border-radius only, not spacing

### Forbidden Spacing

| Old Value       | New Value                   | Notes      |
| --------------- | --------------------------- | ---------- |
| `px-2.5` (10px) | `px-2` (8px)                | Round down |
| `py-1.5` (6px)  | `py-1` (4px)                | Tighter    |
| `pb-2.5` (10px) | `pb-2` (8px)                | Round down |
| `h-2.5` (10px)  | `h-2` (8px) or `h-3` (12px) | Pick even  |

## Typography

### Scale

| Token     | Size | Use                      |
| --------- | ---- | ------------------------ |
| `caption` | 10px | Badges, counts, tertiary |
| `detail`  | 11px | Metadata, timestamps     |
| `body`    | 12px | Primary text (was 13px)  |
| `title`   | 14px | Section headers          |
| `heading` | 16px | Page titles              |

### Migration

```html
<!-- BEFORE -->
<span class="text-body">Label</span>
<!-- 13px -->

<!-- AFTER -->
<span class="text-body">Label</span>
<!-- 12px -->
```

## Border Radius

| Token     | Value | Use                         |
| --------- | ----- | --------------------------- |
| `control` | 4px   | Buttons, inputs, menu items |
| `card`    | 6px   | Cards, popovers, dialogs    |
| `pill`    | 16px  | Pills, chips, full-round    |

### Migration

| Old                           | New                                                       |
| ----------------------------- | --------------------------------------------------------- |
| `rounded-glass-control` (6px) | `rounded` (4px)                                           |
| `rounded-glass-card` (10px)   | `rounded-glass-card` (6px)                                |
| `rounded-2xl` (16px)          | `rounded-glass-card` (6px) or `rounded-glass-pill` (16px) |
| `rounded-[14px]`              | `rounded-glass-card` (6px)                                |
| `rounded-[18px]`              | `rounded-glass-card` (6px)                                |

## Component Primitives

### Menu/Popup

```tsx
// Standard popup
<Menu.Popup className="rounded-glass-card border border-glass-stroke bg-glass-bubble shadow-glass-popup">
  <Menu.Item className="rounded px-2 py-1 ...">  {/* 4px radius */}
```

### Buttons

```tsx
// Icon button
<button className="size-8 rounded flex items-center justify-center ...">
  <Icon className="size-4" /> {/* 16px icon */}
</button>
```

### Attachment Chip

```tsx
<div className="rounded border border-glass-border/40 bg-glass-hover/18 px-2 py-2 ...">
  <Glyph className="size-4" />
</div>
```

## CSS Tokens

```css
:root {
  /* Spacing */
  --glass-space-1: 4px;
  --glass-space-2: 8px;
  --glass-space-3: 12px;
  --glass-space-4: 16px;

  /* Typography */
  --glass-text-caption: 10px;
  --glass-text-detail: 11px;
  --glass-text-body: 12px;
  --glass-text-title: 14px;
  --glass-text-heading: 16px;

  /* Radius */
  --glass-radius-control: 4px;
  --glass-radius-card: 6px;
  --glass-radius-pill: 16px;
}
```

## Quick Fixes

### Composer Components

| File                    | Before           | After                      |
| ----------------------- | ---------------- | -------------------------- |
| `glass-pi-composer.tsx` | `rounded-2xl`    | `rounded` (4px)            |
| `glass-pi-composer.tsx` | `px-2.5`         | `px-2`                     |
| `glass-pi-composer.tsx` | `py-1.5`         | `py-1`                     |
| `glass-slash-menu.tsx`  | `rounded-[18px]` | `rounded-glass-card` (6px) |
| `glass-slash-menu.tsx`  | `rounded-2xl`    | `rounded` (4px)            |
| `glass-slash-menu.tsx`  | `px-2.5`         | `px-2`                     |
| `glass-slash-menu.tsx`  | `size-4.5`       | `size-4`                   |
