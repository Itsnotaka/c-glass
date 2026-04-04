# c-glass Deep Dive: Cursor 3 / Composer 2 Direction

## Why This Exists

This document is a full handoff for engineers working on `c-glass` as a Cursor-3-style agent workspace built on top of Pi.

The goal is not to describe the repo by folder name alone. The goal is to explain:

1. what the app actually does today,
2. how the main UI components connect to runtime functions,
3. which context providers and stores own which pieces of state,
4. how auth, sessions, workspaces, and IPC are wired,
5. where the current architecture already overlaps with Cursor 3,
6. where the gaps are,
7. what to build next if we want a real Composer-2-style experience without abandoning Pi.

## Executive Summary

`c-glass` is already a meaningful local agent workspace, not just a chat UI.

It has:

1. an Electron shell with a preload bridge exposed as `window.glass` via `apps/desktop/src/preload.ts#L139`,
2. a React + TanStack Router frontend rooted in `apps/web/src/main.tsx` and `apps/web/src/router.ts#L7`,
3. a Pi-backed local agent runtime via `apps/desktop/src/pi-session-service.ts#L741`,
4. Pi-backed provider/model/auth state via `apps/desktop/src/pi-config-service.ts#L74`,
5. multi-workspace switching through the shell bridge in `apps/desktop/src/main.ts#L1422`,
6. a composer-like input with slash commands, file mentions, attachments, and model/thinking selection in `apps/web/src/components/glass/glass-pi-composer.tsx#L303`,
7. a session rail that already groups work by workspace in `apps/web/src/hooks/use-glass-agents.ts#L6` and `apps/web/src/lib/glass-view-model.ts`.

The repo does not yet have:

1. a task/run abstraction above raw Pi sessions,
2. true parallel local task streaming in one renderer,
3. a cloud runtime or local/cloud handoff model,
4. a browser tool lane wired into the runtime,
5. a first-class review/artifact domain for diffs, screenshots, plans, blockers, and approvals.

The main user-facing wiring bug discovered during this pass was OAuth recovery in the live composer path. That is now fixed so blocked OAuth providers can be re-authenticated directly from the compose flow instead of only from Settings.

## Monorepo Shape

The repo is split into three functional layers.

### Web App

The web app lives in `apps/web` and contains:

1. route/layout composition,
2. the Glass UI shell,
3. Zustand state for Pi session/config boot data,
4. UI-only stores for auth overlays, shell panels, new chat ticks, and appearance,
5. the composer, message list, settings, and diff UI.

### Desktop Runtime

The desktop app lives in `apps/desktop` and contains:

1. Electron app startup and window creation,
2. preload bridge creation,
3. IPC registration,
4. workspace shell state,
5. Pi session runtime adaptation,
6. Pi config/auth/model adaptation,
7. Git and update services.

### Contracts

Shared runtime contracts live in `packages/contracts` and define the desktop bridge shape used by both sides.

The most important contract files are:

1. `packages/contracts/src/ipc.ts#L7` for `GlassBridge`,
2. `packages/contracts/src/pi.ts#L98` for `PiBridge`,
3. `packages/contracts/src/session.ts#L351` for `SessionBridge`,
4. `packages/contracts/src/session.ts#L253` and `#L278` for Pi session summaries and snapshots.

## Route, Provider, And Store Map

The frontend has very little React context. Most shared app state is Zustand-backed.

### React Providers

There are three meaningful providers in the active app shell.

1. `QueryClientProvider` is created in `apps/web/src/router.ts#L7` and wraps the entire router.
2. `GlassSettingsProvider` is mounted in `apps/web/src/components/app-sidebar-layout.tsx` and provides `openSettings()` through `apps/web/src/components/glass/glass-settings-context.tsx#L10`.
3. `SidebarProvider` is also mounted in `apps/web/src/components/app-sidebar-layout.tsx` and owns the sidebar chrome state from `apps/web/src/components/ui/sidebar.tsx`.

There is no React auth provider for Pi. Provider auth overlay state is held in Zustand.

React Query is still present, but it is no longer part of the Pi runtime state path.

The canonical split is now:

1. Pi config, Pi summaries, Pi snapshots, and live session deltas live in `usePiStore` and are refreshed from preload and bridge events,
2. React Query is used only where a query cache is actually helpful, such as desktop update state in `apps/web/src/lib/desktop-update-react-query.ts`.

The orphaned experimental Pi query layer in `apps/web/src/lib/pi-react-query.ts` has been removed so there is no second source of truth for Pi state.

