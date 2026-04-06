# ADR-003: Glass Appearance Logic Must Follow Cursor's Theme -> Tint -> Material Cascade

- **Status**: Draft
- **Date**: 2026-04-06
- **Authors**: Daniel

## Context

This ADR records the logic model that should govern Glass appearance work in `c-glass`.

The immediate trigger is a mismatch between:

1. the current `c-glass` appearance implementation,
2. the actual runtime logic shipped in Cursor Glass,
3. and the product constraint from this conversation that logic must be settled before more UI work happens.

This ADR is intentionally about logic, derivation order, persistence shape, and runtime authority.

It is not a UI spec.

It does not decide:

1. control labels,
2. slider placement,
3. visual grouping in Settings,
4. preview widgets,
5. onboarding copy.

Those are downstream concerns.

## Conversation Decider

This section is the authoritative summary of the decision captured in this conversation.

### Decider Summary

`c-glass` must stop treating Glass appearance as a flat bag of independent local controls.

The Cursor Glass runtime model is layered.

The relevant layers are:

1. a base Glass theme choice,
2. an optional custom tint overlay,
3. a separate material state that controls vibrancy and transparency behavior.

The derivation order matters.

The correct logic order is:

1. resolve the active base theme,
2. optionally apply tint overrides onto semantic theme tokens,
3. apply material classes such as vibrancy on/off and reduce-transparency,
4. let Glass surface variables derive from those semantic tokens and classes.

The next implementation pass in `c-glass` must follow that order.

### Plain-Language Rule

The app must have one color authority chain, not multiple competing ones.

That means:

1. do not mix a separate local palette system with a Cursor-parity tint system as equal peers,
2. do not compute final Glass surfaces directly from ad hoc local hue/transparency math if the parity target is Cursor,
3. do not treat transparency as a theme,
4. do not treat tint as a second theme table,
5. do not let UI structure decide the runtime model.

If `c-glass` wants a non-Cursor palette system later, that must be a different product mode, not the same Cursor-parity path.

## Scope

This ADR governs the logic behind Glass appearance in `c-glass`.

It specifically covers:

1. persistence shape,
2. derivation order,
3. class and token authority,
4. what Cursor actually does,
5. what `c-glass` must not do if Cursor parity is the target.

It does not cover:

1. the final settings UI,
2. editor theme UX outside Glass,
3. design-system naming cleanup,
4. unrelated diff/chat styling work.

## Exact Cursor Runtime Evidence

This section is intentionally detailed. Every major claim below is tied to shipped Cursor app code.

### Primary Cursor Files

The surveyed install is:

1. `/System/Volumes/Data/Applications/Cursor.app`
2. app version `3.0.4`
3. workbench bundle `Contents/Resources/app/out/vs/workbench/workbench.desktop.main.{js,css}`

The relevant runtime service is embedded in the bundled JS under the source marker:

1. `out-build/vs/glass/browser/services/glass-theme-service.js`

The authoritative static Glass token rules are in:

1. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.css`

## Humane Names For Cursor's Runtime State

Cursor's shipped bundle is minified.

That is fine for proof, but it is the wrong language for product decisions.

The next implementation pass in `c-glass` should translate the relevant Cursor symbols into humane state names before writing code.

The table below is the canonical translation layer for this ADR.

| Cursor bundle symbol | Meaning in plain language | Humane name to use in docs and code review |
| --- | --- | --- |
| `FAi = "glass.theme.settingsId"` | persisted base Glass theme id | `theme_id` |
| `MRu = "glass.theme.detectColorScheme"` | follow system light/dark choice | `follow_system` |
| `NRu = "glass.theme.customTintHue"` | custom tint hue | `tint_hue` |
| `BRu = "glass.theme.customTintIntensity"` | custom tint strength | `tint_intensity` |
| `ARu = "data-cursor-glass-mode"` | Glass mode is active | `glass_mode` |
| `IRu = "cursor-glass-os-vibrancy-on"` | OS vibrancy is active for Glass | `vibrancy_on` |
| `RRu = "cursor-glass-os-vibrancy-off"` | Glass is running without OS vibrancy | `vibrancy_off` |
| `PRu = "cursor-glass-reduce-transparency"` | accessibility-style opaque mode | `reduce_transparency` |
| `FRu = "glass-custom-tint-tokens"` | injected style element for tint overrides | `tint_style` |
| `KDg = [...]` | semantic tokens that tint is allowed to affect | `tint_targets` |

These names are not required to be the exact final identifiers in source.

They are required to be the mental model.

That means a future implementation should be readable as:

1. resolve `theme_id`,
2. apply `follow_system`,
3. maybe apply `tint_hue` and `tint_intensity`,
4. then compute `vibrancy_on` or `vibrancy_off`,
5. then apply `reduce_transparency`.

It should not read like a local pile of unrelated slider outputs.

## Cursor Layer 1: Base Theme Preference

Cursor Glass has an explicit base theme table.

Bundled JS evidence from `workbench.desktop.main.js`:

```js
(function(n){n.Dark="cursor-dark",n.Light="cursor-light",n.HighContrast="cursor-high-contrast"})(xF||(xF={})),
Ooe={[xF.Dark]:XM.COLOR_THEME_DARK,[xF.Light]:XM.COLOR_THEME_LIGHT,[xF.HighContrast]:"Cursor Dark High Contrast"},
NAi="follow-system",
BAi=xF.Dark,
glt=[
  {id:xF.Dark,label:"Cursor Dark",settingsId:Ooe[xF.Dark],type:"dark",...bodyClass:"cursor-dark",vsCompat:VP.VS_DARK},
  {id:xF.Light,label:"Cursor Light",settingsId:Ooe[xF.Light],type:"light",...bodyClass:"cursor-light",vsCompat:VP.VS},
  {id:xF.HighContrast,label:"Cursor Dark High Contrast",settingsId:Ooe[xF.HighContrast],type:"dark",...bodyClass:"cursor-high-contrast",vsCompat:VP.HC_BLACK}
]
```

This establishes that Cursor Glass does not start from a free-form hue-based surface model.

It starts from a named base theme definition.

That base theme has:

1. an `id`,
2. a persisted `settingsId`,
3. a `type`,
4. a `bodyClass`,
5. a VS Code compatibility theme bucket.

### Base Theme Resolution

Cursor also persists a system-following flag and resolves the active theme from it.

Bundled JS evidence:

```js
FAi="glass.theme.settingsId",
MRu="glass.theme.detectColorScheme",
...
_resolveThemeDef(){
  if(this._preference.detectColorScheme){
    const e=this._hostColorSchemeService.dark?Ooe[xF.Dark]:Ooe[xF.Light];
    return flt(e)
  }
  return flt(this._preference.settingsId)
}
```

That means Cursor Glass theme logic is:

1. choose a specific Glass theme by `settingsId`, or
2. if `detectColorScheme` is enabled, dynamically resolve to Light or Dark.

This is theme resolution logic.

It is not tint logic.

## Cursor Layer 2: Persisted Custom Tint Overlay

Cursor Glass also persists a custom tint.

Bundled JS evidence:

```js
NRu="glass.theme.customTintHue",
BRu="glass.theme.customTintIntensity",
...
const u={hue:210,intensity:0}
...
this._preference={
  settingsId:p,
  detectColorScheme:t.getBoolean(MRu,-1,vRu),
  customTint:{
    hue:t.getNumber(NRu,-1,u.hue),
    intensity:t.getNumber(BRu,-1,u.intensity)
  }
}
```

This is the exact persisted preference shape inside Cursor's Glass theme service.

At minimum, Cursor stores:

1. `settingsId`,
2. `detectColorScheme`,
3. `customTint.hue`,
4. `customTint.intensity`.

### Tint Is Not A Second Theme Table

Cursor does not resolve tint by selecting a second named theme.

Instead, it injects a style overlay that rewrites semantic theme tokens after the base theme is resolved.

Bundled JS evidence:

```js
FRu="glass-custom-tint-tokens",
KDg=[
  {token:"sidebar"},
  {token:"chrome",chromaScale:.5},
  {token:"editor",chromaScale:.5},
  {token:"accent",hueShift:!0},
  {token:"focus",hueShift:!0}
]
```

Then Cursor applies tint like this:

```js
_applyTintOverlay(){
  if(this._preference.customTint.intensity<=0){
    this._tintStyleEl&&(this._tintStyleEl.textContent="");
    return
  }

  ...

  const e=flt(this._currentSettingsId||this._preference.settingsId),
        t=e.id===xF.Light?"light":e.id===xF.HighContrast?"highContrast":"dark",
        i=Kbn[t],
        {hue:r,intensity:s}=this._preference.customTint,
        o=[];

  for(const {token:l,chromaScale:u,hueShift:d} of KDg){
    const h=i[l],
          p=Math.min(s*(u??1),100),
          f=d?Syp(h,r):wyp({hex:h,targetHue:r,intensity:p});
    o.push(`\t--cursor-${l}: ${f};`)
  }

  const a=`body.${e.bodyClass}[data-cursor-glass-mode="true"]`;
  this._tintStyleEl.textContent=`${a} { ${o.join(` `)} }`
}
```

This is the most important logic detail in the entire appearance model.

Tint is:

1. optional,
2. intensity-gated,
3. injected after the base theme is known,
4. scoped to the active Glass body class,
5. applied to semantic `--cursor-*` tokens,
6. not applied by directly recalculating final `--glass-*` surface variables.

That last point is the core parity requirement.

Cursor does not make hue/intensity the primary source of final surfaces.

Cursor makes theme the primary source, and tint an overlay on semantic theme tokens.

### Tint Persistence Timing

Cursor also debounces tint persistence.

Bundled JS evidence:

```js
static{this._TINT_PERSIST_DELAY_MS=300}
setCustomTint(e){
  this._preference={...this._preference,customTint:e},
  this._applyTintOverlay(),
  this._tintPersistTimer!==void 0&&clearTimeout(this._tintPersistTimer),
  this._tintPersistTimer=setTimeout(()=>{
    this._tintPersistTimer=void 0,
    this._savePreference()
  },SRu._TINT_PERSIST_DELAY_MS)
}
```

This matters because it confirms tint is a first-class runtime preference, not a temporary UI-only effect.

## Cursor Layer 3: Material State And Body Classes

Cursor separately manages Glass material classes on `body`.

Bundled JS evidence:

```js
ARu="data-cursor-glass-mode",
IRu="cursor-glass-os-vibrancy-on",
RRu="cursor-glass-os-vibrancy-off",
DRu="cursor-glass-windows-mica",
PRu="cursor-glass-reduce-transparency",
jDg=[IRu,RRu,DRu,PRu]
```

Then Cursor applies those classes like this:

```js
_updateBodyClasses(e,t){
  const {body:i,documentElement:r}=wi.document;

  for(const s of YDg) i.classList.remove(s);
  i.classList.add(e);
  i.classList.add(t);

  for(const s of jDg) i.classList.remove(s);

  if(this._environmentService.isGlass){
    const s=t===VP.HC_BLACK||t===VP.HC_LIGHT,
          o=this._configurationService.getValue(aqn);
    Js&&!s&&!o
      ? i.classList.add(IRu)
      : (i.classList.add(RRu),Ql&&i.classList.add(DRu));
    o&&i.classList.add(PRu)
  }

  if(i.getAttribute(ARu)==="true"){
    r.style.backgroundColor="transparent";
    i.style.backgroundColor="transparent"
  }
}
```

This yields several concrete facts.

### Material Facts From Cursor

1. Vibrancy state is a body class, not a theme.
2. Reduce-transparency is a body class, not a theme.
3. High-contrast compatibility affects whether vibrancy-on is allowed.
4. Body-class material state is recomputed separately from theme and tint.
5. When Glass mode is active, the document/background is forced transparent.

That means the logic layers are separate:

1. theme body class,
2. tint token injection,
3. material body class flags.

## Cursor Surface Mapping: Final `--glass-*` Variables Are Derived, Not Authored First

The Cursor CSS confirms that final Glass surfaces are assigned after theme and material state are known.

### Light Theme Surface Base

Bundled CSS evidence from `workbench.desktop.main.css`:

```css
body.cursor-light [data-component=root]{
  --glass-surface-background:hsla(0,0%,100%,.16);
  --glass-onboard-surface-background:hsla(0,0%,100%,.36);
  --glass-vibrancy-on-surface-background:transparent;
  --glass-vibrancy-off-sidebar-surface-background:var(--cursor-bg-sidebar);
  --glass-vibrancy-off-chat-surface-background:var(--cursor-bg-chrome);
  --glass-vibrancy-off-editor-surface-background:var(--cursor-bg-chrome);
  --glass-vibrancy-on-sidebar-surface-background:var(--cursor-bg-sidebar);
  --glass-vibrancy-on-chat-surface-background:var(--cursor-bg-chrome);
  --glass-vibrancy-on-editor-surface-background:var(--cursor-bg-chrome);
  --glass-chat-bubble-background:var(--cursor-bg-elevated)
}
```

Cursor then refines the vibrancy-on values with transparency-aware `color-mix` rules when supported:

```css
@supports (color:color-mix(in lab,red,red)){
  body.cursor-light [data-component=root]{
    --glass-vibrancy-on-sidebar-surface-background:color-mix(in srgb,var(--cursor-bg-sidebar) 32%,transparent);
    --glass-vibrancy-on-chat-surface-background:color-mix(in srgb,var(--cursor-bg-chrome) 84%,transparent);
    --glass-vibrancy-on-editor-surface-background:color-mix(in srgb,var(--cursor-bg-chrome) 84%,transparent)
  }
}
```

### Off And On Mapping

Then Cursor assigns final surfaces based on material class.

Bundled CSS evidence:

```css
body.cursor-light[data-cursor-glass-mode=true] [data-component=root]{
  --glass-sidebar-surface-background:var(--glass-vibrancy-off-sidebar-surface-background);
  --glass-chat-surface-background:var(--glass-vibrancy-off-chat-surface-background);
  --glass-editor-surface-background:var(--glass-vibrancy-off-editor-surface-background)
}

