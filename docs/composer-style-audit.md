# Composer UI Style Audit Report

Based on the [Glass Design System](docs/design-system.md), here are the style inconsistencies found in composer-related components:

## Summary of Violations

### 1. Border Radius Non-Compliance

| Location                               | Current              | Should Be                     | Token                    |
| -------------------------------------- | -------------------- | ----------------------------- | ------------------------ |
| `glass-pi-composer.tsx:AttachmentChip` | `rounded-2xl` (16px) | `rounded-glass-card` (10px)   | `--glass-radius-card`    |
| `glass-pi-composer.tsx:drop overlay`   | `rounded-[14px]`     | `rounded-glass-pill` (20px)   | `--glass-radius-pill`    |
| `glass-slash-menu.tsx:Popup`           | `rounded-[18px]`     | `rounded-glass-pill` (20px)   | `--glass-radius-pill`    |
| `glass-slash-menu.tsx:Menu items`      | `rounded-2xl`        | `rounded-glass-control` (6px) | `--glass-radius-control` |
| `pi-model-picker.tsx:Menu items`       | `rounded` (4px)      | `rounded-glass-control` (6px) | `--glass-radius-control` |

### 2. Spacing Off 4px Grid

| Location                | Current         | Should Be                     | Note                        |
| ----------------------- | --------------- | ----------------------------- | --------------------------- |
| `AttachmentChip`        | `px-2.5` (10px) | `px-2` (8px) or `px-3` (12px) | 10px not on grid            |
| `glass-pi-composer.tsx` | `pb-2.5` (10px) | `pb-2` (8px) or `pb-3` (12px) | Dock padding                |
| `glass-slash-menu.tsx`  | `px-2.5` (10px) | `px-2` (8px) or `px-3` (12px) | Menu item padding           |
| `pi-model-picker.tsx`   | `py-1.5` (6px)  | `py-1` (4px) or `py-2` (8px)  | 6px only for micro elements |
| `glass-pi-composer.tsx` | `px-1.5` (6px)  | `px-2` (8px)                  | Toolbar padding             |
| `glass-pi-composer.tsx` | `pb-1.5` (6px)  | `pb-1` (4px) or `pb-2` (8px)  | Toolbar padding             |

### 3. Icon Sizes Off Grid

| Location                | Current           | Should Be                          | Note               |
| ----------------------- | ----------------- | ---------------------------------- | ------------------ |
| `glass-pi-composer.tsx` | `size-4.5` (18px) | `size-4` (16px) or `size-5` (20px) | Attachment glyph   |
| `glass-slash-menu.tsx`  | `size-4.5` (18px) | `size-4` (16px) or `size-5` (20px) | File/command icons |

### 4. Shadow Non-Standard

| Location                      | Current                                                              | Should Be            |
| ----------------------------- | -------------------------------------------------------------------- | -------------------- |
| `pi-model-picker.tsx:Submenu` | `shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_-4px_rgb(0_0_0/0.07)]` | `shadow-glass-popup` |

### 5. Typography Inconsistencies

| Location               | Current           | Should Be   | Note                         |
| ---------------------- | ----------------- | ----------- | ---------------------------- |
| `pi-model-picker.tsx`  | `text-body/[1.3]` | `text-body` | Avoid arbitrary line-heights |
| `glass-slash-menu.tsx` | `text-body/[1.2]` | `text-body` | Use design system defaults   |

## Detailed File Analysis

### `apps/web/src/components/glass/glass-pi-composer.tsx`

**AttachmentChip component:**

```tsx
// BEFORE (violations)
<div className="... rounded-2xl ... px-2.5 py-2 ...">
  <Glyph className="size-4.5" />

// AFTER (compliant)
<div className="... rounded-glass-card ... px-2 py-2 ...">
  <Glyph className="size-4" />
```

**Drop overlay:**

```tsx
// BEFORE
<div className="... rounded-[14px] ...">

// AFTER
<div className="... rounded-glass-pill ...">
```

**Toolbar:**

```tsx
// BEFORE
<div className="... px-1.5 pt-0 pb-1.5 ...">

// AFTER
<div className="... px-2 pt-0 pb-1 ...">
```

**Dock padding:**

```tsx
// BEFORE (in pb-2.5 - 10px)
"shrink-0 px-4 pt-2 pb-2.5 md:px-6";

// AFTER
"shrink-0 px-4 pt-2 pb-2 md:px-6";
```

### `apps/web/src/components/glass/glass-slash-menu.tsx`

**Popup:**

```tsx
// BEFORE
className = "... rounded-[18px] ...";

// AFTER
className = "... rounded-glass-card ...";
```

**Menu items:**

```tsx
// BEFORE
"... rounded-2xl px-2.5 py-2 ...";

// AFTER
"... rounded-glass-control px-2 py-2 ...";
```

**Icons:**

```tsx
// BEFORE
<IconFileBend className="size-4.5" />

// AFTER
<IconFileBend className="size-4" />
```

### `apps/web/src/components/glass/pi-model-picker.tsx`

**Menu items:**

```tsx
// BEFORE
className = "... rounded ... py-1.5 ...";

// AFTER
className = "... rounded-glass-control ... py-1 ...";
```

**Submenu shadow:**

```tsx
// BEFORE
className = "... shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_16px_-4px_rgb(0_0_0/0.07)] ...";

// AFTER
className = "... shadow-glass-popup ...";
```

**Skeleton:**

```tsx
// BEFORE
<Skeleton className="... h-2.5 ..." />

// AFTER
<Skeleton className="... h-2 ..." /> or h-3
```

## Migration Checklist

### High Priority (Visual Breaking)

- [ ] Fix `rounded-2xl` → `rounded-glass-card` in AttachmentChip
- [ ] Fix `rounded-[14px]` → `rounded-glass-pill` in drop overlay
- [ ] Fix `rounded-[18px]` → `rounded-glass-card` in slash menu popup
- [ ] Fix `rounded-2xl` → `rounded-glass-control` in slash menu items

### Medium Priority (Spacing)

- [ ] Fix all `px-2.5` → `px-2` or `px-3`
- [ ] Fix all `py-1.5` → `py-1` or `py-2`
- [ ] Fix `pb-2.5` → `pb-2` or `pb-3`
- [ ] Fix `h-2.5` → `h-2` or `h-3`

### Low Priority (Icons)

- [ ] Fix `size-4.5` → `size-4` or `size-5`
- [ ] Standardize icon sizes across menus (size-3 vs size-3.5 vs size-4)

### Polish

- [ ] Replace arbitrary shadow with `shadow-glass-popup`
- [ ] Remove arbitrary line-height modifiers `/[1.3]`, `/[1.2]` where not needed