### Zustand Stores

The main stores are:

1. `usePiStore` in `apps/web/src/lib/pi-session-store.ts`, which owns Pi boot config, session summaries, live snapshots, and the boot/refresh pipeline.
2. `useGlassProviderAuthStore` in `apps/web/src/lib/glass-provider-auth-store.ts`, which owns the provider-auth overlay request and recovery actions.
3. `useGlassShellStore` for shell-related UI state such as changed paths and panel mute state.
4. `useGlassNewChatStore` for resetting the hero composer when the user starts a fresh task.

That ownership boundary matters because the app previously had the beginnings of a parallel Pi React Query cache. That cache is now intentionally gone.

The canonical rule is:

1. bridge-backed live Pi state belongs in Zustand,
2. small pull-based singleton resources can use React Query when they do not compete with the Pi event model.

### Route Tree

The important route path is `_chat`.

1. `apps/web/src/routes/__root.tsx#L17` mounts `PiBootBridge`, `AppSidebarLayout`, and the toaster.
2. `apps/web/src/routes/_chat/route.tsx` mounts `SidebarInset`, the shared provider overlay, and an `Outlet`.
3. `apps/web/src/routes/_chat/_shell/route.tsx` is a pathless chat-layout route that mounts `GlassChatShell`.
4. `apps/web/src/routes/_chat/_shell/index.tsx` renders `GlassHeroCanvas` for the empty state.
5. `apps/web/src/routes/_chat/_shell/$threadId.tsx` renders `GlassChatSession` for a selected thread.
6. `apps/web/src/routes/_chat/settings/route.tsx` now mounts `GlassSettingsShell` for the settings subtree.
7. `apps/web/src/routes/_chat/settings/{appearance,agents,archived}.tsx` remain the settings leaf routes.

This directory layout is the canonical unreleased shape because the route filesystem now mirrors the actual shell hierarchy directly.

### TanStack Router Hierarchy And Outlet Opportunities

The router refactor is now partially implemented instead of only proposed.

The generated hierarchy in `apps/web/src/routeTree.gen.ts` is now effectively:

1. `__root__`
2. `/_chat` as the shared app surface for `SidebarInset` and shared overlays
3. `/_chat/_shell` as a pathless chat-layout route for normal chat chrome
4. `/_chat/_shell/` for the hero route
5. `/_chat/_shell/$threadId` for the thread route
6. `/_chat/settings` as the settings-shell route
7. `/_chat/settings/{appearance,agents,archived}` as settings leaf routes

This is the important difference relative to the previous state: the router now owns more than the center pane.

`apps/web/src/components/glass/glass-chat-shell.tsx#L22` is now the normal chat shell only. It no longer branches on `pathname.startsWith("/settings")` to decide all shell chrome.

Instead:

1. `GlassChatShell` owns the thread rail, git panel, thread title, and thread-selection workspace switching,
2. `GlassSettingsShell` in `apps/web/src/components/glass/glass-settings-shell.tsx#L13` owns the settings rail, settings title, back button, and right-panel shutdown,
3. `apps/web/src/routes/_chat/route.tsx#L6` owns the shared `SidebarInset` boundary and the provider overlay.

That is the right kind of Outlet usage for this app. The layout split is now structural, not just a center-pane swap.

The immediate benefits are:

1. chat-versus-settings chrome ownership now lives at route boundaries,
2. `GlassChatShell` no longer needs settings mode, settings title, or `right={null}` branching,
3. `GlassSidebarFooter` in `apps/web/src/components/glass/glass-sidebar-footer.tsx#L9` now receives settings state from the owning route shell and navigates with TanStack `Link`,
4. the shared `/_chat` boundary is now a better place to hang shell-wide overlays and future workspace-wide bridges.

There is still a second-level opportunity under `/$threadId`.

Right now `apps/web/src/routes/_chat/_shell/$threadId.tsx#L5` is still a leaf route that directly renders `GlassChatSession`.

If that route becomes a layout route later, the thread subtree could support:

1. a default session view,
2. a review route,
3. an artifacts route,
4. a blockers route,
5. route-owned third-sidebar variants.

That is still the next logical Router seam for the Cursor-3 direction.

There is still some light route awareness in settings UI, but it is now expressed through TanStack Router APIs instead of ad hoc pathname plumbing.

For example, `GlassSettingsNavRail` now uses `Link` active handling instead of reading pathname manually, and `GlassSettingsShell` derives title through route matching rather than internal route id comparisons.

