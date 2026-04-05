# Glass Slash Menu Plan

## Goal

Build a polished, typed slash and `@` mention launcher for `c-glass` that feels intentional and fast in the current Glass composer.

The result should be canonical for Glass, not a Cursor compatibility layer.

## Product Position

Cursor is useful as a UX reference, not as a source model.

We can borrow interaction ideas that are clearly good:

1. one unified launcher surface,
2. grouped results,
3. strong keyboard and pointer behavior,
4. recency-aware ranking,
5. file-side preview for `@` mentions,
6. inline token highlighting when the editor shell is ready.

We should not inherit Cursor-specific storage, filesystem conventions, or backend assumptions.

## Why The Earlier Plan Was Wrong

The previous version of this plan pushed too hard toward Cursor parity and `.cursor/*` compatibility.

That is exactly the kind of lock-in we do not want.

Problems with that direction:

1. it treated Cursor bundle CSS as the canonical visual source,
2. it treated Cursor local storage and command registries as architectural targets,
3. it implied future support for `.cursor/commands`, `.claude/commands`, and related command-file ecosystems,
4. it blurred the line between inspiration and product ownership,
5. it made unimplemented work look blocked by missing Cursor parity instead of normal product prioritization.

## Explicit Non-Goals

This feature should not introduce Cursor lock-in.

That means:

1. do not read from `~/.cursor/*`, workspace `.cursor/*`, or `.claude/*`,
2. do not model Glass command discovery around Cursor command-file formats,
3. do not require exact copied CSS, selectors, or tokens from Cursor bundles,
4. do not add remote payload shapes just because Cursor has them,
5. do not create placeholder support for team commands, plugin commands, or Cursor-style subagents unless Glass or Pi actually owns those concepts,
6. do not block shipping on exact visual parity with Cursor.

## Canonicality Requirements

The implementation still needs to be canonical.

1. The composer popup system should have one canonical implementation for slash and `@` mention.
2. Token parsing should have one canonical source of truth.
3. Ranking and recency should have one canonical source of truth.
4. Inline token highlighting should have one canonical rendering path when we ship it.
5. Styling should come from Glass design language and local primitives, not copied foreign product internals.
6. New sources should only be added when they are native to Glass or Pi.

## Current Glass State

The app already has the important building blocks.

1. `apps/web/src/components/glass/glass-pi-composer.tsx` already detects `/` and `@` tokens and applies selections back into the draft.
2. `apps/web/src/components/glass/glass-pi-composer-search.ts` already owns token parsing and insertion helpers.
3. `packages/contracts/src/session.ts` already exposes Pi slash commands.
4. `glass.shell.suggestFiles()` and `glass.shell.previewFile()` already support `@` mention search and preview.
5. `apps/web` already uses Base UI and has established Glass popup patterns.

## Implementation Status

What is already in the tree:

1. one shared popup family for slash and `@` mention in `apps/web/src/components/glass/glass-slash-menu.tsx`,
2. typed slash item normalization and grouped rows in `apps/web/src/components/glass/glass-slash-registry.ts`,
3. local recency storage and ranking boosts in `apps/web/src/components/glass/glass-slash-recents.ts`,
4. keyboard and pointer selection that keeps textarea ownership in `apps/web/src/components/glass/glass-pi-composer.tsx`,
5. `@` mention results plus side preview backed by `glass.shell.suggestFiles()` and `glass.shell.previewFile()`,
6. a first mirror-layer highlight pass for slash tokens and file mentions in `apps/web/src/components/glass/glass-pi-composer-search.ts` and `apps/web/src/components/glass/glass-pi-composer.tsx`.

What is not shipped yet:

1. project-local slash command discovery under a Glass-owned workspace namespace,
2. first-class local skill discovery outside the current Pi session command list,
3. a real subagent registry or runtime-backed slash source,
4. shortcut hints,
5. argument hints,
6. provenance badges.

## Current Limitation

The old inline picker was useful but not a good long-term shape.

The work that remained was not blocked because we needed more Cursor parity.
It remained because we only want to ship the parts that fit Glass cleanly.

## Source Model

The source model should stay Glass-native.

Phase 1 sources:

1. Pi slash commands from the current session,
2. local app actions like `/new` and `/settings`,
3. shell file suggestions for `@` mention.

Possible later sources, only if they become native to Glass or Pi:

1. Pi-provided skills,
2. Pi-provided agents or subagents,
3. workspace-local Glass config under a Glass-owned namespace such as `.pi/*` if we actually decide to support that.

Not planned:

1. `.cursor/commands`,
2. `.claude/commands`,
3. team-command sync modeled after Cursor,
4. plugin command caches copied from another product.

## Primitive Choice

Use `Popover` as the popup primitive for slash and `@` mention.

Why:

1. the query lives inside the multiline composer textarea,
2. `Menu` is too button-oriented,
3. `Combobox` is not the right top-level owner while the textarea remains the input source,
4. `Popover` gives us the right overlay mechanics without creating a second input model.

## Architecture

### Typed Item Model

Keep a local item model in `apps/web`.

```ts
export type GlassSlashItemKind = "command" | "skill" | "subagent" | "app";

export type GlassSlashItem = {
  id: string;
  kind: GlassSlashItemKind;
  name: string;
  description?: string;
  source: "pi" | "app" | "local";
  section: "recent" | "commands" | "skills" | "subagents" | "app";
  run: {
    type: "insert" | "navigate" | "open-settings" | "new-chat";
    value?: string;
  };
};
```

This model is about Glass UI behavior, not about mirroring any external product.

### Ownership

`glass-pi-composer-search.ts`

1. token parsing,
2. insertion helpers,
3. search ranking primitives.

`glass-slash-registry.ts`

