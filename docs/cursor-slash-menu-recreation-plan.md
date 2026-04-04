# Cursor-Style Slash Menu Recreation Plan

## Goal

Recreate Cursor's Glass slash menu in `c-glass` as a polished, typed launcher that feels like the screenshot, while fitting the current architecture in `apps/web` and using Base UI correctly.

## Release Standard

This work is unreleased.

That changes the bar.

The implementation must be canonical from the first merge.

1. Do not build throwaway parity code.
2. Do not create temporary UI paths that will later be replaced by the "real" version.
3. Do not introduce approximate styling if the exact shipped Cursor source can be discovered.
4. Do not split ownership across duplicate components when one canonical component can own the feature.
5. Implement the full slash, `@` mention, and inline token-highlight architecture needed for Cursor-equivalent behavior, even if delivery is staged.

## Canonicality Requirements

All code written for this feature should be treated as product-canonical.

1. The composer popup system should have one canonical implementation for slash and `@` mention.
2. Token parsing should have one canonical source of truth.
3. Ranking and recency should have one canonical source of truth.
4. The inline highlight system should have one canonical rendering path.
5. Styling should be sourced from discovered Cursor code, not designer memory or hand-tuned approximation.
6. Documentation must preserve exact source paths back to Cursor's shipped bundle so design and product can inspect the upstream artifact directly.

## Non-Goal

This plan is not a license to approximate Cursor.

What is out of scope is only the subset of Cursor backend systems that we cannot yet support locally without new platform work.

What is in scope for this plan is the full product surface we can implement canonically now:

1. slash menu,
2. `@` file mention picker,
3. file side preview,
4. typed item model,
5. grouped ranking and recency,
6. keyboard and pointer parity,
7. inline token highlighting,
8. canonical styling sourced from Cursor's shipped code.

## What Cursor Actually Built

Cursor's slash menu is not a plain text autocomplete.

From the Cursor app bundle and local storage:

1. the menu is a unified launcher over multiple typed registries,
2. item types include at least `command`, `skill`, and `subagent`,
3. commands come from local files, team commands, global commands, and plugin commands,
4. skills are file-backed `SKILL.md` artifacts and can also come from plugin caches,
5. subagents are distinct runtime entities with background-work lifecycle,
6. recency is tracked per type and also in a global cross-type order,
7. Glass and Classic can receive different remote command payloads.

### Key Cursor Findings

1. Commands are loaded from `~/.cursor/commands`, workspace `.cursor/commands`, optional `.claude/commands`, team commands, global commands, and plugin commands.
2. Cursor stores recents under `cursor.commands.recentlyUsed`, `cursor.skills.recentlyUsed`, `cursor.subagents.recentlyUsed`, and a merged `cursor.recentlyUsed.globalOrder`.
3. Skills are first-class extensibility artifacts, not just prompt snippets.
4. Manual skill activation creates a new agent, adds the skill file as structured context, and sends a typed pending slash selection of `type: "skill"`.
5. Glass has slash-menu-specific styling and a surface-aware remote command fetch path.

## Cursor Source Of Truth

Any styling, layout, or interaction claim in this plan should point back to Cursor's shipped bundle, not memory.

### Primary Bundle Paths

1. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/package.json`
2. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.css`
3. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js`

### Local Research Anchors

1. `research-scratchpad.md`
2. `docs/cursor-glass-deep-dive.md`
3. `/Users/workgyver/Library/Application Support/CleanShot/media/media_RKuOsRH8w7/CleanShot 2026-04-04 at 15.08.31.png`

### Styling Discovery Rules

For this feature, styling must be copied from Cursor's shipped implementation as exactly as practical.

1. Use the exact selectors, variables, and declarations from `workbench.desktop.main.css` when they are discoverable.
2. When translating into Tailwind or app CSS, preserve the exact values and structure from Cursor instead of redesigning.
3. Record the original Cursor selector and file path in the plan or implementation notes whenever a visual rule is ported.
4. If a value cannot be extracted confidently, mark it as undiscovered instead of inventing a replacement.
5. Designers should be able to inspect the exact upstream source path for every major visual decision.

### Known Cursor Styling Anchors For This Feature

These are the important bundle-level names already discovered and should be treated as investigation targets during implementation.

1. `ui-slash-menu__content--glass`
2. `ui-mention-menu-side-preview--glass`
3. `ui-agent-tray__prompt-wrap`
4. `ui-prompt-input`
5. `ui-prompt-input--agent-tray-stack`
6. `glass-model-picker-wrapper`
7. `data-cursor-glass-mode`
8. `data-component="root"`
9. `--glass-sidebar-surface-background`
10. `--glass-chat-surface-background`
11. `--glass-editor-surface-background`
12. `--glass-chat-bubble-background`
13. `--glass-window-border-color`
14. `--glass-traffic-lights-spacer-width`

### Canonical Styling Requirement

Do not attempt to recreate Cursor's visual style from taste.

1. Discovery comes first.
2. Copy comes second.
3. Interpretation is only allowed where Cursor's compiled output is ambiguous.

### Designer Review Checklist

For each shipped visual surface, the implementation notes should include:

1. the original Cursor bundle path,
2. the original selector or token name,
3. the copied declaration or equivalent literal value,
4. the destination `c-glass` file path,
5. whether the rule was copied exactly or translated into Tailwind utilities.

## Current `c-glass` State

The app already has the core ingredients for a good first implementation.

### Existing Code Paths

1. `apps/web/src/components/glass/glass-pi-composer.tsx` already detects `/` and `@` tokens, fetches remote slash commands, ranks items, and inserts the selected command into the draft.
2. `apps/web/src/components/glass/glass-pi-composer-search.ts` already provides `slashMatch()`, `rank()`, and `applySlash()`.
3. `packages/contracts/src/session.ts` already defines `PiSlashCommand` with `source: "extension" | "prompt" | "skill"`.
4. `apps/web` already depends on `@base-ui/react`.
5. `apps/web/src/components/glass/glass-combobox.tsx` already wraps Base UI Combobox with Glass styling.
6. `apps/web/src/components/glass/pi-model-picker.tsx` already shows a good Base UI `Menu` usage pattern in this codebase.
7. `apps/web/src/components/ui/combobox.tsx` already provides a richer Combobox primitive wrapper if we need it later.

### Current Product Limitation

The current slash menu in `glass-pi-composer.tsx` is functionally useful, but architecturally still a lightweight inline picker.

It does not yet have:

1. a typed slash item model beyond local `Cmd`,
2. persistent recency,
3. clear sections like Cursor,
4. richer previews and metadata,
5. a dedicated floating menu component with clean ownership,
6. a future-ready registry seam for commands, skills, and subagents.

## Recommended Primitive Choice In Base UI

### Recommendation

Use `Popover` as the primary Base UI primitive for the slash menu popup in phase 1.

### Why `Popover` First

Our slash query currently lives inside the composer `textarea`, not inside a dedicated Combobox input.

That matters.

Base UI `Combobox` is excellent when it owns the text input. Cursor's slash query, and our current composer query, are embedded in a multiline editor-like draft field. For that setup:

1. `Menu` is not a good fit because the list is query-driven and not button-triggered.
2. `Combobox` is not an ideal top-level fit yet because the searchable text source is external to the Combobox input.
3. `Popover` is the correct anchor/overlay primitive for a caret-relative or composer-relative floating surface.

### Recommended Base UI Composition

Phase 1 should use:

1. `Popover.Root` with controlled `open`,
2. `Popover.Portal`,
3. `Popover.Positioner`,
4. `Popover.Popup`,
5. a custom list with app-owned active index and keyboard handling.

This gives us correct overlay semantics and leaves filtering logic in the composer where it already exists.

### Why Not Force `Combobox` Immediately

A true Base UI `Combobox` rewrite only becomes natural if we first split slash search into its own dedicated input model.

That is not how the current composer works.

Trying to force `Combobox.Input` over the textarea would create a brittle split-brain input model.

### Future Evolution

After the phase 1 popover lands, we can optionally migrate the popup internals toward Base UI `Combobox` semantics if we later:

1. make slash mode a dedicated transient input model,
2. support richer filtering and item virtualization,
3. want automatic listbox semantics from Base UI instead of app-owned roving state.

## Base UI Syntax We Should Follow

### Phase 1 Popup Skeleton

```tsx
import { Popover } from "@base-ui/react/popover";