The general recommendation remains:

1. keep TanStack Router responsible for structural chrome decisions,
2. keep Zustand and runtime hooks responsible for data and local app state,
3. keep pushing route-specific shell behavior down into layout routes before adding new global shell branches.

## Frontend Control Flow

### Boot Flow

Boot begins in `apps/web/src/routes/__root.tsx#L40` inside `PiBootBridge`.

`PiBootBridge` does four things.

1. It calls `usePiStore().boot()` once on mount.
2. It subscribes to `glass.session.onSummary()` so summary updates can patch the sidebar without re-fetching everything.
3. It subscribes to the desktop `onBootRefresh` hook so settings/auth/workspace changes can refresh Pi config and summaries.
4. It listens for the custom `PI_GLASS_SHELL_CHANGED_EVENT` to reset and reload when the active workspace changes.

`usePiStore.boot()` in `apps/web/src/lib/pi-session-store.ts` attempts to read preload boot snapshots first via `readBootConfig()` and `readBootSummaries()` so the UI can hydrate with local state before async refresh completes.

This is also why Pi state no longer uses React Query.

The preload boot snapshot plus bridge-event model is already a complete state pipeline. Adding a second React Query cache for the same Pi config and summary resources would duplicate boot hydration, duplicate refresh triggers, and duplicate event subscriptions.

### Shell Flow

The shared shell boundary is now split across three route layers.

1. `apps/web/src/routes/_chat/route.tsx#L6` owns shared shell framing through `SidebarInset`, the route `Outlet`, and `GlassProviderShellOverlay`.
2. `apps/web/src/components/glass/glass-chat-shell.tsx#L22` owns the normal chat workspace shell.
3. `apps/web/src/components/glass/glass-settings-shell.tsx#L13` owns the settings workspace shell.

`GlassChatShell` now connects:

1. workspace state from `useShellState()` in `apps/web/src/hooks/use-shell-cwd.ts`,
2. grouped Pi session summaries from `useGlassAgents()` in `apps/web/src/hooks/use-glass-agents.ts#L6`,
3. side panel state from `useGlassShellPanels()`,
4. git panel state from `useGlassGitPanel()`,
5. thread title state from `usePiStore`,
6. workspace switching for cross-repo thread selection.

`GlassSettingsShell` owns the settings-only shell decisions.

It does all of the following:

1. derives settings title from the matched route id,
2. mounts `GlassSettingsNavRail` directly,
3. shows the back button directly,
4. closes and mutes the right panel when the settings shell is active.

Important remaining behaviors in the chat shell path are:

1. opening a thread can still switch the global shell workspace via `glass.shell.setWorkspace()` if that thread belongs to another repo,
2. selecting a thread in another workspace still resets Pi boot state and dispatches the shell-changed event,
3. the git panel can still auto-open when a watched thread has relevant file hits and the workspace has not muted the panel.

This means the app is still workspace-scoped first and thread-scoped second, but the router now owns the chat-versus-settings shell boundary much more explicitly.

### Sidebar / Thread Rail Flow

`useGlassAgents()` combines raw Pi summaries and the current workspace into grouped sections.

That transformation happens in `apps/web/src/lib/glass-view-model.ts`.

Key behavior:

1. summaries are grouped by `cwd`,
2. groups are ordered with the current workspace first,
3. thread rows are built from Pi session summaries with a minimal state model of `idle`, `running`, or `draft`.

This is already one of the strongest Cursor-3-like patterns in the repo: a single rail containing many workspace-scoped agent threads.

### Session View Flow

`apps/web/src/components/glass/glass-chat-session.tsx` chooses between two surfaces.

1. `HeroSession` for zero-message sessions.
2. `DockSession` for existing sessions.

Both modes are backed by the same hook: `usePiSession()` in `apps/web/src/components/glass/use-pi-session.ts#L58`.

### Composer Flow

`GlassPiComposer` in `apps/web/src/components/glass/glass-pi-composer.tsx#L303` is the closest thing to a Composer surface today.

It already supports:

1. slash command completion using `glass.session.commands(sessionId)`,
2. `@` file suggestions using `glass.shell.suggestFiles(query)`,
3. file preview using `glass.shell.previewFile(path)`,
4. native file picking via `glass.shell.pickFiles()`,
5. drag-and-drop and paste image attachments,
6. model and thinking-level selection via `PiModelPicker`,
7. local app commands like `/new` and `/settings`.

