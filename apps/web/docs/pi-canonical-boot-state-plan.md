# Pi Canonical Boot State Plan

This document is the canonical plan for Pi config, defaults, thinking level, and session summary boot behavior in Glass.

It is not a stopgap to hide placeholders.

It is the intended architecture for the unreleased app.

The goal is simple: Pi-related UI must never render fallback copy such as `Select model` or `No threads yet` merely because boot data is still loading.

## Product Requirement

The user must never see a fake fallback state while Glass is still discovering Pi config or session summaries.

The Pi model picker must not render placeholder text during boot.

The thread rail must not render an empty-state message during boot.

Pi config and session summary values must not be treated as `undefined` by leaf components.

## Canonical Answer

The canonical answer is not preload-owned mutable state.

The canonical answer is not component-local fetching in many hooks.

The canonical answer is not TanStack Query as the primary state model.

The canonical answer is a single root boot state hydrated once from the desktop bridge and refreshed from bridge events.

## Non-Goals

This plan does not use preload as a long-lived state container.

This plan does not require top-level await in preload.

This plan does not require TanStack Query for Pi config or session summaries.

This plan does not allow leaf components to fetch their own boot-critical data on mount.

## Why Not TanStack Query

TanStack Query is useful for generic async cache management.

That is not the primary problem here.

The real problem is that multiple components currently fetch boot-critical state independently and temporarily treat missing data as a real product state.

Using TanStack Query would still require one of the following:

1. Initial data hydration.
2. Route or component gating.
3. Explicit loading UI that prevents placeholder rendering.

Because Pi config and session summaries are desktop bridge state with live event updates, they fit better as app boot state synchronized from an external source than as generic query-owned server state.

A root store gives a stricter guarantee: the UI reads a value plus readiness, not `undefined`.

## Canonical Ownership

### Preload

Preload remains thin.

Preload exposes functions only.

Preload does not own mutable boot caches.

Preload does not try to update copied `contextBridge` data after exposure.

### Desktop Bridge

The bridge exposes the minimum function surface needed by the renderer.

The bridge provides synchronous access only when absolutely required for desktop boot shape.

The bridge provides event subscriptions for refreshes.

The bridge does not become a second application store.

### Root Client State

A single root Pi boot store owns:

1. `cfg`: the latest Pi config snapshot.
2. `sums`: the latest session summary snapshot.
3. `cfgReady`: whether Pi config has completed initial boot load.
4. `sumsReady`: whether session summaries have completed initial boot load.
5. `ready`: whether boot-critical Pi UI state is ready for rendering.

Leaf components consume selectors from this store.

Leaf components do not fetch Pi boot data directly.

## Canonical Data Model

The root store must distinguish these states explicitly.

### Pi Config State

Pi config state is one of:

1. `loading`
2. `ready`
3. `error`

`loading` means the UI must render a neutral loading affordance, not fallback copy.

`ready` means the UI can resolve defaults, model list, and thinking level from real data.

`error` means the UI may render an explicit failure state, but only after boot has actually failed.

### Session Summary State

Session summary state is one of:

1. `loading`
2. `ready`
3. `error`

`loading` means the thread rail renders a skeleton or reserved layout, not `No threads yet`.

`ready` means the rail may render either real sessions or a true empty state.

`error` means the rail may render a real failure message if needed.

## Canonical Boot Flow

### App Startup

The renderer creates the root store with explicit loading state.

The app shell or root route triggers one boot action.

That boot action requests Pi config and session summaries from the bridge.

The boot action writes both results into the root store.

The boot action then marks the relevant readiness flags.

Leaf UI renders from the store only.

### During Boot

The model picker renders a loading shell.

The thread rail renders a loading shell.

The hero composer remains visible.

The chat shell remains visually stable.

No component renders placeholder text that could be mistaken for a real empty or unset value.

### After Boot

The model picker resolves the actual default model from real config.

The settings screen resolves the actual saved default model and thinking level.

The thread rail renders either real summaries or a true empty state.

At this point only real empty states are allowed.

## Canonical Refresh Flow

### Pi Settings Changes

When Pi settings change, the desktop layer emits a refresh event.

The root boot store handles that event.

The root boot store refetches Pi config.

Leaf components re-render from the updated store.

Leaf components do not subscribe individually to bridge refresh events for fetching.

### Workspace Changes

When the workspace changes, the desktop layer emits a shell-change event.

The root boot store refetches Pi config and session summaries for the new workspace context.

The root store resets readiness to loading for the affected slices during the transition.

The UI shows loading shells during the transition, not stale placeholder copy.

