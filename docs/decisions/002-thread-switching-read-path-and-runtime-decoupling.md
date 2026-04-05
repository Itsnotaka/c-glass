# ADR-002: Thread Switching Must Stay a Read Path While Runtime Work Continues

- **Status**: Accepted
- **Date**: 2026-04-05
- **Authors**: Daniel

## Context

This ADR records a product and architecture decision that came out of a performance review of Glass thread switching.

The immediate trigger was a comparison to `t3code`: thread selection there feels nearly instant, while Glass can feel slow when opening or switching threads, especially under real usage where another task may already be running.

This matters more than a cosmetic polish issue.

Glass is unreleased. The codebase is still malleable. That means the team has a narrow but important window to make the canonical decision before the current behavior hardens into the public product shape.

The relevant recent background is:

1. The app has already gone through meaningful TanStack Router layout work so the shell can support dynamic route loading, better styling boundaries, and a cleaner shell-layout split.
2. There has already been experimental work around snapshots.
3. The real user need is not "add snapshots because t3code has snapshots." The real user need is "a task can keep running without the app lagging when the user switches threads."
4. Therefore the governing question is not "should Glass copy t3code's architecture?" The governing question is "what architecture keeps thread selection cheap while preserving an active live runtime?"

This ADR answers that question.

## Conversation Decider

This section is the authoritative summary of the decision made in this conversation. The next agent should treat it as normative, not as brainstorming.

### Decider Summary

Glass must preserve active runtime work while making thread selection cheap.

That means:

1. A running task must be allowed to continue even when the user navigates away from its thread.
2. Switching threads must not require reconstructing a live agent runtime in the hot path.
3. Snapshotting is allowed and encouraged on the read path, but snapshotting is not the real product decision. Runtime decoupling is.
4. Recent TanStack Router shell and layout improvements must not be reverted in the name of performance.
5. Any implementation that makes route changes, shell changes, or thread changes feel slower while a task is running is a regression.
6. That regression is release-blocking.

### What This Means In Plain Language

The app should behave like a workspace with background work, not like a single foreground chat session that has to be fully rebuilt whenever the visible route changes.

The user should be able to:

1. start a task,
2. leave that thread,
3. inspect another thread,
4. return,
5. and observe that the original task kept running and the UI did not stall during navigation.

If Glass cannot do that smoothly, it is not yet in the right product architecture.

## The Specific Problem

Today, Glass has a mismatch between its visible shell architecture and its runtime architecture.

### What Has Improved Already

The TanStack Router shell split is in a better place than before.

The app currently has a meaningful route-owned shell structure:

1. `apps/web/src/routes/_chat/route.tsx` owns the shared `SidebarInset` and shell overlay.
2. `apps/web/src/routes/_chat/_shell/route.tsx` mounts the normal chat shell.
3. `apps/web/src/routes/_chat/settings/route.tsx` mounts the settings shell.
4. `apps/web/src/components/glass/glass-chat-shell.tsx` owns the chat workspace shell.
5. `apps/web/src/components/glass/glass-settings-shell.tsx` owns the settings workspace shell.

That is good. It is the right direction. It separates structure from branchy pathname logic and gives Glass a cleaner basis for dynamic loading, styling boundaries, and future shell growth.

This ADR explicitly protects that work.

### What Still Hurts

Although the route and shell structure improved, thread selection still crosses into expensive runtime work.

At a high level, the current flow is:

1. Boot preload gives the renderer config and summary data.
2. The thread rail renders from summary state.
3. Selecting a thread triggers a session watch call.
4. A cold watch can fall through into session open and runtime reconstruction.
5. That reconstruction reloads resources and rebuilds a live Pi agent session.

That is the core mismatch.

The shell looks like a workspace that should allow cheap navigation. The runtime still behaves like the selected route is the only durable way to access the thread.

## Current Evidence In The Codebase

This section documents the local evidence behind the decision.

### Boot State Is Summary-Only

The frontend boot store currently hydrates from preload boot config and boot summaries:

- `apps/web/src/lib/pi-session-store.ts#L159-L168`
- `apps/desktop/src/preload.ts#L60-L69`
- `apps/desktop/src/preload.ts#L96-L103`

That means the thread rail gets fast initial data, but the renderer does not receive full thread snapshots for every thread at boot.

