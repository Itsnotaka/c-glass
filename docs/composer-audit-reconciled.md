# Composer UI Audit: Design System vs Cursor Source

Cross-referencing `docs/design-system.md` with `research-scratchpad.md` (actual Cursor 3.0.4 CSS).

## Key Finding: Cursor Uses Different Values Than Our Design System

| Element              | Our Design System                          | Cursor Actual                                    | Status      |
| -------------------- | ------------------------------------------ | ------------------------------------------------ | ----------- |
| **Popup radius**     | `rounded-glass-card` (10px)                | `rounded-[6px]` (quick-input)                    | ⚠️ Mismatch |
| **Control radius**   | `rounded-glass-control` (6px)              | `4px` (review-changes), `6px` (commit textarea)  | ⚠️ Mixed    |
| **Menu item radius** | `rounded-glass-control` (6px)              | `4px` (review-changes), `3px` (quick-input-list) | ⚠️ Off      |
| **File row height**  | Not specified                              | `22px` (SCM), `16px` line-height (changes)       | ⚠️ Gap      |
| **Icon size**        | `size-4` (16px)                            | `16px` (quick-input-icon)                        | ✅ Match    |
| **Gap (file rows)**  | `gap-2` (8px)                              | `6px` (changes), `4px` (SCM)                     | ⚠️ Off grid |
| **Padding (rows)**   | `p-2` (8px)                                | `4px` (review-changes-cell)                      | ⚠️ Tighter  |
| **Typography scale** | `caption` 10px, `detail` 11px, `body` 13px | `11px` path, `12px` file, `13px` group title     | ⚠️ Off      |

## Specific Inconsistencies in Our Code

### 1. Border Radius - Should Be Tighter

**Current in our code:**

```tsx
// glass-slash-menu.tsx
rounded-[18px]          // 18px - way too big
rounded-2xl             // 16px - too big

// glass-pi-composer.tsx
rounded-2xl             // 16px for attachment chip
rounded-[14px]          // 14px for drop overlay
```

**Cursor uses:**

```css
/* From workbench.desktop.main.css */
.quick-input-widget {
  border-radius: 6px;
}
.quick-input-list .monaco-list-row {
  border-radius: 3px;
}
.review-changes-selectable-cell {
  border-radius: 4px;
}
```

**Recommendation:**

- Popups: `rounded-glass-control` (6px) not card (10px)
- Menu items: `rounded` (4px) or tighter
- Attachment chips: `rounded-glass-control` (6px)

### 2. Spacing - Cursor Uses Tighter Values

**Current in our code:**

```tsx
px - 2.5; // 10px - not on 4px grid
py - 1.5; // 6px - not on 4px grid (only for micro)
pb - 2.5; // 10px - not on 4px grid
```

**Cursor uses:**

```css
padding: 4px; /* review-changes-selectable-cell */
gap: 6px; /* changes-list, review-changes-selectable-cell */
padding: 6px 8px; /* commit-message-textarea */
```

**Note:** Cursor uses `6px` gaps which are **off the 4px grid** but match their design.

**Recommendation:** Stick to our 4px grid but acknowledge Cursor uses tighter spacing:

- `px-2` (8px) or `px-1` (4px) instead of `px-2.5`
- `py-1` (4px) or `py-2` (8px) instead of `py-1.5`

### 3. Typography Scale Mismatch

**Our design system:**
| Token | Size |
|-------|------|
| caption | 10px |
| detail | 11px |
| body | 13px |

**Cursor actual:**

```css
font-size: 11px; /* review-changes-path-prefix (detail) */
font-size: 12px; /* review-changes-file-name (body-ish) */
font-size: 12px; /* quick-input (body) */
font-size: 13px; /* review-changes-group__title (title) */
font-size: 17px; /* smart-review-panel__title (heading) */
```

**Finding:** Cursor doesn't strictly follow our type scale. They use 12px as a primary size.

### 4. Icon Sizes

**Current in our code:**

```tsx
size - 4.5; // 18px - not on grid
size - 3.5; // 14px - not on grid
size - 3; // 12px - OK
```

**Cursor uses:**