body.cursor-light.cursor-glass-os-vibrancy-on[data-cursor-glass-mode=true] [data-component=root]{
  --glass-sidebar-surface-background:var(--glass-vibrancy-on-sidebar-surface-background);
  --glass-chat-surface-background:var(--glass-vibrancy-on-chat-surface-background);
  --glass-editor-surface-background:var(--glass-vibrancy-on-editor-surface-background)
}
```

Cursor has the same off/on mapping shape for dark mode:

```css
body.cursor-dark[data-cursor-glass-mode=true] [data-component=root]{
  --glass-sidebar-surface-background:var(--glass-vibrancy-off-sidebar-surface-background);
  --glass-chat-surface-background:var(--glass-vibrancy-off-chat-surface-background);
  --glass-editor-surface-background:var(--glass-vibrancy-off-editor-surface-background)
}

body.cursor-dark.cursor-glass-os-vibrancy-on[data-cursor-glass-mode=true] [data-component=root]{
  --glass-sidebar-surface-background:var(--glass-vibrancy-on-sidebar-surface-background);
  --glass-chat-surface-background:var(--glass-vibrancy-on-chat-surface-background);
  --glass-editor-surface-background:var(--glass-vibrancy-on-editor-surface-background)
}
```

### What This Proves

Cursor Glass final surfaces are derived in this order:

1. theme resolves semantic `--cursor-*` colors,
2. tint may override a subset of those semantic `--cursor-*` colors,
3. CSS derives vibrancy-on/off surface candidates from those semantic tokens,
4. body material class chooses which candidate becomes the final `--glass-*` surface.

That is the actual runtime cascade.

## What Cursor Does Not Do

If Cursor parity is the target, the following are not the governing model.

### Cursor Does Not Start From Direct Final-Surface Math

The Cursor runtime does not make final Glass surfaces the primary persisted appearance authority.

The persisted authority is:

1. theme selection,
2. detect-color-scheme flag,
3. custom tint values.

The final `--glass-*` surfaces are derived later.

### Cursor Does Not Treat Tint As A Named Alternate Palette Table

Tint modifies semantic tokens.

Tint does not select from a second palette family like `glass` vs `pierre`.

### Cursor Does Not Collapse Material And Theme Into One Setting

Reduce-transparency is not the same thing as theme.

Vibrancy on/off is not the same thing as tint.

These are separate runtime layers.

## Current `c-glass` Divergence

The current `c-glass` logic diverges from the Cursor model in several ways.

### Divergence 1: Appearance State Is Flattened

Current local appearance state in `apps/web/src/lib/glass-appearance.ts` persists all of the following as top-level peer controls:

1. `glass:color-preset`,
2. `glass:reduce-transparency`,
3. `glass:window-transparency`,
4. `glass:accent-hue`,
5. `glass:accent-saturation`.

That means `c-glass` is currently treating palette, tint, and material as sibling knobs at the same abstraction level.

That is not how Cursor is structured.

### Why This Matters In Product Behavior

When the state is flattened, the app no longer has a clear answer to the question:

1. what is the base look,
2. what is the optional tint,
3. what is the material state.

That creates ambiguous behavior such as:

1. a slider changing what should have been a theme decision,
2. a palette choice overwriting what should have been a tint overlay,
3. a transparency control being interpreted as color authority,
4. UI code deciding runtime precedence because the state model did not.

In humane terms, the app currently behaves as if all appearance controls are equal votes.

Cursor does not work like that.

Cursor has a chain of command.

The chain is:

1. base theme first,
2. tint second,
3. material third.

### Divergence 2: Final Surface Formulas Are Authored Directly In Local CSS

Current `apps/web/src/glass.css` defines:

1. `--glass-user-hue`,
2. `--glass-intensity`,
3. `--glass-transparency`,
4. direct opacity math like `--glass-sidebar-opacity`,
5. local base surface formulas like `--glass-base-sidebar`,
6. direct final surfaces such as `--glass-color-sidebar`, `--glass-color-chat`, `--glass-color-editor`, and `--glass-color-surface`.

That means `c-glass` is currently computing final Glass surfaces from local formulas first.

Cursor does not do that.

Cursor derives final Glass surfaces from semantic theme tokens after theme resolution and tint overlay.

### Why This Matters In Product Behavior

This divergence means `c-glass` currently behaves like a small design toy instead of a theme system.

The current logic effectively says:

1. start from local hue,
2. start from local intensity,
3. start from local transparency,
4. compute final sidebar/chat/editor surfaces directly.

That is the reverse of Cursor.

Cursor says:

1. start from semantic theme colors such as `sidebar`, `chrome`, `editor`, `accent`, and `focus`,
2. optionally tint those semantic colors,
3. derive final surfaces from those semantic colors depending on material state.

The difference is not academic.

If `c-glass` keeps the current direct-surface model, then:

1. every future tweak has to be made in final-surface math,
2. the app cannot cleanly support theme parity,
3. the app cannot explain why one surface changed and another did not,
4. the appearance system becomes harder to reason about with each new control.

### Divergence 3: A Second Palette System Exists On The Same Path

Current `apps/web/src/lib/pierre-color-presets.ts` injects a second named surface system that directly writes `--glass-color-*` variables.

That creates a second independent color-authority path.

For Cursor parity, that is the wrong level.

The parity path should have:

1. one base Glass theme authority,
2. one optional tint overlay,
3. one material layer.

A second named surface palette is a separate product mode, not the same logic path.

### Why This Matters In Product Behavior

This is the exact place where the product currently violates the conversation constraint that it is either one path or the other, not both mixed together.

In humane language:

1. Cursor mode is one mode,
2. Pierre mode is another mode,
3. they cannot both claim to be the same appearance system.

If `c-glass` stays on the current path, users can end up in a hybrid state where:

1. the app looks like Pierre,
2. tint controls still exist,
3. transparency still exists,
4. but none of those controls map to a single clear appearance story.

That is confusing because the app has no answer to: "am I editing the Cursor Glass look, or am I editing a separate art direction?"

The correct behavior is:

1. if the user is in the Cursor-parity path, the app uses theme -> tint -> material,
2. if the user is in an alternate art-direction path, the app explicitly leaves the Cursor-parity path.

### Divergence 4: Current Settings Code Encodes UI Before Logic Is Settled

Current `apps/web/src/components/settings/settings-panels.tsx` exposes:

1. `Color palette`,
2. `Window transparency`,
3. `Hue`,
4. `Saturation`,
5. `Reduce transparency`.

That is a UI expression of an unresolved runtime model.

This ADR is specifically intended to prevent further logic drift of that kind.

### Why This Matters In Product Behavior

When UI lands before the state model is accepted, the product silently commits to behavior that may be wrong.

That is exactly what happened here.

The settings page now implies all of the following without a settled logic model:

1. `Color palette` is a first-class choice in the Cursor-parity path,
2. `Window transparency` is a first-class peer of theme,
3. `Hue` and `Saturation` are always meaningful controls,
4. `Reduce transparency` is just another style tweak.

Cursor does not imply that model in its runtime.

The runtime says:

1. base theme preference exists,
2. custom tint may exist,
3. material classes exist,
4. final surfaces are derived.

The settings page should only expose controls that match that runtime story.

### Divergence 5: `c-glass` Has A User-Level Transparency Scalar That Cursor Evidence Does Not Show

Current `c-glass` stores `glass:window-transparency` and derives multiple opacity values from it in `apps/web/src/glass.css`.

The Cursor evidence collected for this ADR does not show a persisted user preference named like a global window transparency scalar.

What Cursor does show is:

1. material body classes for vibrancy on and off,
2. reduce-transparency as a separate class,
3. theme-specific CSS percentages for translucent variants,
4. tint intensity for semantic token recoloring.

### Why This Matters In Product Behavior

This means `c-glass` is currently inventing a new product rule instead of following the observed Cursor rule.

That may still be a valid product choice later.

It is not a valid parity assumption today.

If `c-glass` wants a true user-level transparency slider, it must be explicitly documented as a product extension beyond Cursor Glass, not quietly presented as if it came from Cursor's logic.

### Divergence 6: `c-glass` Does Not Yet Distinguish Between Stored Preference And Resolved Runtime State

Cursor clearly distinguishes between:

1. stored preference,
2. resolved theme,
3. applied tint style,
4. applied body material classes,
5. final derived surface variables.

Current `c-glass` mostly stores preference values and immediately authors final CSS from them.

### Why This Matters In Product Behavior

Without a distinction between stored preference and resolved runtime state, the app cannot answer basic runtime questions cleanly:

1. did the user ask for vibrancy, or is vibrancy actually active,
2. is tint configured, or is tint currently applied,
3. is the app following system, or is dark currently resolved,
4. is the current surface color a base theme result or a final material result.

That makes debugging, parity work, and future platform behavior much harder.

## Decision

`c-glass` must adopt Cursor's appearance logic as a layered state machine.

### Decision 1: One Base Theme Authority

The Cursor-parity path in `c-glass` must have exactly one base Glass theme authority.

That authority should represent the equivalent of Cursor's:

1. `settingsId`, and
2. `detectColorScheme`.

This means `c-glass` should model a base Glass theme selection first, not a local final-surface palette first.

### Decision 2: Tint Is An Optional Overlay, Not A Peer Theme System

Tint in `c-glass` must be modeled as an optional overlay with:

1. `hue`,
2. `intensity`.

Tint must:

1. default to disabled when intensity is zero,
2. apply after theme resolution,
3. target semantic theme tokens,
4. not directly become the first author of final `--glass-*` surfaces.

### Decision 3: Material State Must Stay Separate

`c-glass` must keep material state separate from both theme and tint.

Material state includes:

1. vibrancy on/off,
2. reduce transparency,
3. platform-specific window material behavior.

The material layer is responsible for selecting or suppressing translucent variants.

It is not responsible for authoring the base palette.

### Decision 4: Final Surfaces Must Be Derived Late

For Cursor parity, `c-glass` final Glass surfaces must be derived from:

1. semantic base theme tokens,
2. optional tint overlay,
3. material state.

They must not be the first persisted state authority.

### Decision 5: No Additional Palette Family On The Cursor-Parity Path

If `c-glass` keeps a non-Cursor palette family such as Pierre, that path must be treated as a separate product mode.

It must not share the same parity logic path and pretend to be equivalent to Cursor Glass.

Put differently:

1. Cursor-parity path: theme -> tint -> material -> derived surfaces.
2. Alternate-art-direction path: explicitly different mode.

Do not blend them into one unnamed hybrid.

## How `c-glass` Should Behave

This section is normative.

It describes runtime behavior, not UI layout.

### Behavior 1: On Boot

On boot, `c-glass` should do the following in order.

1. Load the stored appearance preference.
2. Resolve the active base theme from `theme_id` and `follow_system`.
3. Stamp the base semantic tokens for that resolved theme.
4. If `tint_intensity > 0`, inject or update the tint style for the allowed semantic targets.
5. Compute material state for the current platform.
6. Apply body classes for `vibrancy_on`, `vibrancy_off`, and `reduce_transparency`.
7. Let CSS derive final Glass surfaces from those classes and semantic tokens.

The app should not jump straight from stored slider values to final sidebar/chat/editor colors.

### Behavior 2: When The System Color Scheme Changes

If `follow_system` is enabled, `c-glass` should:

1. resolve the new base theme,
2. keep the stored tint values unchanged,
3. reapply tint on top of the new base theme,
4. recompute material classes,
5. rederive final surfaces.

The user should experience this as: the base look changed with the system, while their tint preference stayed theirs.

### Behavior 3: When The User Changes Tint

If the user changes tint, `c-glass` should:

1. leave the base theme unchanged,
2. update only the allowed semantic tint targets,
3. leave material state unchanged,
4. persist the new tint preference after a short delay,
5. clear the tint style entirely if `tint_intensity` becomes zero.

In humane terms, tint should recolor the theme.

Tint should not replace the theme.

### Behavior 4: When The User Enables Reduce Transparency

If the user enables `reduce_transparency`, `c-glass` should:

1. keep the same base theme,
2. keep the same tint preference,
3. switch the material layer into opaque mode,
4. disable or suppress vibrancy-on styling,
5. derive final surfaces from opaque candidates.

In humane terms, the window should feel less translucent, but it should still feel like the same theme.

### Behavior 5: When Vibrancy Is Not Available

If the platform, theme bucket, or accessibility state prevents live vibrancy, `c-glass` should:

1. preserve the stored appearance preference,
2. resolve to `vibrancy_off` at runtime,
3. keep tint behavior intact if tint is supported,
4. derive final surfaces from the non-vibrant candidates.

The app should distinguish between:

1. what the user asked for, and
2. what the runtime could actually apply.

### Behavior 6: When An Alternate Art Direction Is Enabled

If `c-glass` keeps a separate art direction such as Pierre, it should behave as a distinct mode.

That means:

1. entering the alternate mode leaves the Cursor-parity path,
2. Cursor-parity tint logic no longer claims authority over the final look,
3. any saved Cursor-parity tint values remain stored for later,
4. returning to the Cursor-parity mode restores the prior base theme, tint, and material state.

This is the humane reading of the user's constraint that it is one path or the other, not both mixed together.

### Behavior 7: How To Explain It To A User

If the logic is correct, the product story should be explainable in one short paragraph:

1. Glass has a base look.
2. You can optionally tint that look.
3. Transparency is a material behavior layered on top.
4. If you switch to a different art direction, you leave the Cursor-style path instead of blending both systems.

If the team cannot explain the appearance system that simply, the logic is still wrong.

## Concrete Runtime Model For `c-glass`

The exact type names can change, but the logic shape should look like this.

```ts
export type GlassThemeId = "cursor-dark" | "cursor-light" | "cursor-high-contrast";

