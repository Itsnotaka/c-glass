# Pi Canonical Boot State Plan

## Goal

Boot-critical Pi UI must not show fake product states while config or session data is still loading.

That means:

- The model picker must not show `Select model` during boot.
- The thread rail must not show an empty-state message during boot.
- Leaf components should read Pi state from one canonical client owner instead of treating missing data as a real value.

## Architecture

The source of truth should be a single root Pi boot store in the renderer.

- Preload stays thin and exposes functions only.
- The desktop bridge provides boot reads plus refresh events.
- The root store owns Pi config, session summaries, and readiness.
- Leaf hooks become selectors and derivations.
- Leaf components do not fetch boot-critical Pi data on mount.

TanStack Query can still exist elsewhere in the app, but it should not be the primary ownership model for Pi boot state.

## Store Shape

The root store should own:

- `cfg`: latest Pi config snapshot.
- `sums`: latest session summary snapshot.
- `cfgStatus`: `loading | ready | error`.
- `sumsStatus`: `loading | ready | error`.
- `cfgReady` and `sumsReady`.
- `ready`: true only when both slices are ready.

Required actions:

- `boot()`.
- `refreshCfg()`.
- `refreshSums()`.
- `resetForWorkspaceChange()`.
- `applySummaryEvent()`.

Required selectors:

- `usePiBootReady()`.
- `usePiCfg()`.
- `usePiSums()`.
- `usePiCfgStatus()`.
- `usePiSumsStatus()`.

## Boot Flow

On app startup:

1. Create the store with explicit loading state.
2. Hydrate from bridge boot reads if they are available.
3. Trigger one root boot action from the app shell or root route.
4. Fetch Pi config and session summaries from the bridge.
5. Write results into the store and mark each slice ready.

During boot:

- The composer stays visible.
- The model picker renders a loading shell.
- The thread rail renders a loading shell.
- No fallback copy should look like a real empty or unset state.

## Refresh Flow

When Pi settings change:

- Desktop emits a boot refresh event.
- The root store refetches Pi config.
- Leaf components re-render from store state.

When the workspace changes:

- Desktop emits a shell-change event.
- The root store resets affected slices to `loading`.
- The root store refetches config and summaries for the new workspace.
- The UI shows loading shells during the transition.

When session summaries change:

- Live summary events patch the summary slice directly.
- Full refetch is still allowed for workspace changes or recovery.

## Hook Rules

Allowed:

- Derive visible models from config.
- Derive the resolved default model and thinking level.
- Derive grouped thread sections.
- Subscribe to store state.

Disallowed:

- `usePiModels()` fetching on mount.
- `usePiDefaults()` fetching on mount.
- `usePiSession(null)` fetching the default model on mount.
- `useGlassAgents()` fetching summaries on mount.

## Rendering Rules

Model picker:

- While config is loading, render a shell.
- Do not show `Select model`.
- Do not show `No Pi models available yet.` until config is ready and that state is real.

Settings defaults UI:

- While config is loading, render a shell.
- Do not render an unset default state during boot.

Thread rail:

- While summaries are loading, render a shell.
- Do not show `No threads yet. Create a new agent to begin.` until summaries are ready and the list is truly empty.

## Implementation Checklist

### Desktop

- [ ] Keep preload as a supported CJS preload.
- [ ] Remove preload-owned mutable boot state as a canonical source of truth.
- [ ] Keep bridge refresh events for Pi and workspace changes.
- [ ] Expose stable bridge functions for config reads and summary reads.

### Web Boot State

- [ ] Add a dedicated root Pi boot store.
- [ ] Add explicit status and readiness for config and summaries.
- [ ] Boot that store exactly once at app startup.
- [ ] Refresh that store on Pi setting changes.
- [ ] Refresh that store on workspace changes.
- [ ] Patch summary updates from the live summary event stream.

### Hook Cleanup

- [ ] Convert `usePiModels()` into a selector-based hook.
- [ ] Convert `usePiDefaults()` into a selector-based hook.
- [ ] Convert `usePiSession(null)` default-model resolution into selector-based state.
- [ ] Convert `useGlassAgents()` into a selector-based hook.
- [ ] Remove component-local boot fetching for Pi config and session summaries.

### UI Gating

- [ ] Add a model picker loading shell.
- [ ] Add a settings defaults loading shell.
- [ ] Add a thread rail loading shell.
- [ ] Ensure true empty states render only after readiness is known.

### Verification

- [ ] Launch Electron with no warm Pi state and confirm the model picker never shows `Select model` during boot.
- [ ] Launch Electron with no sessions and confirm the thread rail never shows the empty-state copy until summaries are ready.
- [ ] Change the default Pi model and confirm the picker updates from root state.
- [ ] Change workspace and confirm config and summaries transition through loading shells, not placeholders.
- [ ] Confirm no leaf component fetches Pi boot state on mount.
- [ ] Pass `pnpm run fmt`, `pnpm run lint`, and `pnpm run typecheck`.

## Definition Of Done

This work is done when all of the following are true:

- [ ] Preload is thin and Electron-compatible.
- [ ] Pi config has one canonical client owner.
- [ ] Session summaries have one canonical client owner.
- [ ] Leaf Pi hooks are selectors, not boot fetchers.
- [ ] The model picker never shows `Select model` during boot.
- [ ] The thread rail never shows a fake empty state during boot.
- [ ] True empty states only appear after readiness is known.
- [ ] Workspace and Pi setting refreshes preserve that invariant.