<Popover.Root open={open} onOpenChange={setOpen}>
  <Popover.Portal>
    <Popover.Positioner side="top" align="start" sideOffset={8} anchor={anchor} className="z-50">
      <Popover.Popup className="rounded-2xl border border-glass-stroke bg-glass-bubble shadow-glass-popup backdrop-blur-xl outline-none">
        <div role="listbox" aria-label="Slash commands">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={i === active}
              data-highlighted={i === active ? "" : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(item)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </Popover.Popup>
    </Popover.Positioner>
  </Popover.Portal>
</Popover.Root>;
```

### Optional Combobox-Compatible Internal Shape Later

If we later refactor slash mode into a dedicated input model, the intended Base UI direction is:

```tsx
import { Combobox } from "@base-ui/react/combobox";

<Combobox.Root
  open={open}
  inputValue={query}
  onInputValueChange={setQuery}
  value={value}
  onValueChange={setValue}
>
  <Combobox.Portal>
    <Combobox.Positioner side="top" align="start" sideOffset={8}>
      <Combobox.Popup>
        <Combobox.List>
          {items.map((item) => (
            <Combobox.Item key={item.id} value={item.id}>
              {item.name}
            </Combobox.Item>
          ))}
          <Combobox.Empty>No results</Combobox.Empty>
        </Combobox.List>
      </Combobox.Popup>
    </Combobox.Positioner>
  </Combobox.Portal>
</Combobox.Root>;
```

For now, this should be treated as a future option, not the first implementation.

## Proposed `c-glass` Slash Architecture

### New Item Model

Introduce a local typed slash item view model for the web app.

```ts
export type GlassSlashItemKind = "command" | "skill" | "subagent" | "app";

export type GlassSlashItem = {
  id: string;
  kind: GlassSlashItemKind;
  name: string;
  description?: string;
  source: "pi" | "app" | "local";
  section: "recent" | "commands" | "skills" | "subagents" | "app";
  keyword?: string[];
  run: {
    type: "insert" | "navigate" | "open-settings" | "new-chat";
    value?: string;
  };
};
```

### Mapping Strategy

Map current sources into that shape.

1. Existing `PiSlashCommand` becomes `kind: "command"` or `kind: "skill"` based on `source`.
2. Local app commands like `/new` and `/settings` become `kind: "app"`.
3. Future project-local skills or subagents can plug into the same model.
4. Sections should be derived after ranking so we can support Cursor-style grouped rendering.

## Proposed Interaction Model

### Detection

Keep using the current inline parser in `glass-pi-composer-search.ts` as the first parser seam.

1. `slashMatch()` stays.
2. `fileMatch()` stays.
3. `applySlash()` stays.
4. `applyFile()` stays.
5. `rank()` evolves into typed ranking with recency boosts.

### Open State

The floating launcher should open when either token detector is active.

1. slash mode opens when the draft cursor is on a valid `/token`,
2. file mode opens when the draft cursor is on a valid `@token`,
3. the popup remains open only while the active token remains valid,
4. results may be empty only while loading,
5. `Escape` closes only the current token popup, not the whole composer.

### Navigation

Support:

1. `ArrowDown` and `ArrowUp` to move active item,
2. `Enter` and `Tab` to apply the active item,
3. `Escape` to close,
4. pointer hover to update active item,
5. pointer down prevention so the textarea keeps focus.

### Insertion Behavior

Phase 1 should preserve current insertion behavior.

1. selecting a slash item replaces the active `/query` token with `/name `,
2. selecting a file item replaces the active `@query` token with `@path` or `@"path with spaces"`,
3. directory selection should keep the file popup open for further drill-in,
4. the draft cursor moves to the correct insertion point after replacement,
5. settings and app actions can still short-circuit into local actions when needed.

## `@` File Mention Plan

The current composer already has a meaningful part of this behavior.

Today it already does all of the following in `apps/web/src/components/glass/glass-pi-composer.tsx`:

1. detects active `@` tokens with `fileMatch()`,
2. fetches file suggestions with `glass.shell.suggestFiles(query)`,
3. previews the active file with `glass.shell.previewFile(path)`,
4. inserts quoted or unquoted file mentions with `applyFile()`.

That means we should not rewrite mention semantics from scratch.

### Cursor-Equivalent Direction

To get much closer to Cursor, phase 1 should preserve the current backend behavior and replace the UI shell around it.

1. Reuse `fileMatch()`, `applyFile()`, and current shell preview fetching.
2. Move the mention popup into the same new floating launcher component family as slash.
3. Keep the current split layout for file mention mode, because it already maps well to Cursor's list-plus-preview behavior.
4. Improve ranking for file paths with basename-first and workspace-near boosts.
5. Add better row metadata like relative dir, file type icon, and optional repository/workspace label later.

### Base UI Recommendation For `@`

Use the same `Popover` strategy as slash.

`@` mention is also textarea-driven, not Combobox-input-driven. The popup should be another controlled `Popover.Popup` branch rendered from the same composer token state.

## Text Highlight Plan

This is the part we cannot get to Cursor parity on by only swapping the popup.

Cursor-like inline token highlighting requires a text-decoration layer above or behind the textarea.

### What We Have Today

We do not currently have a draft text mirror or token highlight layer in `glass-pi-composer.tsx`.

We only have:

1. raw textarea input,
2. token parsing for `/` and `@`,
3. floating popup rendering.

### What Exact Replication Requires

To get close to Cursor's inline composer feel, we need a mirrored text rendering layer.

Recommended phase 2 approach:

1. keep the native `textarea` for actual editing,
2. add a visually matched mirror layer behind it,
3. tokenize the draft into plain text, slash tokens, file mention tokens, and maybe selected command spans,
4. render highlighted spans in the mirror,
5. make textarea text transparent enough that the mirror styling is visible while caret and selection still work,
6. keep selection colors and IME behavior native by not replacing the editor with contenteditable yet.

### Why Not Jump To `contenteditable`

A full `contenteditable` or Lexical rewrite is the fastest path to bugs.

For a Cursor-like look with lower risk, a mirror-overlay architecture is the right middle ground.

### Highlight Scope

Phase 2 highlighting should cover:

1. active slash tokens like `/commit`,
2. inserted slash commands,
3. valid file mentions like `@src/app.tsx`,
4. quoted file mentions like `@"src/my file.tsx"`,
5. optional invalid-token styling later.

## Recency Plan

Cursor stores recent slash usage by type. We should do the same in a smaller first-pass form.

### Local Storage Keys

Add local keys in the web app:

1. `glass.slash.recent.commands`
2. `glass.slash.recent.skills`
3. `glass.slash.recent.subagents`
4. `glass.slash.recent.global`

### Behavior

1. store the last 5 items per type,
2. store the last 15 items globally,
3. boost recent items in ranking,
4. render a `Recent` section only when the query is empty or shallow.

## UI Plan

### Menu Layout

Copy the Cursor menu layout from shipped source, not by visual approximation.

1. extract the exact popup shell rules from Cursor's CSS before implementation,
2. extract the exact row spacing, radius, border, blur, and shadow treatment,
3. preserve Cursor's left icon lane, label line, description line, and trailing affordance structure,
4. preserve section spacing and separator behavior,
5. preserve no-layout-shift row states,
6. store the original Cursor selector and file path for each major visual rule.

### Row Taxonomy

Use distinct visual markers for each kind.

1. `command`: lightning or action icon,
2. `skill`: sparkles or star-like icon,
3. `subagent`: branch/agent icon,
4. `app`: local app glyph.

All icons must come from `central-icons`.

The icon mapping can be local, but spacing, container shape, and row emphasis should still follow Cursor's discovered layout exactly.

### Animation

Animation should be copied from Cursor's shipped behavior when discoverable.

1. prefer exact copied transition properties and durations from Cursor CSS when available,
2. if the bundle only exposes the resulting values and not semantic names, port those literal values,
3. do not invent spring motion,
4. honor reduced motion.

### Styling Porting Rule

Every major visual surface in this feature should have a traceable upstream reference.

1. popup container,
2. mention preview pane,
3. slash rows,
4. mention rows,
5. active row state,
6. section labels,
7. composer token highlight colors,
8. input shell and borders.

If the Cursor source for a visual rule is not yet extracted, implementation should mark it as pending discovery instead of silently approximating.

## File Plan

### New Files

1. `apps/web/src/components/glass/glass-slash-menu.tsx`
2. `apps/web/src/components/glass/glass-slash-registry.ts`
3. `apps/web/src/components/glass/glass-slash-recents.ts`

### Touched Files

1. `apps/web/src/components/glass/glass-pi-composer.tsx`
2. `apps/web/src/components/glass/glass-pi-composer-search.ts`

### Responsibilities

`glass-slash-registry.ts`

1. merge local app commands and remote Pi slash commands,
2. normalize them into `GlassSlashItem[]`,
3. assign kind and section metadata.

`glass-slash-recents.ts`

1. read and write local recents,
2. expose a ranking boost helper.

`glass-slash-menu.tsx`

1. render the popup,
2. own section rendering,
3. own pointer interactions,
4. stay stateless about draft parsing.

`glass-pi-composer.tsx`

1. keep textarea ownership,
2. keep slash detection,
3. keep async loading,
4. pass normalized items to the popup,
5. apply selection back into the draft.

## Section Strategy

Cursor's menu feels ordered, not flat.

Recommended phase 1 sections:

1. `Recent`
2. `Commands`
3. `Skills`
4. `App`

Do not add `Subagents` until we actually have a local source for them.

The model should support them now, but the UI should not render empty future sections.

## Ranking Strategy

Keep the existing simple matcher and layer on small typed boosts.

### Base Score

Keep current rules from `rank()`:

1. exact match,
2. prefix match,
3. substring match,
4. ordered character sequence fallback.

### Boosts

Add small boosts for:

1. recent global hit,
2. exact section-kind preference,
3. shorter names,
4. local app commands for exact matches.

Do not overfit ranking in phase 1.

## Execution Strategy

### Phase 1

Build the canonical popup and registry system with current backend capabilities.

1. typed normalized items,
2. one proper popup component for slash and `@`,
3. recency,
4. grouped rendering,
5. polished keyboard and pointer behavior,
6. no contract changes,
7. exact styling sourced from Cursor bundle references.

### Phase 2

Add the rest of the canonical composer parity that requires a deeper editor shell.

1. textarea mirror layer,
2. inline token highlighting,
3. exact mention token visuals,
4. exact slash token visuals,
5. selection-safe overlay behavior.

### Phase 3

Add remaining registry breadth and advanced parity.

1. project-local slash command files,
2. first-class local skills if we want parity with Cursor-style `SKILL.md` discovery,
3. subagent registry,
4. richer metadata,
5. shortcut hints,
6. argument hints,
7. command provenance badges.

## Why This Plan Fits `c-glass`

This plan matches the current repo instead of fighting it.

1. It keeps the multiline composer as the source of truth.
2. It uses Base UI where Base UI is strongest here: overlay positioning and semantics.
3. It keeps the current slash parser and insertion flow.
4. It creates a clean registry seam that can later grow toward Cursor's multi-source architecture.
5. It avoids forcing a fake Combobox input over a textarea-driven query.

## Acceptance Criteria

The first implementation should satisfy all of these.

1. Typing `/` in the composer opens a polished floating menu.
2. Typing `/com` ranks `commit`-like items naturally.
3. Arrow keys move selection without losing textarea focus.
4. Enter applies the highlighted item and leaves a trailing space.
5. Mouse interaction works without collapsing focus or selection state.
6. The menu has sections and recency.
7. The implementation uses Base UI `Popover` cleanly.
8. The code does not add a second competing input model.

## Recommended First Build Order

1. Extract slash item normalization into `glass-slash-registry.ts`.
2. Add local recency storage and ranking boosts.
3. Build `glass-slash-menu.tsx` on Base UI `Popover`.
4. Replace the inline popup rendering in `glass-pi-composer.tsx` with the new component.
5. Polish row visuals and motion.
6. Verify keyboard, pointer, and reduced-motion behavior.

## Notes For The Actual Implementation Pass

1. Reuse existing `rank()`, `slashMatch()`, and `applySlash()` logic instead of rewriting parsing.
2. Reuse the visual vocabulary from `pi-model-picker.tsx` for surface, border, blur, and z-index behavior.
3. Prefer keeping the new item model local to `apps/web` unless phase 2 requires contract changes.
4. Do not introduce `lucide-react` icons in new code.
5. Use `Popover`, not `Menu`, for phase 1.
6. Only move to `Combobox` if we later split slash mode into a dedicated input state.