```css
width: 16px;
height: 22px; /* quick-input-list-icon with padding */
width: 16px;
height: 16px; /* review-changes-group__chevron */
```

**Recommendation:**

- Standardize on `size-4` (16px) for most icons
- Use `size-3` (12px) for small indicators

## Token Mapping Discrepancies

### Glass Variables Cursor Actually Uses

```css
--glass-traffic-lights-spacer-width
--glass-in-app-menu-bar-height
--glass-sidebar-surface-background
--glass-chat-surface-background
--glass-editor-surface-background
--glass-surface-background
--glass-chat-bubble-background
--glass-window-border-color
```

### We Don't Have These Mapped

| Cursor Token               | Our Equivalent             | Gap               |
| -------------------------- | -------------------------- | ----------------- |
| `--cursor-text-primary`    | `text-foreground`          | ✅ Close          |
| `--cursor-text-secondary`  | `text-muted-foreground`    | ✅ Close          |
| `--cursor-text-tertiary`   | `text-muted-foreground/70` | ⚠️ Needs explicit |
| `--cursor-bg-secondary`    | `bg-glass-hover`           | ⚠️ Different      |
| `--cursor-stroke-tertiary` | `border-glass-border/30`   | ⚠️ Not exact      |

## Migration Recommendations

### Immediate Fixes (Breaking Visuals)

1. **Popups:**

   ```tsx
   // BEFORE
   className = "... rounded-[18px] ...";

   // AFTER
   className = "... rounded-glass-control ..."; // 6px per Cursor
   ```

2. **Menu items:**

   ```tsx
   // BEFORE
   className = "... rounded-2xl ..."; // 16px

   // AFTER
   className = "... rounded ..."; // 4px like Cursor
   ```

3. **Spacing:**

   ```tsx
   // BEFORE
   className = "... px-2.5 py-1.5 ...";

   // AFTER
   className = "... px-2 py-1 ..."; // Or px-3 py-2
   ```

### Design System Updates Needed

1. **Add 12px size** between `detail` (11px) and `body` (13px)
2. **Clarify** that 6px is allowed for gaps when matching Cursor
3. **Document** that popups use `rounded-glass-control` (6px), not card
4. **Add** the Cursor variable mapping to our tokens

## Component-Specific Findings

### `glass-pi-composer.tsx`

| Element            | Current              | Should Be (per Cursor)                           |
| ------------------ | -------------------- | ------------------------------------------------ |
| Attachment chip    | `rounded-2xl` (16px) | `rounded` (4px) or `rounded-glass-control` (6px) |
| Attachment padding | `px-2.5` (10px)      | `p-1` (4px) or `p-2` (8px)                       |
| Attachment icon    | `size-4.5` (18px)    | `size-4` (16px)                                  |
| Drop overlay       | `rounded-[14px]`     | `rounded-glass-control` (6px)                    |
| Toolbar padding    | `px-1.5` (6px)       | `px-2` (8px)                                     |

### `glass-slash-menu.tsx`

| Element        | Current              | Should Be (per Cursor)        |
| -------------- | -------------------- | ----------------------------- |
| Popup          | `rounded-[18px]`     | `rounded-glass-control` (6px) |
| Menu items     | `rounded-2xl` (16px) | `rounded` (4px)               |
| Item padding   | `px-2.5` (10px)      | `px-2` (8px)                  |
| Icon container | `size-8`             | Keep, but icon `size-4`       |

### `pi-model-picker.tsx`

| Element        | Current         | Should Be (per Cursor)    |
| -------------- | --------------- | ------------------------- |
| Menu items     | `rounded` (4px) | OK, but `py-1.5` → `py-1` |
| Submenu shadow | arbitrary       | `shadow-glass-popup`      |

## Conclusion

The design system specifies larger, more generous spacing (4px grid multiples). **Cursor's actual Glass UI is tighter** with values like 4px padding, 6px gaps (off-grid), and smaller border radius.

**Decision needed:**

- Option A: Follow our design system strictly (more whitespace, on-grid)
- Option B: Match Cursor's tighter aesthetic (less whitespace, some off-grid values)
- Option C: Hybrid - keep our grid but use tighter values where Cursor does