From a product perspective, this component is not the missing piece. The missing piece is the orchestration layer behind it.

### Linked Chains: Component -> Hook/Function -> Electron Bridge

The clearest way to understand the current architecture is as linked lists from a UI surface to a bridge call to a desktop service.

1. Thread selection across workspaces: `GlassThreadRail` -> `onSelectAgent()` in `GlassChatShell` at `apps/web/src/components/glass/glass-chat-shell.tsx#L80` -> `readGlass().shell.setWorkspace(next.cwd)` -> preload `glass.shell.setWorkspace` in `apps/desktop/src/preload.ts#L145` -> `SHELL_SET_WORKSPACE_CHANNEL` in `apps/desktop/src/main.ts#L1422` -> `shellService.setWorkspace(cwd)` -> boot refresh + `PI_GLASS_SHELL_CHANGED_EVENT` -> `PiBootBridge` in `apps/web/src/routes/__root.tsx#L40` -> `usePiStore.refreshCfg()` and `usePiStore.refreshSums()`.
2. Main prompt send path: `GlassPiComposer` in `apps/web/src/components/glass/glass-pi-composer.tsx#L303` -> `onSend` from `usePiSession()` in `apps/web/src/components/glass/use-pi-session.ts#L58` -> `getGlass().session.prompt(...)` -> preload `glass.session.prompt` in `apps/desktop/src/preload.ts#L105` -> `SESSION_PROMPT_CHANNEL` in `apps/desktop/src/main.ts#L1229` -> `PiSessionService.prompt()` -> Pi session manager runtime -> `glass.session.onActive` and `glass.session.onSummary` back through preload -> `usePiStore.applyActs()` and `PiBootBridge` summary updates.
3. Composer auth recovery path: blocked action in `usePiSession()` -> `showProvider()` in `apps/web/src/components/glass/use-pi-session.ts#L178` -> `readPiProvider()` and `startPiOAuthLogin()` in `apps/web/src/lib/pi-models.ts#L173` and `#L252` -> preload `glass.pi.startOAuthLogin` in `apps/desktop/src/preload.ts#L93` -> `PI_START_OAUTH_LOGIN_CHANNEL` in `apps/desktop/src/main.ts#L1362` -> `PiConfigService.oauthLogin()` in `apps/desktop/src/pi-config-service.ts#L221` -> Pi auth storage / provider OAuth callbacks -> refreshed config read through `PiBridge.startOAuthLogin` in `packages/contracts/src/pi.ts#L108` and `getConfig()` in `apps/desktop/src/pi-config-service.ts#L136` -> original blocked composer action retries.
4. File mention and picker path: `GlassPiComposer` -> `glass.shell.suggestFiles(query)`, `glass.shell.previewFile(path)`, and `glass.shell.pickFiles()` -> preload shell bridge in `apps/desktop/src/preload.ts` -> shell IPC handlers in `apps/desktop/src/main.ts` -> `ShellService` file-system helpers -> suggestions and previews flow back into the composer picker UI.
5. Review linkage path: assistant tool output in a watched session -> `usePiSession()` extracts changed file paths and writes them into `useGlassShellStore` -> `useGlassGitPanel()` in `apps/web/src/hooks/use-glass-git.ts#L117` correlates those paths with `glass.git` state -> preload git bridge -> desktop git service -> `GlassGitPanel` renders the diff rail.
6. Boot and summary hydration path: `PiBootBridge` in `apps/web/src/routes/__root.tsx#L40` -> `usePiStore.boot()` -> preload `readBootConfig()` and `readBootSummaries()` from `apps/desktop/src/preload.ts#L83` -> later async `glass.pi.getConfig()` and `glass.session.listAll()` -> desktop config/session services -> live summary patches return through `glass.session.onSummary()` back into `usePiStore.applySummaryEvent()`.

## Pi Session Runtime Wiring

The local runtime path is:

1. `GlassPiComposer` calls `onSend`, `onAbort`, `onModel`, or `onThinkingLevel`.
2. Those callbacks come from `usePiSession()`.
3. `usePiSession()` calls `window.glass.session.*` through `getGlass()` from `apps/web/src/host.ts`.
4. `apps/desktop/src/preload.ts` forwards those calls to Electron IPC.
5. `apps/desktop/src/main.ts` handles the IPC channels.
6. The handlers call `PiSessionService` in `apps/desktop/src/pi-session-service.ts#L741`.
7. `PiSessionService` adapts Pi session managers and emits summary/live events back to the frontend.

