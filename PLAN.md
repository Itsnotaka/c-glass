# Cursor Glass Recreation Plan

## Goal

Recreate the Cursor Glass desktop experience on top of an Electron shell and an existing agent harness, using `pingdotgg/t3code` as the architectural base.

This plan is intentionally biased toward preserving the runtime harness and replacing only the shell and structure.

## Core Decision

Use `t3code` as the base and keep these layers:

1. `apps/desktop` as the Electron host.
2. `apps/server` as the backend harness and orchestration boundary.
3. `apps/web` as the renderer UI, but rewrite the shell to match Cursor Glass.
4. `packages/contracts` and `packages/shared` as the stable cross-process boundary.

Do not start from a blank Electron app unless you are deliberately choosing to rebuild subprocess boot, preload security, WebSocket transport, updater flow, release pipeline, and signing from scratch.

Do not build an agent loop in the renderer. The renderer should create/select agents, dispatch orchestration commands, and render orchestration state. The backend harness should continue to own provider sessions, turn lifecycle, recovery, and event fan-out.

## Pi monorepo ([badlogic/pi-mono](https://github.com/badlogic/pi-mono))

The **Glass empty canvas** is wired to **published pi packages only** (no local mock chat). It mounts `@mariozechner/pi-web-ui` `ChatPanel` with `@mariozechner/pi-agent-core` `Agent` and `@mariozechner/pi-ai` `getModel`, IndexedDB stores, and `ApiKeyPromptDialog` for provider keys. Implementation: `apps/web/src/components/glass/glass-chat-session.tsx`; styles: import `@mariozechner/pi-web-ui/app.css` in `apps/web/src/main.tsx`.

**Local reference clone** (optional; gitignored at `.pi-mono-reference/`; clone with `git clone https://github.com/badlogic/pi-mono.git .pi-mono-reference` from the repo root):

| Document                                                  | Path (relative to repo root)                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| Root overview, install, `npm run build` / `npm run check` | `.pi-mono-reference/README.md`                                           |
| Coding agent CLI + SDK entry                              | `.pi-mono-reference/packages/coding-agent/README.md`                     |
| Programmatic SDK                                          | `.pi-mono-reference/packages/coding-agent/docs/sdk.md`                   |
| RPC mode (stdio JSON)                                     | `.pi-mono-reference/packages/coding-agent/docs/rpc.md`                   |
| Browser ChatPanel + storage                               | `.pi-mono-reference/packages/web-ui/README.md`                           |
| Web UI example app                                        | `.pi-mono-reference/packages/web-ui/example/README.md`                   |
| SDK runnable samples                                      | `.pi-mono-reference/packages/coding-agent/examples/sdk/README.md`        |
| Extensions catalog                                        | `.pi-mono-reference/packages/coding-agent/examples/extensions/README.md` |
| Agent core API                                            | `.pi-mono-reference/packages/agent/README.md`                            |
| Unified LLM API                                           | `.pi-mono-reference/packages/ai/README.md`                               |