### Selecting A Thread Calls `watch()`

The current thread session hook watches the selected thread on route change:

- `apps/web/src/components/glass/use-pi-session.ts#L112-L131`

That is the visible handoff from route selection into runtime attachment.

### Cold `open()` Performs More Work Than It Should

On the desktop side, a cold open currently goes through `listAll()` before loading the chosen session:

- `apps/desktop/src/pi-session-service.ts#L1102-L1112`

This means a thread open is not just "open the selected thread." It is also "rescan session metadata globally enough to find the file path again."

### `load()` Rebuilds Live Session State

Once a session is opened, Glass rebuilds live Pi session infrastructure:

- `apps/desktop/src/pi-session-service.ts#L1036-L1059`

That path currently includes:

1. `cfg.sync()`
2. settings lookup
3. `DefaultResourceLoader` creation
4. `loader.reload()`
5. `createAgentSession(...)`

That is far too heavy for a thread selection hot path.

### The Underlying Pi Session APIs Are File-Heavy

The underlying session manager behavior reinforces the cost profile.

In Pi:

1. `SessionManager.listAll()` parses every session file and builds summary text, including `allMessagesText`: `node_modules/.pnpm/@mariozechner+pi-coding-agent@0.64.0_ws@8.20.0/node_modules/@mariozechner/pi-coding-agent/dist/core/session-manager.js#L320-L380` and `#L1053-L1081`.
2. `SessionManager.open(path)` parses the target file to find header data: `.../session-manager.js#L968-L975`.
3. `setSessionFile(...)` parses the file again into manager state: `.../session-manager.js#L451-L458`.

That means a cold thread switch can compound multiple file-parse and runtime-rebuild costs.

### Rendering Cost Also Exists

The UI side is not the primary problem, but it is a secondary multiplier.

Glass currently renders message content eagerly and uses expensive components directly in the thread transcript path:

- `apps/web/src/components/glass/glass-pi-chat-rows.tsx#L247-L258`
- `apps/web/src/components/glass/glass-pi-chat-rows.tsx#L585-L595`
- `apps/web/src/components/glass/glass-pi-messages.tsx#L6-L60`

That means even after the runtime work completes, large threads can still pay a render penalty.

## Why `t3code` Feels Faster

This ADR does not propose copying `t3code` wholesale. It does document the key structural lesson.

`t3code` feels fast because thread selection is primarily a read-model lookup, not a runtime reconstruction step.

The comparison that matters is conceptual:

1. `t3code` gets an orchestration snapshot and hydrates client state from it.
2. The UI selects the current thread from an already-materialized store.
3. Its timeline rendering is also virtualized.

The lesson is not "Glass must become t3code."

The lesson is:

1. cheap read state and live runtime state are separate concerns,
2. a workspace UI should select from read state first,
3. and only attach heavy runtime behavior when genuinely needed.

## Decision

Glass will treat thread selection as a read path and live agent execution as a separate runtime path.

### Primary Decision

The selected route must not be the trigger that reconstructs a Pi runtime unless there is no cheaper way to serve the user-visible state.

Concretely, this means:

1. thread selection should render from cached persisted state whenever possible,
2. a live `AgentSession` should be attached separately from the basic act of making a thread visible,
3. a running thread must continue independently of whether it is the selected route,
4. thread switching must remain cheap even while another task is streaming.

### Supporting Decisions

#### 1. Preserve The Current Router Shell Split

The current route-owned shell structure is the correct foundation and must not be collapsed back into ad hoc branching.

Do not revert:

1. `/_chat` as the shared app shell boundary,
2. `/_chat/_shell` as the chat shell route,
3. `/_chat/settings` as the settings shell route,
4. the separation between `GlassChatShell` and `GlassSettingsShell`.

Performance work must fit inside this structure.

#### 2. Read State And Runtime State Are Different Products

Glass needs two distinct layers of thread state.

Read state is for:

1. sidebar listing,
2. thread titles,
3. last activity,
4. transcript preview,
5. route selection,
6. fast render of a non-active thread.

Runtime state is for:

1. streaming,
2. prompt submission,
3. slash command execution,
4. tool execution,
5. live pending state,
6. model and thinking changes on an attached live session.

These must not be conflated.