### What `usePiSession()` Owns

`usePiSession()` owns the UI bridge for a single live session.

It does all of the following:

1. `watch(sessionId)` on mount and `unwatch()` on cleanup,
2. batches `onActive` deltas per animation frame before applying them to `usePiStore`,
3. extracts edited file paths from assistant tool calls so the shell can highlight changed files,
4. creates a new Pi session if the user sends from the hero state,
5. handles auth recovery when prompt or model-change actions fail,
6. writes default model/thinking level when the composer is operating without an existing session.

### What `PiSessionService` Owns

`PiSessionService` is a local runtime adapter around `@mariozechner/pi-coding-agent`.

It is responsible for:

1. creating or opening session managers,
2. mapping Pi session manager entries into `PiSessionSnapshot` and `PiSessionSummary`,
3. converting raw Pi events into `summary` and `active` bridge events,
4. building prompt input from text plus file/image attachments,
5. resolving slash commands and skills,
6. sending prompts, aborts, model changes, and thinking-level changes into Pi.

This is the core reason the repo should keep Pi as the runtime backbone. There is already a coherent local runtime integration here.

## Pi Config / Auth Wiring

`PiConfigService` in `apps/desktop/src/pi-config-service.ts#L74` is the source of truth for model registry and auth state.

It owns:

1. `AuthStorage` for provider credentials,
2. `ModelRegistry` for available models,
3. `SettingsManager` for global and project defaults,
4. runtime API key injection for providers whose OAuth-style access token needs to be mapped into runtime key form,
5. OAuth login through `auth.login(provider, callbacks)`.

The frontend never talks to auth files directly. It only talks to the `PiBridge` contract defined in `packages/contracts/src/pi.ts#L98`.

### Current Frontend Auth Surfaces

There were two auth surfaces before this review.

1. Settings, through `apps/web/src/components/settings/settings-panels.tsx`, which could already start OAuth via `startPiOAuthLogin()` from `apps/web/src/lib/pi-models.ts#L252`.
2. The provider auth overlay, through `GlassProviderKeyDialog`, which could recover API-key flows but only showed informational text for OAuth.

### Auth Wiring Fix Applied In This Pass

The live composer auth path is now fixed.

Changed files:

1. `apps/web/src/components/glass/use-pi-session.ts`,
2. `apps/web/src/lib/glass-provider-auth-store.ts`,
3. `apps/web/src/components/glass/glass-provider-shell-overlay.tsx`,
4. `apps/web/src/components/glass/glass-provider-key-dialog.tsx`.

What changed:

1. OAuth recovery can now be initiated from the composer-blocked auth dialog itself.
2. The dialog now shows `Connect with OAuth` when Pi says the provider supports OAuth.
3. On successful OAuth login, the originally blocked action is retried automatically.
4. API-key behavior stays the same.

Why it mattered:

1. the main compose path is where auth failures matter most,
2. sending the user to Settings to recover auth broke flow and made the composer feel half-wired,
3. a Cursor-style composer surface needs in-flow recovery for model/provider blockers.

## Electron Bridge And IPC Map

### Preload Bridge

`apps/desktop/src/preload.ts#L139` exposes the following top-level bridge shape:

1. `glass.session`,
2. `glass.pi`,
3. `glass.shell`,
4. `glass.git`,
5. `glass.desktop`.

That bridge matches `GlassBridge` from `packages/contracts/src/ipc.ts#L7`.

### IPC Handlers That Matter Most

In `apps/desktop/src/main.ts`:

1. `SESSION_WATCH_CHANNEL` at `#L1196` binds one watched session per renderer sender.
2. `SESSION_PROMPT_CHANNEL` at `#L1229` forwards prompt input into `PiSessionService.prompt()`.
3. `PI_START_OAUTH_LOGIN_CHANNEL` at `#L1362` runs Pi OAuth login and opens the external browser when needed.
4. `SHELL_SET_WORKSPACE_CHANNEL` at `#L1422` switches the global workspace, refreshes git state, clears watched sessions, and emits a boot refresh.

This is the runtime center of gravity for the whole app.

## Workspace Model

The workspace model is important because it is both a strength and a current architectural limit.

Today:

1. the app has one global shell workspace at a time,
2. Pi config, Git state, and session listing are all refreshed against that active shell workspace,
3. selecting a thread from another workspace mutates the global shell workspace.

This gives a good single-focus desktop experience, but it is weaker than Cursor 3 in one specific way: task identity is not separate from focused workspace identity.