**Note:** The **Glass chat** uses **pi-mono runtime packages** in the renderer (`@mariozechner/pi-agent-core` `Agent`, `@mariozechner/pi-ai` `getModel`, IndexedDB session storage from `@mariozechner/pi-web-ui` data layer only). **UI** is **Glass React components** (`glass-pi-messages.tsx`, `glass-pi-composer.tsx`, etc.); treat [`badlogic/pi-mono`](https://github.com/badlogic/pi-mono) `packages/web-ui` as a **reference** for wiring and transport, not as embedded Lit UI. The legacy **t3 Codex harness** (`ChatView`, `thread.*` WebSocket orchestration) is not used for the Glass shell path.

## Non-Goals

1. Do not recreate Cursor's full VS Code workbench.
2. Do not copy Cursor's private update backend.
3. Do not rebuild provider protocol logic or invent a second orchestration layer.
4. Do not aim for feature parity with Cursor's internal menus, invite flows, login flows, or marketplace implementation in the first milestone.
5. Do not overfit to decompiled Cursor code. Use it only as a product-reference source.

## Product Target From Screenshot

The screenshot at `/Users/workgyver/Library/Application Support/CleanShot/media/media_KkN8S8T8M9/CleanShot 2026-03-31 at 13.06.26.png` indicates the first milestone should recreate this shell shape:

1. Left sidebar with `New Agent` and `Marketplace`.
2. Grouped agent list below the top actions.
3. Large quiet center canvas when no agent is selected.
4. Centered primary composer card.
5. Two quick actions below the composer, similar to `Plan New Idea` and `Open Editor Window`.
6. Desktop-native titlebar treatment on macOS.
7. Minimal chrome, lots of whitespace, no obvious browser-app framing.

## Why `t3code` Is The Right Base

The `t3code` clone at `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps` already has the separation we want.

### Existing Monorepo Structure

Inspect these first:

1. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/package.json`
2. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/AGENTS.md`
3. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/desktop/package.json`
4. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/server`
5. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web`
6. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/packages/contracts`
7. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/packages/shared`

### Why Not A Fresh Electron Init

A fresh Electron init would force you to rebuild:

1. Secure preload and IPC design.
2. Child-process backend boot and restart handling.
3. WebSocket transport and request routing.
4. Shared contracts between desktop, server, and web.
5. Packaging and update metadata generation.
6. Multi-platform release assets and signing.
7. Auto-update state machine and user-facing update flow.

`t3code` already solves enough of this that the shell rewrite becomes the dominant task, which is exactly what we want.

## What To Keep From `t3code`

Keep these files and directories when forming the new repo base:

```text
package.json
bun.lock
turbo.json
tsconfig.base.json
AGENTS.md

apps/desktop/**
apps/server/**
apps/web/**
packages/contracts/**
packages/shared/**

scripts/build-desktop-artifact.ts
scripts/merge-mac-update-manifests.ts
scripts/update-release-package-versions.ts

.github/workflows/release.yml
docs/release.md
```

If you strip the repo down, strip it down to this set first, not just Electron files.

## What To Drop Early

These can be removed once the copied base is stable:

1. `apps/marketing/**`
2. marketing-related scripts and assets
3. npm CLI release publishing if this project is desktop-only
4. documentation unrelated to desktop packaging or orchestration

Do not immediately mass-delete `apps/web/src/components/*` until the new Glass shell compiles. Replace old UI incrementally.

## Critical Existing Runtime Boundaries In `t3code`

### Electron Host

Read these files first:

1. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/desktop/src/main.ts#L839-L1049`
2. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/desktop/src/main.ts#L1294-L1423`
3. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/desktop/src/preload.ts#L1-L53`

What they already do:

1. Configure `electron-updater`.
2. Spawn the backend as a child process with `ELECTRON_RUN_AS_NODE=1`.
3. Pass bootstrap config through fd `3`.
4. Create the `BrowserWindow` securely.
5. Load the renderer via dev URL or packaged custom protocol.
6. Expose only a small preload bridge to the renderer.

### Renderer To Backend API Boundary

Read these files:

1. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/nativeApi.ts#L7-L25`
2. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/wsNativeApi.ts#L89-L236`
3. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/server/src/wsServer.ts#L689-L720`
4. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/server/src/wsServer.ts#L948-L970`

What they already do:

1. Build a browser-side `NativeApi` facade.
2. Route calls through WebSocket methods and channels.
3. Deliver `serverWelcome` and orchestration push events.
4. Keep the renderer isolated from provider implementation details.

### Harness And Provider Recovery Boundary

Read these files:

1. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/server/src/provider/Services/ProviderService.ts#L1-L89`
2. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/server/src/provider/Layers/ProviderService.ts#L134-L252`
3. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/server/src/codexAppServerManager.ts`

What they already do:

1. Treat provider adapters as interchangeable backends.
2. Maintain canonical provider runtime events.
3. Recover sessions from persisted runtime bindings.
4. Keep turn and provider behavior out of the renderer.

This is exactly the system to preserve.

## Existing UI Flow Worth Preserving

Even though the old UI is not the target look, its command flow is the right one.

Read these files:

1. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/hooks/useHandleNewThread.ts#L36-L115`
2. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/components/ChatView.tsx#L2770-L2849`
3. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/server/src/orchestration/decider.ts#L149-L169`
4. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/server/src/orchestration/decider.ts#L313-L385`
5. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/store.ts#L467-L714`

This gives you the first-milestone command lifecycle:

1. Create or select a local draft thread immediately.
2. On first send, dispatch `thread.create`.
3. Then dispatch `thread.turn.start`.
4. Let the server emit `thread.created`, `thread.message-sent`, `thread.turn-start-requested`, and session updates.
5. Let the store reduce those events into UI state.

That flow should remain intact even if the UI language changes from "thread" to "agent".

## Cursor Glass Reverse-Engineering Guidance

Cursor is installed at `/System/Volumes/Data/Applications/Cursor.app`.

### Files Worth Looking At

1. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js`
2. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.css`
3. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/glass/browser/media/cursor-logo-for-dark-theme.webm`
4. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/glass/browser/media/cursor-logo-for-light-theme.webm`
5. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/glass/browser/media/cursor-splash-logo-normal.png`
6. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/glass/browser/media/cursor-splash-logo-glass.png`
7. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/product.json#L27-L30`

### Important Findings

1. The dedicated `vs/glass` folder mostly contains brand and splash assets, not the actual shell source.
2. The real Glass shell logic is compiled into `workbench.desktop.main.js`.
3. Searching that bundle reveals `GlassSidebar`, `logged-out-glass-screen`, `glass-welcome-splash`, `glass.newAgent`, and related identifiers.
4. Cursor's updater uses private infrastructure and should not be copied.

### Recommended Search Commands

Use these exact commands when another developer needs to inspect Cursor locally:

```bash
rg -a "GlassSidebar|logged-out-glass-screen|glass-welcome-splash|glass.newAgent|glass-in-app-menubar" \
  "/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js"

find "/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/glass" \
  -maxdepth 4 -type f

nl -ba "/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/product.json" | sed -n '1,80p'
```

### What To Take From Cursor

Take these ideas only:

1. Sidebar affordance structure.
2. Docked versus overlay sidebar behavior.
3. Glass splash and titlebar treatment.
4. Empty-state layout proportions.
5. Logged-out and non-selected screen composition.
6. Keyboard-first top-level actions.

Do not try to port any compiled VS Code workbench code.

## Recommended Repo Bootstrap Strategy

### Preferred Approach

Clone `t3code`, copy the minimal architecture into this repo, then rewrite the renderer shell.

### Not Recommended For Phase 1

Initializing a blank Electron project and then trying to re-add the `t3code` harness. That reverses the hard part and adds avoidable risk.

### Concrete Bootstrap Steps

1. Copy the `t3code` monorepo shape into this repo.
2. Remove `apps/marketing`.
3. Rebrand package names, app names, and icons.
4. Keep `apps/desktop`, `apps/server`, `apps/web`, `packages/contracts`, and `packages/shared` compiling before any UI rewrite.
5. Only then replace the web shell.

## Recommended First Commit Order

### Commit 1: Base Import

Copy in the reduced `t3code` base with:

1. `apps/desktop`
2. `apps/server`
3. `apps/web`
4. `packages/contracts`
5. `packages/shared`
6. release scripts
7. updater workflow

Goal: build the imported base with no product changes.

### Commit 2: Product Rebrand

Change:

1. package names
2. `productName`
3. `appId`
4. bundle IDs
5. icons
6. updater repo slug env vars
7. title strings
8. user data directory names

Goal: app launches under the new product identity before the UI rewrite.

### Commit 3: New Shell Skeleton

Replace the top-level web layout with a Glass shell frame while keeping existing data flow.

Goal: app launches with new sidebar and empty center canvas, even if many actions are placeholders.

### Commit 4: Agent Creation And Send

Wire `New Agent` and composer send to the existing orchestration commands.

Goal: create/select/send works through the harness.

### Commit 5: Update UX And Packaging Verification

Polish updater visibility and verify packaged builds.

Goal: first release-candidate desktop build.

## New Renderer Structure To Create

Keep `apps/web` as the renderer package, but add a new Glass surface instead of extending the old thread UI.

Create these files:

```text
apps/web/src/components/glass/GlassShell.tsx
apps/web/src/components/glass/GlassSidebar.tsx
apps/web/src/components/glass/GlassSidebarHeader.tsx
apps/web/src/components/glass/GlassSidebarFooter.tsx
apps/web/src/components/glass/GlassAgentList.tsx
apps/web/src/components/glass/GlassAgentRow.tsx
apps/web/src/components/glass/GlassEmptyCanvas.tsx
apps/web/src/components/glass/GlassComposerCard.tsx
apps/web/src/components/glass/GlassQuickActions.tsx
apps/web/src/components/glass/GlassWorkspacePicker.tsx
apps/web/src/components/glass/GlassMarketplaceView.tsx
apps/web/src/components/glass/GlassUpdatePill.tsx

apps/web/src/hooks/useGlassAgents.ts
apps/web/src/hooks/useGlassComposer.ts
apps/web/src/lib/glassViewModel.ts
apps/web/src/lib/glassCommands.ts
```

## Responsibilities Of The New Files

### `GlassShell.tsx`

1. Owns the two-pane app shell.
2. Decides whether the center pane shows the empty state, selected agent, marketplace, or settings.
3. Coordinates responsive behavior between docked and overlay sidebar modes.

### `GlassSidebar.tsx`

1. Renders the entire left rail.
2. Includes top actions.
3. Renders grouped agents.
4. Keeps the visual rhythm consistent with the screenshot.

### `GlassSidebarHeader.tsx`

1. Renders `New Agent`.
2. Renders `Marketplace`.
3. Wires keyboard shortcuts and menu actions.

### `GlassSidebarFooter.tsx`

1. Renders profile, settings, and updater affordances.
2. Is the best home for subtle release/update state.

### `GlassAgentList.tsx`

1. Receives a view model, not raw store state.
2. Groups agents by project or other first-stage grouping.
3. Handles empty groups cleanly.

### `GlassAgentRow.tsx`

1. Shows active state.
2. Shows muted metadata.
3. Supports basic context menu hooks.
4. Does not need full overflow-menu parity in phase one.

### `GlassEmptyCanvas.tsx`

1. Recreates the non-selected screenshot state.
2. Shows workspace context label.
3. Hosts the central composer card and quick actions.

### `GlassComposerCard.tsx`

1. Owns the central prompt box.
2. Supports provider/model selection.
3. Submits through the existing orchestration flow.
4. Keeps stage-one interaction simple.

### `GlassQuickActions.tsx`

1. Renders `Plan New Idea` and `Open Editor Window`.
2. `Plan New Idea` can prefill the composer.
3. `Open Editor Window` can initially route through `nativeApi.shell.openInEditor()`.

### `GlassWorkspacePicker.tsx`

1. Displays the active/default project target.
2. Lets the user switch the project used by `New Agent` and the central composer.

### `useGlassAgents.ts`

1. Reads `useStore`, `useComposerDraftStore`, and route state.
2. Produces grouped sidebar-friendly agent data.
3. Treats threads as agents in the shell layer.

### `useGlassComposer.ts`

1. Owns central-composer text and pending state.
2. Owns selected provider/model.
3. Handles the `send` command.
4. Stays intentionally thin and delegates orchestration command construction.

### `glassViewModel.ts`

1. Converts raw projects and threads into shell view data.
2. Hides old thread-specific naming from the new UI.
3. Keeps this mapping centralized.

### `glassCommands.ts`

1. Extracts the minimal orchestration dispatch helpers needed for Glass.
2. Prevents the new shell from duplicating logic from the giant current `ChatView.tsx`.

## Route Strategy

Keep the existing router and route identity.

Read these files:

1. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/main.tsx#L13-L23`
2. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/router.ts#L7-L17`
3. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/routes/__root.tsx#L47-L71`
4. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/routes/_chat.index.tsx#L6-L35`
5. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/routes/_chat.$threadId.tsx#L163-L255`

### Route Decision

Keep these route identities:

1. `/_chat/` for the no-agent-selected empty state.
2. `/_chat/$threadId` for the selected-agent state.
3. `/settings` for preferences and updater visibility.

Reason:

1. The route and state machinery already works.
2. Draft-thread creation already uses route-based identity.
3. Another developer can ship the shell rewrite without destabilizing navigation.

## Layout Plan

### Replace `AppSidebarLayout`

Current file:

`/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/components/AppSidebarLayout.tsx#L11-L48`

Current role:

1. Wraps the app in a resizable left sidebar.
2. Hosts the old thread sidebar.

Recommended change:

1. Keep the resizable sidebar primitive.
2. Replace `ThreadSidebar` with the new `GlassSidebar`.
3. Rename the component if needed to make the ownership obvious.

### Empty State Route

Current file:

`/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/routes/_chat.index.tsx#L6-L35`

Recommended change:

1. Replace the current generic empty-state copy with the centered Glass empty canvas.
2. Keep the drag region concept for Electron.
3. Keep the route and file; only replace the rendered content.

### Selected Agent Route

Current file:

`/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/routes/_chat.$threadId.tsx#L163-L255`

Recommended change:

1. Keep the route file and selected-thread boot logic.
2. Replace or split out `ChatView` usage over time.
3. In phase one, selected agents can still render a reduced chat-style detail pane while the shell around them becomes Glass.

## Naming Strategy

At the harness level, keep the word `thread`.

At the UI level, use the word `agent`.

Reason:

1. The backend contracts and orchestration model already use `thread`.
2. Renaming contracts adds unnecessary breakage.
3. The shell can translate `thread` to `agent` in the view model.

## Minimal Functional Scope For Milestone 1

Milestone 1 should support only these user-visible actions:

1. See the left sidebar.
2. Press `New Agent`.
3. Select an existing agent.
4. Type in the central composer.
5. Submit a message.
6. See the selected agent update from orchestration events.
7. Open settings.
8. See update state.

Leave these out of phase one:

1. attachments
2. approvals
3. pending user-input workflows
4. diff pane parity
5. worktree creation
6. project scripts
7. marketplace implementation
8. login and signup flows
9. invite flows
10. advanced context menus

## Exact Orchestration Flow To Preserve

### Creating A New Agent

Use the existing draft-thread pattern from:

`/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/hooks/useHandleNewThread.ts#L36-L115`

Do not replace this with an immediate server mutation.

### First Send On Draft Agent

Mirror the existing logic in:

`/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/components/ChatView.tsx#L2770-L2849`

The sequence must remain:

1. If draft, dispatch `thread.create`.
2. Then dispatch `thread.turn.start`.

### Server Event Semantics

Keep the semantics in:

1. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/server/src/orchestration/decider.ts#L149-L169`
2. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/server/src/orchestration/decider.ts#L313-L385`

### Renderer State Reduction

Keep the reduction logic in:

`/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/web/src/store.ts#L467-L714`

This is why the new shell does not need its own runtime state machine.

## Electron Window And Desktop Shell Changes

### Current Window Definition

Read:

`/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/desktop/src/main.ts#L1294-L1375`

### Recommended Changes

1. Increase default size to something closer to the Glass screenshot, for example `1440x900`.
2. Keep `titleBarStyle: "hiddenInset"` on macOS.
3. Keep `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
4. Introduce more intentional titlebar drag zones in the renderer rather than changing Electron security settings.
5. Keep `window.webContents.setWindowOpenHandler` behavior for external links.
6. Keep the preload bridge model.

## Preload Bridge Plan

### Current Bridge

Read:

`/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/desktop/src/preload.ts#L1-L53`

### Guidance

1. Keep it narrow.
2. Only add IPC calls when the shell cannot go through `NativeApi`.
3. Continue routing app-domain behavior through WebSocket-backed `NativeApi` when possible.
4. Use preload only for true desktop affordances such as menus, folder pickers, external links, theme, update install/download, and possibly open-editor-window if needed.

## Auto-Update Plan

This project should keep `electron-updater` and the existing release mechanics.

### Existing Files To Study

1. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/apps/desktop/src/main.ts#L839-L960`
2. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/docs/release.md#L21-L41`
3. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/scripts/build-desktop-artifact.ts#L466-L521`
4. `/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/.github/workflows/release.yml#L80-L304`

### What Already Exists

1. Background update checks.
2. Manual download.
3. Manual install after download.
4. GitHub Releases provider config.
5. Mac, Linux, and Windows artifact generation.
6. `latest*.yml` and `*.blockmap` collection.
7. macOS updater manifest merge for Intel and Apple Silicon.

### What To Keep

1. `electron-updater` implementation.
2. manual update UX
3. GitHub Releases distribution
4. release asset set
5. signing hooks
6. dual-arch mac updater manifest merge

### What To Change

1. app name
2. app id
3. artifact names
4. release repository slug
5. updater UI copy
6. environment variable names after the first stable packaging pass

### What Not To Copy From Cursor

Do not use Cursor's `updateUrl` model from:

`/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/product.json#L27-L30`

Use GitHub Releases through `electron-updater` instead.

## Release Pipeline Guidance

### Existing `t3code` Workflow

Read:

`/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/.github/workflows/release.yml#L80-L304`

### Recommended Adjustments

1. Keep the `build` job matrix.
2. Keep `latest*.yml` and `*.blockmap` publishing.
3. Keep mac manifest merge.
4. Remove the `publish_cli` job if this app is desktop-only.
5. Keep the `preflight` checks.
6. Keep optional signing support.

### Packaging Script Guidance

Read:

`/Users/workgyver/developer/c-glass/.pi/codebases/cb-mnevhifm-oqps/scripts/build-desktop-artifact.ts#L466-L521`

It already sets:

1. `appId`
2. `productName`
3. artifact naming
4. publish provider config
5. platform-specific build config

Use this as the canonical place for packaging identity.

## Suggested File Rewrite Order In `apps/web`

### Stage 1: Introduce New Shell Without Deleting Old Chat Implementation

Modify or replace these entry points first:

1. `apps/web/src/components/AppSidebarLayout.tsx`
2. `apps/web/src/routes/_chat.index.tsx`
3. `apps/web/src/routes/__root.tsx`

Goal: launch into a Glass frame with the new empty state.

### Stage 2: Build Sidebar On Top Of Existing Store

Use these data sources:

1. `useStore`
2. `useComposerDraftStore`
3. `useThreadSelectionStore` only if still needed
4. route `threadId`

Do not move domain state into the sidebar.

### Stage 3: Extract Minimal Send Path

Extract from `ChatView.tsx` only the minimal logic needed to:

1. create a thread when draft
2. send the first user message
3. update title seed
4. persist model/runtime/interaction settings only if still needed in phase one

Prefer moving that minimal logic into `glassCommands.ts` rather than carrying the full `ChatView` feature surface over.

### Stage 4: Reduce Selected-Agent Detail View

Keep a lightweight selected-agent view that can still show:

1. message timeline
2. pending running state
3. provider session status

Do not bring over complex side-panels unless necessary.

## Suggested Shell Data Model

Use a renderer-only view model. Do not change backend contracts.

Example shape:

```ts
interface GlassSidebarAgent {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  state: "draft" | "idle" | "running" | "error";
  unread: boolean;
  updatedAt: string;
  selected: boolean;
}

interface GlassSidebarSection {
  id: string;
  label: string;
  agents: GlassSidebarAgent[];
}
```

Derive this from existing `Project` and `Thread` state. Do not persist it separately.

## Styling Guidance

The UI should not look like default shadcn plus Tailwind chat scaffolding.

### Visual Direction

1. Use a more atmospheric background than flat white.
2. Keep the center composer visually heavier than the surrounding shell.
3. Make the sidebar feel like a desktop-native navigation surface.
4. Use subtle separators and muted typography.
5. Avoid loud dashboard widgets.

### CSS Guidance

Add shell-specific tokens in a dedicated file, for example:

```text
apps/web/src/glass.css
```

or a dedicated section in:

```text
apps/web/src/index.css
```

Recommended token categories:

1. shell background
2. panel background
3. panel border
4. sidebar item hover
5. sidebar item active
6. muted text
7. drag-region safe spacing
8. composer card shadow and radius

### Responsive Guidance

1. Docked resizable sidebar on wide screens.
2. Overlay sidebar on narrow screens.
3. Preserve desktop-first layout even when shrunk.
4. Keep quick actions from wrapping awkwardly.

## What To Leave For Other Developers After The Shell Milestone

These are natural follow-up workstreams once the shell is in place:

1. Marketplace implementation.
2. Attachments and image sending in the central composer.
3. Approval and pending-user-input flows.
4. Worktree-aware agent creation.
5. Diff and plan side panels.
6. Login and account flows.
7. Splash animation parity.
8. Advanced agent row actions.
9. Team features.
10. Better keyboard command surface.

## Risks And Mitigations

### Risk 1: Rewriting Too Much At Once

Mitigation:

1. Keep backend and contracts untouched.
2. Keep routes and navigation semantics.
3. Replace only the web shell first.

### Risk 2: Treating Cursor As Source Instead Of Reference

Mitigation:

1. Copy only product-level behavior.
2. Do not port bundle logic.
3. Do not imitate private update or workbench internals.

### Risk 3: Breaking Packaging During Rebrand

Mitigation:

1. Rebrand identity in one focused pass.
2. Produce packaged builds early.
3. Verify updater metadata after every identity change.

### Risk 4: Renderer State Drift From Harness Events

Mitigation:

1. Continue rendering from orchestration events.
2. Continue using the existing store reduction pattern.
3. Do not add a second client-side agent state machine.

## Verification Checklist

A developer executing this plan should verify all of the following.

### Development Mode

1. `bun install`
2. `bun run dev:desktop`
3. window launches
4. backend boots through Electron child-process path
5. WS welcome message arrives
6. empty Glass shell renders
7. `New Agent` creates a draft and navigates
8. sending creates a server thread and starts a turn

### Quality Gates

Per `t3code` AGENTS guidance:

1. `bun fmt`
2. `bun lint`
3. `bun typecheck`
4. `bun run test`

### Packaging

1. mac build artifact
2. windows build artifact
3. linux build artifact
4. updater metadata produced
5. packaged app launches
6. update check works

## Phase-By-Phase Execution Plan

## Phase 0: Import And Stabilize The Base

1. Copy the reduced `t3code` architecture into this repo.
2. Delete unrelated apps such as `apps/marketing`.
3. Make the imported base build without product changes.
4. Verify desktop dev mode before making any shell changes.

Deliverable: unmodified imported base running locally.

## Phase 1: Rebrand The Product Identity

1. Update package names and product names.
2. Replace desktop icons.
3. Update `appId` and bundle IDs.
4. Rename user-data directories and app strings.
5. Update updater/release repository slug configuration.

Deliverable: rebranded app still launches and packages.

## Phase 2: Introduce The Glass Shell Frame

1. Replace the old sidebar host with a new Glass shell.
2. Replace the no-thread-selected route with the Glass empty canvas.
3. Keep the old selected-thread route alive behind the new shell.
4. Add shell-level CSS tokens and layout primitives.

Deliverable: screenshot-like empty shell running on the existing app runtime.

## Phase 3: Build The Sidebar And Agent View Model

1. Add `useGlassAgents.ts` and `glassViewModel.ts`.
2. Render grouped agents from existing store data.
3. Support selecting draft and persisted agents.
4. Add `Marketplace` placeholder route/state.

Deliverable: left sidebar behaves like an agent navigator.

## Phase 4: Wire Composer Creation And Send

1. Reuse `useHandleNewThread()` for instant draft creation.
2. Extract minimal `thread.create` and `thread.turn.start` flow from `ChatView.tsx`.
3. Submit through `api.orchestration.dispatchCommand()`.
4. Render backend state purely from orchestration events.

Deliverable: user can create an agent and send the first prompt from the new shell.

## Phase 5: Selected-Agent Detail Surface

1. Either keep a simplified chat detail view or replace it with a lighter Glass conversation pane.
2. Show timeline, session state, and minimal actions.
3. Do not add side features yet.

Deliverable: selected-agent view supports real use.

## Phase 6: Updater And Release Verification

1. Rebrand release names and artifacts.
2. Remove desktop-unrelated release jobs if desired.
3. Build artifacts for mac, linux, and windows.
4. Confirm updater metadata and manual update flow.

Deliverable: release candidate build.

## Final Acceptance Criteria

The shell milestone is complete when all of the following are true:

1. The desktop app launches using the `t3code` Electron host and server harness.
2. The UI presents a Cursor-Glass-like shell rather than the original `t3code` thread UI.
3. The left sidebar supports `New Agent`, `Marketplace`, and selecting existing agents.
4. The center empty state closely matches the screenshot's composition.
5. The central composer can create a draft agent, create a server thread, and send the first turn.
6. The selected agent updates through orchestration events without a new client-side loop.
7. Auto-update remains wired through `electron-updater` and GitHub Releases.
8. Required checks pass: `bun fmt`, `bun lint`, `bun typecheck`, and `bun run test`.

## Short Version For The Next Developer

If you only read one page, do this:

1. Copy `t3code`'s `apps/desktop`, `apps/server`, `apps/web`, `packages/contracts`, `packages/shared`, and release scripts into this repo.
2. Rebrand the desktop app and release config.
3. Replace `apps/web` shell and routes with a new Glass UI, but keep the existing route identities and orchestration commands.
4. Reuse `useHandleNewThread()` and the `thread.create` plus `thread.turn.start` flow from `ChatView.tsx`.
5. Keep all provider runtime logic in the harness.
6. Keep `electron-updater` and the existing GitHub Releases pipeline.