#### 3. Snapshots Are A Means, Not The Goal

Snapshotting remains valid and useful, but only as part of the read path.

The important product behavior is:

1. background work keeps running,
2. thread switching stays fast,
3. the user never feels like the app has to "wake up" the selected thread just to show it.

Therefore snapshotting is a tool that serves runtime decoupling. It is not the decision by itself.

#### 4. Performance Regressions During Active Work Are Release-Blocking

A regression is any change that causes thread switching, route switching, or shell switching to noticeably stall while another task is running.

This is not a future optimization ticket. It is a launch-quality constraint.

## Non-Negotiable Invariants

The next agent should work under these invariants.

### Invariant A: Switching Threads Must Not Cold-Rebuild A Runtime By Default

The hot path for thread selection must not perform any of the following unless explicitly unavoidable and instrumented:

1. `DefaultResourceLoader.reload()`
2. `createAgentSession(...)`
3. a global `listAll()` scan
4. a full workspace-wide session parse sweep

### Invariant B: A Running Task Must Survive Navigation

If a task is already running in Thread A and the user switches to Thread B:

1. Thread A must keep running.
2. Its events must still be captured.
3. Returning to Thread A must show the accumulated progress.
4. Selecting Thread B must not be blocked by Thread A's continued execution.

### Invariant C: TanStack Router Structure Is Not The Enemy

Do not "fix" performance by flattening the route tree, collapsing shells, or moving shell ownership back into pathname conditionals.

The router structure is a solved problem relative to this performance issue.

### Invariant D: Read Path First, Runtime Attach Second

If a thread has enough persisted data to render a useful view, render it immediately from read state.

Attach live runtime behavior afterward if needed.

### Invariant E: Long Threads Need Render Guardrails

Even after the runtime path is fixed, long transcripts cannot eagerly mount all expensive content.

Virtualization or equivalent windowing is part of the canonical direction.

## Architectural Consequences

### What Glass Should Become

Glass should behave like a local workspace with background task execution.

That implies a model like this:

1. summary index for all threads,
2. lightweight read snapshot per thread,
3. live runtime attachment for some subset of threads,
4. event buffering and store updates independent of visible route,
5. UI selection reading from cached state,
6. runtime lifecycles managed separately from route lifecycles.

### What Glass Should Not Become

Glass should not become:

1. a single visible-session app where route selection is the only way to get state,
2. a shell that pays full runtime reconstruction cost on every thread switch,
3. a system that regains speed by undoing the router and shell improvements,
4. a product where active work pauses or appears paused because the user navigated away.

## Implementation Direction For The Next Agent

This section intentionally goes beyond diagnosis. It is a recommended execution order for the next agent.

### Phase 1: Measure The Current Hot Path

Add instrumentation before changing architecture.

Measure at least:

1. thread selection start in renderer,
2. `glass.session.watch(...)` invocation,
3. desktop `open(sessionId)` entry,
4. `listAll()` start and end,
5. `SessionManager.open(...)` start and end,
6. `loader.reload()` start and end,
7. `createAgentSession(...)` start and end,
8. first snapshot delivered to renderer,
9. first paint of selected thread.

Output should clearly distinguish:

1. warm open,
2. cold open,
3. thread switch while another thread is streaming,
4. thread switch across workspace boundaries,
5. long-thread render cost after data arrival.

Do not optimize blind.

### Phase 2: Remove `listAll()` From Cold Thread Open

The current `open(sessionId)` path should stop doing a global rescan when the file path is already knowable.

Preferred direction:

1. retain an in-memory `sessionId -> summary/path` index from boot and summary refresh,
2. resolve the file path from that index,
3. open directly,
4. avoid re-deriving the path by rescanning all sessions.

This is likely the lowest-risk first improvement.

### Phase 3: Introduce A Read Snapshot Layer For Thread Content

Add a thread content read layer that is cheaper than full runtime attachment.

The next agent should evaluate one of these shapes:

1. a persisted transcript snapshot stored alongside the session summary,
2. a desktop-side cache of parsed session snapshots keyed by session id and file mtime,
3. a lightweight replay/read API over session files that does not construct a full `AgentSession`.

The required property is not the exact storage format. The required property is that selecting a thread can render useful content without reloading extensions and re-creating a live session.