That is the biggest reason a future Composer layer should own task `cwd` directly instead of depending on the app-wide shell workspace.

## What Already Overlaps With Cursor 3

This repo already has real overlap with Cursor 3 concepts.

### Strong Existing Overlap

1. agent-first thread rail grouped by workspace,
2. hero and dock composer surfaces,
3. model/thinking selection inside the composer,
4. routeable session identity,
5. git review panel in the right rail,
6. desktop shell integration,
7. Pi skills/prompt-template/extension support through the runtime,
8. Electron-native desktop container instead of a browser-only app.

### Partial Overlap

1. multi-workspace navigation exists, but not true parallel multi-workspace task execution in one renderer,
2. review exists, but not as a first-class artifact layer,
3. session handoff exists only as a local UI pattern, not as a local/cloud runtime transfer,
4. tools exist through Pi, but browser tooling is not wired.

## Gap Map Against Cursor 3 / Composer 2

The most important product gaps are below.

### 1. No Task / Run / Artifact Layer

The UI currently talks mostly in terms of Pi sessions.

What is missing is a higher-level domain like:

1. `ComposerTask`,
2. `ComposerRun`,
3. `ComposerArtifact`,
4. `ComposerBlocker`.

Without that layer, the UI cannot cleanly express:

1. task status separate from message streaming,
2. review state separate from raw session logs,
3. blockers such as auth or approvals,
4. local/cloud handoff metadata,
5. runtime type.

### 2. No Cloud Runtime

Cursor 3 is heavily organized around local and cloud agents plus handoff between them.

`c-glass` has no cloud runtime today.

That is fine. The real issue is that the architecture has not yet created a neutral place to add one later.

### 3. No Browser Tool Lane

Cursor 3 treats browser control as a built-in agent tool.

`c-glass` currently has no browser bridge or browser artifact pipeline. There is also no current use of `agent-browser` anywhere in the repo.

### 4. Single Active Watch Per Renderer

`apps/desktop/src/main.ts#L1196` tracks watched sessions by `sender.id`, effectively giving one active watched session per renderer.

That is acceptable for the current single-thread main view, but it is a scaling limit for:

1. split-screen local runs,
2. background local runs with live progress,
3. future task grids,
4. task previews.

### 5. Global Workspace Mutation

Selecting a thread from another workspace mutates the app-wide shell workspace.

That will fight a true Cursor-3-style multi-task surface if left unchanged.

## What To Borrow From `opencode-cursor`

The user explicitly pointed at `https://github.com/Nomadcxx/opencode-cursor`.

That repo is useful as a pattern reference, not as a runtime template.

### Worth Borrowing

1. strong boundary thinking between model runtime and tool/runtime adaptation,
2. structured error classification for auth/model/quota/network failures,
3. first-class treatment of tool outputs and runtime artifacts,
4. the idea that a higher-level product can sit above an existing runtime.

### Do Not Copy

1. do not make `cursor-agent` the new runtime,
2. do not use Cursor auth files as the source of truth,
3. do not add an OpenAI-compatible proxy as the architectural center,
4. do not mirror its auth hook model, because Pi already owns auth in this repo,
5. do not tie model discovery to an external Cursor CLI.

The correct reading is: `opencode-cursor` shows how a product can wrap an external runtime. In `c-glass`, Pi is already that runtime.

## How `agent-browser` Fits

`agent-browser` is a good fit for this repo, but only as a capability layer.

The correct way to think about it is:

1. Pi remains the planner and session executor,
2. browser automation becomes a tool or sidecar capability,
3. browser session state is operational state, not provider-auth truth,
4. browser security controls should be explicit because browser automation is prompt-injection-sensitive.

The strongest relevant `agent-browser` features are:

1. session and profile persistence,
2. secure auth vault patterns,
3. config layering from user and project scope,
4. allowlists and confirmation gates,
5. browser skills that make the tool useful to agent runtimes.

If integrated, browser artifacts should become first-class review objects beside diffs and edited files.

## Recommended Architecture Direction

The primary recommendation is simple:

Build a Composer orchestration layer above Pi instead of replacing Pi.

### Keep Pi Responsible For

1. local agent execution,
2. provider/model auth,
3. model registry/defaults,
4. skill and prompt-template support,
5. session persistence.

### Add A New Composer Layer Responsible For

1. task identity,
2. run lifecycle,
3. runtime selection such as `pi-local` now and `cloud` later,
4. artifact derivation,
5. blocker state,
6. handoff metadata,
7. review state.