### Session Summary Changes

Live summary events patch the session summary slice directly.

The session summary slice remains the canonical client truth for the thread rail.

A full refetch may still be used on workspace changes or recovery, but not as the primary live-sync mechanism.

## Canonical Hook Model

Hooks become selectors and derivations.

### Allowed Hook Behavior

Hooks may derive:

1. visible Pi models
2. resolved default model
3. resolved default thinking level
4. grouped thread rail sections

Hooks may subscribe to store state.

Hooks may not perform boot fetching themselves.

### Disallowed Hook Behavior

`usePiModels()` must not call bridge fetches on mount.

`usePiDefaults()` must not call bridge fetches on mount.

`usePiSession(null)` must not fetch default model on mount.

`useGlassAgents()` must not fetch summaries on mount.

Those behaviors belong to the root boot coordinator.

## Canonical Rendering Rules

### Model Picker

Before Pi config is ready, the picker renders a loading shell.

It does not render `Select model`.

It does not render `No Pi models available yet.`

Those messages are only allowed after config is ready and the resolved state truly demands them.

### Settings Defaults UI

Before Pi config is ready, the settings defaults control renders a loading shell.

It does not render an unset default state.

### Thread Rail

Before session summaries are ready, the thread rail renders a loading shell.

It does not render `No threads yet. Create a new agent to begin.`

That message is only allowed after summaries are ready and the session list is truly empty.

## Root Boot Store Requirements

The root store must provide a small, explicit API.

### Required Actions

1. `boot()` loads Pi config and session summaries.
2. `refreshCfg()` reloads Pi config.
3. `refreshSums()` reloads session summaries.
4. `resetForWorkspaceChange()` transitions the affected slices back to loading.
5. `applySummaryEvent()` patches summary upsert and remove events.

### Required Selectors

1. `usePiBootReady()`
2. `usePiCfg()`
3. `usePiSums()`
4. `usePiCfgStatus()`
5. `usePiSumsStatus()`

## Error Handling Model

Boot failures must be explicit.

If Pi config fails to load, the UI may show a Pi-specific failure state.

If session summaries fail to load, the thread rail may show a summary-specific failure state.

A failure state is a real state.

A placeholder is not.

## Canonical Implementation Work

### Desktop

- [ ] Keep preload as a supported CJS preload.
- [ ] Remove preload-owned mutable boot state as the canonical source of truth.
- [ ] Keep bridge refresh events for Pi and workspace changes.
- [ ] Ensure the bridge exposes stable functions for config reads and summary reads.

### Web Boot State

- [ ] Add a dedicated root Pi boot store.
- [ ] Add explicit ready and loading flags for config and summaries.
- [ ] Boot that store exactly once at app startup.
- [ ] Refresh that store on Pi settings changes.
- [ ] Refresh that store on workspace changes.
- [ ] Patch summary updates from the existing live summary event stream.

### Hook Cleanup

- [ ] Convert `usePiModels()` into a selector-based hook.
- [ ] Convert `usePiDefaults()` into a selector-based hook.
- [ ] Convert `usePiSession(null)` default-model resolution into selector-based state.
- [ ] Convert `useGlassAgents()` into a selector-based hook.
- [ ] Remove component-local boot fetching for Pi config and session summaries.

### UI Gating

- [ ] Add model picker loading shell.
- [ ] Add settings Pi defaults loading shell.
- [ ] Add thread rail loading shell.
- [ ] Ensure true empty states render only after readiness is reached.

### Verification

- [ ] Launch Electron with no warm Pi state and confirm the model picker never shows `Select model` during boot.
- [ ] Launch Electron with no sessions and confirm the thread rail never shows the empty-state copy until summaries are ready.
- [ ] Change Pi default model and confirm the root boot state refreshes and the picker updates.
- [ ] Change workspace and confirm config and summaries transition through loading shells, not placeholders.
- [ ] Confirm no leaf component fetches Pi boot state on mount.
- [ ] Pass `pnpm run fmt`, `pnpm run lint`, and `pnpm run typecheck`.

## Definition Of Done

This work is done only when all of the following are true.

- [ ] Preload is thin and supported by Electron without ESM preload tricks.
- [ ] Pi config has one canonical client owner.
- [ ] Session summaries have one canonical client owner.
- [ ] Leaf Pi hooks are selectors, not boot fetchers.
- [ ] The model picker never shows `Select model` during boot.
- [ ] The thread rail never shows a fake empty state during boot.
- [ ] True empty states only appear after readiness is known.
- [ ] Workspace and Pi setting refreshes preserve that invariant.