1. normalize app and Pi items,
2. assign kind and section metadata,
3. build grouped rows for rendering.

`glass-slash-recents.ts`

1. read and write local recents,
2. expose small ranking boosts.

`glass-slash-menu.tsx`

1. render the popup surface,
2. render sections,
3. own pointer interactions,
4. stay stateless about draft parsing.

`glass-pi-composer.tsx`

1. keep textarea ownership,
2. keep async loading,
3. keep keyboard handling,
4. pass normalized items to the popup,
5. apply selection back into the draft.

## Interaction Model

### Detection

Keep the current parser seam.

1. `slashMatch()` stays,
2. `fileMatch()` stays,
3. `applySlash()` stays,
4. `applyFile()` stays,
5. ranking grows from the current matcher instead of replacing it.

### Open State

1. slash mode opens when the cursor is on a valid `/token`,
2. file mode opens when the cursor is on a valid `@token`,
3. the popup stays open only while the active token remains valid,
4. `Escape` closes only the token popup,
5. loading state is allowed, empty idle state is allowed only when the token is valid and the result set is empty.

### Navigation

1. `ArrowDown` and `ArrowUp` move the active row,
2. `Enter` and `Tab` apply the active row,
3. pointer hover updates the active row,
4. pointer down should not steal textarea focus,
5. selection should not collapse unexpectedly.

### Insertion

1. slash selection replaces the active `/query` token with `/name `,
2. file selection replaces the active `@query` token with `@path` or `@"path with spaces"`,
3. directory selection can keep the file popup open for drill-in,
4. app actions can short-circuit into local behavior when appropriate.

## Recency

Recency is useful and Glass-owned. Keep it local.

Suggested keys:

1. `glass.slash.recent.commands`,
2. `glass.slash.recent.skills`,
3. `glass.slash.recent.subagents`,
4. `glass.slash.recent.global`.

Suggested behavior:

1. keep the last 5 items per type,
2. keep the last 15 items globally,
3. boost recent items modestly,
4. show `Recent` only for shallow queries.

## Section Strategy

Recommended sections for the first complete build:

1. `Recent`,
2. `Commands`,
3. `Skills`,
4. `App`.

Do not render `Subagents` until Glass or Pi has a real source for them.
The type can support future kinds without the UI pretending they exist.

## `@` Mention Plan

The mention backend behavior is already good enough to keep.

Phase 1 should:

1. reuse `fileMatch()` and `applyFile()`,
2. reuse `glass.shell.suggestFiles()` and `glass.shell.previewFile()`,
3. move mention rendering into the same popup family as slash,
4. preserve the list-plus-preview layout,
5. improve ranking and row metadata only where clearly useful.

## Inline Highlight Plan

Inline token highlighting is already in the tree in first-pass form, and it is not a reason to block the popup architecture.

Follow-up work should stay on the mirror layer behind the textarea.

Why:

1. it preserves native textarea behavior,
2. it avoids jumping to `contenteditable`,
3. it keeps one real editing surface.

Scope for the first highlight pass:

1. active slash tokens,
2. inserted slash commands,
3. valid file mentions,
4. quoted file mentions.

## Styling Guidance

This should be Glass-native.

Use existing Glass visual language:

1. Glass surface tokens,
2. Glass border and blur treatment,
3. existing popup shadows,
4. existing row highlight patterns,
5. existing spacing and typography conventions where they already feel right.

Cursor can still be used as a reference for:

1. overall information density,
2. row composition,
3. section ordering,
4. preview-pane usefulness.

But we should not require exact selector, token, or bundle-level provenance to ship.

## Execution Strategy

### Phase 1

Ship the canonical popup architecture.

1. typed normalized items,
2. one popup component for slash and `@`,
3. grouped rendering,
4. recency,
5. reliable keyboard and pointer behavior,
6. no second input model,
7. Glass-native styling.

Status: done.

### Phase 2

Ship editor-shell improvements.

1. textarea mirror layer,
2. inline token highlighting,
3. selection-safe overlay behavior.

Status: partly done. The mirror layer and first highlight pass are in place; selection-safe polish can keep iterating without reopening the architecture.

### Phase 3

Add more sources only if they are truly ours.

1. richer metadata,
2. shortcut hints,
3. argument hints,
4. provenance badges,
5. additional Glass-owned or Pi-owned registries.

If workspace-local commands ever happen, they should live under a Glass- or Pi-owned convention, not `.cursor/*`.

Status: not started beyond the current Pi session command source.

## Acceptance Criteria

The first complete implementation should satisfy all of these.

1. Typing `/` opens a polished floating menu.
2. Typing `/com` ranks likely command matches naturally.
3. Arrow keys move selection without losing textarea focus.
4. `Enter` applies the highlighted item and leaves a trailing space.
5. Mouse interaction works without collapsing focus or selection state.
6. The menu has sections and recency.
7. The implementation uses Base UI `Popover` cleanly.
8. The code does not add a second competing input model.
9. The implementation does not read or depend on `.cursor/*` or `.claude/*`.

## Recommended Build Order

1. Extract slash normalization into `glass-slash-registry.ts`.
2. Add recency storage and ranking boosts.
3. Build `glass-slash-menu.tsx` on Base UI `Popover`.
4. Replace inline popup rendering in `glass-pi-composer.tsx`.
5. Polish row visuals and reduced-motion behavior.
6. Add mirror-layer highlighting when the popup path is stable.

## Notes For Implementation

1. Reuse existing parser and insertion helpers instead of rewriting them.
2. Keep the new item model local to `apps/web` unless a real contract need appears.
3. Use `Popover`, not `Menu`, for the slash and mention launcher.
4. Use `central-icons` only.
5. Prefer Glass-native conventions over source-compatible parity with another app.