export type AppearanceMode = "cursor" | "alt";

export type GlassAppearancePreference = {
  mode: AppearanceMode;
  theme: {
    settingsId: GlassThemeId;
    detectColorScheme: boolean;
  };
  tint: {
    hue: number;
    intensity: number;
  };
  material: {
    reduceTransparency: boolean;
  };
};
```

If the code prefers shorter names, the humane equivalent is still the same shape:

```ts
type Pref = {
  mode: "cursor" | "alt";
  theme: {
    id: GlassThemeId;
    follow_system: boolean;
  };
  tint: {
    hue: number;
    intensity: number;
  };
  material: {
    reduce_transparency: boolean;
  };
};
```

The runtime derivation order should be:

1. resolve active theme from `theme.detectColorScheme` and `theme.settingsId`,
2. stamp base semantic Glass tokens for that theme,
3. if `tint.intensity > 0`, apply a tint overlay to semantic tokens,
4. compute material classes,
5. derive final surface variables from the material classes.

The important thing is not the exact type spelling.

The important thing is that the source of truth is readable as:

1. mode,
2. theme,
3. tint,
4. material,
5. resolved runtime state.

## Rejected Models

These models are rejected for the Cursor-parity path.

### Rejected Model 1: Direct Final-Surface Authoring As Primary State

Rejected because Cursor does not make final `--glass-*` surfaces the persisted source of truth.

### Rejected Model 2: Two Equal Palette Systems On The Same Path

Rejected because Cursor has one base theme table plus tint overlay, not two equal palette families.

### Rejected Model 3: Treating Transparency, Theme, And Tint As One Flat Peer Set

Rejected because Cursor keeps:

1. theme resolution,
2. tint overlay,
3. material class selection,

as separate layers.

## Implementation Constraints For The Next Pass

The next implementation pass should obey all of the following.

1. Logic first. UI second.
2. Do not add more appearance UI until the state model is accepted.
3. Do not add more direct local surface formulas if Cursor parity is the goal.
4. Do not let `apps/web/src/components/settings/settings-panels.tsx` become the source of truth for runtime logic.
5. Move authority into a formal appearance model before changing presentation.

## Files That Need To Change Next

These are the local files currently involved in the wrong or incomplete logic path.

1. `apps/web/src/lib/glass-appearance.ts`
2. `apps/web/src/glass.css`
3. `apps/web/src/lib/pierre-color-presets.ts`
4. `apps/web/src/components/settings/settings-panels.tsx`
5. `apps/web/src/hooks/use-theme.ts`
6. `apps/desktop/src/main.ts`
7. `apps/desktop/src/preload.ts`

The relevant current Electron material path is already here:

1. `apps/desktop/src/main.ts#L1161-L1169` for `desktop:set-vibrancy`,
2. `apps/desktop/src/main.ts#L1710-L1716` for transparent window creation and macOS hidden-inset traffic lights,
3. `apps/desktop/src/preload.ts#L210` for the renderer bridge.

## Bottom Line

Cursor Glass appearance is not a flat settings panel model.

It is a runtime cascade.

The exact parity logic is:

1. base theme selection,
2. optional custom tint overlay on semantic theme tokens,
3. separate material classes for vibrancy and reduce-transparency,
4. final Glass surfaces derived from those layers.

`c-glass` should adopt that logic before any more UI work is treated as canonical.