This should likely become a new desktop service exposed through preload and contracts rather than a web-only abstraction.

## Minimum Credible Implementation Plan

### Stage 0

Done in this pass.

1. fix OAuth recovery in the live composer path,
2. allow in-flow retry of blocked actions.

### Stage 1

Introduce a minimal `composer` contract and service.

Start with:

1. `ComposerTask`,
2. `ComposerRun`,
3. `ComposerArtifact`,
4. `ComposerBlocker`.

The implementation can still be one task mapped to one Pi session.

### Stage 2

Wrap Pi as the first runtime implementation.

That means:

1. Composer creates a task,
2. a local Pi run is attached to it,
3. Pi events are translated into task/run/artifact state,
4. the web UI stops depending directly on raw session mechanics for product behavior.

### Stage 3

Promote review artifacts.

Unify:

1. touched files from tool calls,
2. git diff state,
3. session logs,
4. later screenshots/browser traces.

### Stage 4

Decouple task workspace from global shell workspace.

This is the real prerequisite for more advanced multi-workspace behavior.

### Stage 5

Add browser capability through `agent-browser` or an equivalent tool lane.

### Stage 6

Add a cloud runtime only after the Composer service exists.

## Top Risks To Watch

### 1. OAuth Prompt Handling In Electron Main Is Still Singleton-Like

`apps/desktop/src/main.ts` still has a global `oauthPromptResolve` callback.

That is workable for the current single-flow model, but it is not ideal for future parallel auth prompts or multi-window behavior.

### 2. Task Identity Is Still Missing

Even after the OAuth fix, the core app model is still `session-centric`, not `task-centric`.

### 3. Global Workspace Mutation Limits Parallelism

This is the largest architecture friction relative to Cursor 3.

### 4. Session Cache Lifetime Needs Policy Later

`PiSessionService` caches open sessions for reuse. That is fine now, but future task grids or longer-lived agents will need disposal policy.

## Cursor OAuth Investigation: `oh-my-pi` / `h-my-pi`

The user pointed to `oh-my-pi/packages/ai/src/utils/oauth/cursor.ts` as a likely learning source.

That code is valuable, but the important conclusion is that it is not a standalone drop-in for `c-glass`.

### What The `oh-my-pi` Cursor File Actually Does

`packages/ai/src/utils/oauth/cursor.ts` in `oh-my-pi` implements Cursor-specific OAuth mechanics.

It includes:

1. PKCE generation and Cursor login URL construction against `https://cursor.com/loginDeepControl`,
2. polling against `https://api2.cursor.sh/auth/poll`,
3. refresh exchange against `https://api2.cursor.sh/auth/exchange_user_api_key`,
4. token expiry parsing for proactive refresh.

That is only one layer of the implementation.

### What Surrounds It In `oh-my-pi`

In `oh-my-pi`, the Cursor OAuth helper sits inside a full provider stack.

That repo also has:

1. a built-in OAuth registry entry for `cursor` in `packages/ai/src/utils/oauth/index.ts`,
2. `AuthStorage.login()` support for `case "cursor"` in `packages/ai/src/auth-storage.ts`,
3. a Cursor transport in `packages/ai/src/providers/cursor.ts`,
4. Cursor model discovery via `GetUsableModels` in `packages/ai/src/utils/discovery/cursor.ts`,
5. bundled Cursor models using `api: "cursor-agent"` in `packages/ai/src/models.json`.

The OAuth file only makes sense because the rest of that provider/runtime stack already exists.

### How `c-glass` Auth Works Today

The current `c-glass` auth path is already clean and Pi-first.

1. the frontend trigger lives in `apps/web/src/components/glass/use-pi-session.ts`,
2. the bridge call is `startPiOAuthLogin()` in `apps/web/src/lib/pi-models.ts`,
3. Electron handles it through `PI_START_OAUTH_LOGIN_CHANNEL` in `apps/desktop/src/main.ts`,
4. the backend delegates to `PiConfigService.oauthLogin()` in `apps/desktop/src/pi-config-service.ts`,
5. `PiConfigService` derives `oauthSupported` from Pi auth storage and model registry state,
6. the provider-auth overlay simply reflects whatever Pi says is available.

That means Glass already has the right control plane. The missing piece is provider capability, not auth UI plumbing.

### Why The `oh-my-pi` File Is Not Directly Usable Here

The installed upstream Pi packages in this repo do not currently ship built-in Cursor support.