### Phase 4: Attach Runtime Lazily And Independently

Live runtime attach should become a separate concern from basic rendering.

That means:

1. a selected thread can render from read state first,
2. a live session attach can happen afterward if the thread is active or about to send,
3. a background-running thread can keep emitting events into store state even when unselected,
4. route unmounts or route switches should not imply runtime disposal for active work.

### Phase 5: Add Transcript Virtualization

Once the runtime path is decoupled, address render cost on large threads.

The simplest rule is:

1. do not eagerly render the entire transcript when only a viewport subset is visible,
2. do not eagerly mount expensive markdown and diff renderers for fully offscreen rows.

### Phase 6: Lock In Perf Guardrails

Add a regression checklist or automated instrumentation harness for:

1. cold open latency,
2. warm open latency,
3. switching away from a running thread,
4. returning to a running thread,
5. long transcript render stability.

If possible, surface thresholds in developer docs so future agents know what counts as a regression.

## Risks And Tradeoffs

### Positive Consequences

1. Thread switching becomes predictably fast.
2. Active tasks can continue in the background.
3. The current router shell structure remains intact.
4. The product behavior better matches user expectations for a modern agent workspace.
5. Future work like review panes, artifact panes, and background-task lanes becomes easier because the runtime is no longer welded to the selected route.

### Negative Consequences

1. The architecture becomes more explicit and therefore more complex.
2. A second state layer means more care around cache invalidation and consistency.
3. The team will need clear rules for when a thread has read state only versus live runtime attached.
4. Background runtime ownership must be managed carefully to avoid leaks.

### Concrete Risks

1. A naive cache can show stale data if file mtimes or active event streams are not reconciled correctly.
2. Background session retention can create memory pressure if Glass keeps too many live sessions attached.
3. A partial decoupling can produce the worst of both worlds if route selection still sometimes falls into runtime reconstruction unpredictably.
4. Virtualization can introduce UX bugs around auto-scroll and live updates if added without careful message-row design.

## What Not To Do

The next agent should not do any of the following without a very strong reason.

1. Do not revert the TanStack Router shell split to chase performance.
2. Do not treat snapshotting as a complete answer while leaving runtime attachment coupled to route selection.
3. Do not optimize only the sidebar if opening the thread still rebuilds runtime state.
4. Do not assume a single-thread foreground mental model. The desired product is multi-thread and background-friendly.
5. Do not add heavyweight abstractions before measuring where the hot path actually spends time.
6. Do not introduce a full remote orchestration server just because `t3code` has a richer read model. Glass should solve the problem in the smallest local architecture that preserves the desired behavior.

## Acceptance Criteria

A future implementation should not be considered complete unless all of the following are true.

1. Starting a task in Thread A and switching to Thread B does not produce noticeable UI lag.
2. Thread A continues running while Thread B is visible.
3. Returning to Thread A shows progress accumulated while it was in the background.
4. Selecting a non-running thread does not trigger a full runtime rebuild in the hot path.
5. The route and shell split introduced by the current TanStack Router structure remains intact.
6. Long threads remain responsive enough that transcript rendering does not become the new dominant bottleneck.

## Pointers For The Next Agent

Start with these local files:

1. `apps/web/src/components/glass/use-pi-session.ts`
2. `apps/web/src/lib/pi-session-store.ts`
3. `apps/desktop/src/pi-session-service.ts`
4. `apps/desktop/src/main.ts`
5. `apps/desktop/src/preload.ts`
6. `apps/web/src/components/glass/glass-chat-shell.tsx`
7. `apps/web/src/components/glass/glass-settings-shell.tsx`
8. `apps/web/src/components/glass/glass-pi-messages.tsx`
9. `apps/web/src/components/glass/glass-pi-chat-rows.tsx`

Keep the following framing in mind while working:

1. route selection is a UI concern,
2. runtime attachment is an execution concern,
3. persisted thread state is a read-model concern,
4. these concerns should cooperate, but they should not be forced through the same hot path.

## Final Decision Statement

Glass will not optimize thread switching by undoing the recent router and shell work, nor by pretending snapshots alone are the product answer.

Glass will optimize thread switching by separating read-path thread access from live runtime attachment, so active work can continue while the user navigates freely.

That is the canonical direction recorded by this ADR.