Evidence from the local dependency set in `apps/desktop/node_modules/@mariozechner/pi-ai`:

1. `dist/types.d.ts` does not include `cursor` in `KnownProvider`,
2. `dist/types.d.ts` does not include `cursor-agent` in `KnownApi`,
3. `dist/utils/oauth/index.d.ts` exports built-in OAuth providers like Anthropic, Copilot, Gemini CLI, Antigravity, and OpenAI Codex, but no Cursor OAuth,
4. `README.md` only documents those built-in OAuth providers,
5. `dist/models.generated.js` has no bundled `cursor` models.

So copying only `oh-my-pi/packages/ai/src/utils/oauth/cursor.ts` into this repo would not make Cursor appear in Pi config, would not make `oauthSupported` become true, and would not give Pi a Cursor transport or model list.

### Important Compatibility Nuance

The situation is not binary.

The installed `@mariozechner/pi-coding-agent` does have a useful seam:

1. `ModelRegistry.registerProvider(...)` supports dynamic provider registration,
2. that registration can include `oauth`, `models`, and `streamSimple`,
3. the custom-provider docs explicitly support `/login` integration for extension-registered providers.

So the right reading is:

1. the `oh-my-pi` Cursor code is not directly usable as a lone file,
2. it is a strong reference pattern,
3. it could become compatible with `c-glass` if Cursor is added as a Pi-side custom provider while Pi remains the source of truth for auth and models.

### Recommended Next Step

Do not adapt Glass to use Cursor auth files directly.

Do not replace Pi auth/runtime with `cursor-agent` or Cursor-native config.

If actual Cursor support is pursued, the next implementation step should be Pi-side provider registration, not auth-UI work.

The likely path is:

1. add a local Cursor provider registration module on the desktop side,
2. register `cursor` into Pi's `ModelRegistry` with OAuth callbacks and model definitions,
3. implement a custom Cursor stream transport using Pi's `streamSimple` provider seam or upgrade to a Pi build that already includes Cursor transport support,
4. keep the existing Glass auth flow unchanged so `use-pi-session.ts`, `startPiOAuthLogin()`, `main.ts`, and `PiConfigService.oauthLogin()` continue to be the only control path.

This preserves the established architecture decision:

1. Pi remains the runtime/auth backbone,
2. Cursor support is treated as another Pi-managed provider,
3. Glass stays a product layer above Pi instead of becoming a thin wrapper around Cursor internals.

## Suggested Next Engineering Moves

1. Add `packages/contracts/src/composer.ts` and a matching preload bridge.
2. Create `apps/desktop/src/composer-service.ts` that wraps `PiSessionService`, `PiConfigService`, `ShellService`, and `GitService`.
3. Make the web shell consume composer tasks instead of directly using raw Pi summaries as the product primitive.
4. Keep Pi auth as the only auth source of truth.
5. Add browser tooling only after the Composer service exists so browser output can become a task artifact instead of a side experiment.

## Files To Start With Next Time

### Frontend

1. `apps/web/src/routes/__root.tsx#L40`
2. `apps/web/src/components/glass/glass-chat-shell.tsx#L25`
3. `apps/web/src/components/glass/use-pi-session.ts#L58`
4. `apps/web/src/components/glass/glass-pi-composer.tsx#L303`
5. `apps/web/src/lib/pi-session-store.ts`
6. `apps/web/src/lib/pi-models.ts`

### Desktop

1. `apps/desktop/src/preload.ts#L139`
2. `apps/desktop/src/main.ts#L1196`
3. `apps/desktop/src/main.ts#L1229`
4. `apps/desktop/src/main.ts#L1362`
5. `apps/desktop/src/main.ts#L1422`
6. `apps/desktop/src/pi-session-service.ts#L741`
7. `apps/desktop/src/pi-config-service.ts#L74`

### Contracts

1. `packages/contracts/src/ipc.ts#L7`
2. `packages/contracts/src/pi.ts#L98`
3. `packages/contracts/src/session.ts#L253`
4. `packages/contracts/src/session.ts#L278`
5. `packages/contracts/src/session.ts#L351`

## Bottom Line

`c-glass` should not chase Cursor by replacing Pi with Cursor internals.

It should become more Cursor-like by doing three things well:

1. keep Pi as the runtime and auth backbone,
2. add a Composer orchestration layer above it,
3. treat diffs, plans, blockers, browser runs, and review state as first-class task artifacts.

That path is thin, incremental, and already aligned with the code that exists in this repo today.
