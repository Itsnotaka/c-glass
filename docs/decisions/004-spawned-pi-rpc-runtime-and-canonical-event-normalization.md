# ADR-004: Spawn Pi as an RPC Runtime and Normalize Its Event Stream Into Canonical Glass State

- **Status**: Accepted
- **Date**: 2026-04-06
- **Authors**: Daniel

## Context

Glass is currently built by embedding Pi directly inside the Electron desktop process.

That path gave the app early velocity because it allowed direct use of Pi internals:

1. `createAgentSession(...)`
2. `SessionManager`
3. `SettingsManager`
4. `ModelRegistry`
5. `AuthStorage`
6. `ExtensionRunner`
7. `DefaultResourceLoader`

This is the shape visible today in local runtime code such as:

1. `apps/desktop/src/pi-session-service.ts`
2. `apps/desktop/src/pi-config-service.ts`
3. `apps/desktop/src/main.ts`
4. `apps/desktop/src/preload.ts`

That embedding path worked, but it now creates the wrong long-term architecture for an unreleased product that still needs to become canonical.

The main issue is not that Pi is a bad runtime. The issue is that Glass currently crosses too many layers directly:

1. desktop code knows too much about Pi internals,
2. runtime state and UI-facing state are too tightly coupled,
3. replacing or upgrading runtime behavior requires touching app-specific logic,
4. and native Glass adaptations are mixed with embedded Pi lifecycle wiring.

At the same time, the `t3code` reference demonstrates a cleaner boundary for agent runtimes:

1. spawn an external runtime process,
2. speak its supported protocol,
3. normalize raw runtime events into a canonical app event model,
4. and let the UI consume only canonical state.

`t3code` does this by wrapping external runtimes like Codex app-server and Claude behind a provider adapter and canonical runtime events.

The important lesson is not “copy Codex.”

The important lesson is:

1. the app should not directly depend on runtime-specific message shapes,
2. the UI should consume canonical events and derived state,
3. and the runtime boundary should be explicit.

Pi already supports two subprocess-friendly JSON-producing modes:

1. `pi --mode rpc`
2. `pi --mode json`

For Glass, these are not equivalent.

RPC mode provides the full application protocol Glass needs:

1. `pi --mode rpc`
2. JSONL framing over stdin/stdout
3. command/response semantics
4. event streaming semantics
5. extension UI request/response support
6. long-lived session control
7. session switching, forking, and state reads

JSON mode is useful for one-shot event streaming, shell pipelines, and simple integrations, but it is not a full runtime control plane.

Because Glass is unreleased, now is the correct moment to make the canonical decision.

## Conversation Decider

This section is the authoritative summary of the decision made in this conversation. The next agent should treat it as normative.

### Decider Summary

Glass will stop treating embedded Pi internals as the canonical runtime integration model.

Glass will instead:

1. spawn Pi as a child process,
2. run it in RPC mode as the canonical runtime protocol,
3. not use JSON mode as the primary runtime integration,
4. parse its JSONL responses and events through a strict protocol layer,
5. normalize those raw Pi RPC events into canonical Glass runtime events,
6. derive the existing Glass session/config state from those canonical events,
7. and only then expose state to the web renderer.

### What This Means In Plain Language

Glass will still use Pi as its runtime backbone.

But Glass will no longer wire its product directly to Pi’s in-process classes.

Instead, Glass will behave like a host application that runs Pi out-of-process and translates Pi’s runtime stream into a stable, app-owned contract.

### Important Constraint

This migration must preserve as much of the current Glass-facing web contract as possible during transition.

That means:

1. the desktop/runtime boundary changes first,
2. the web app should keep consuming stable Glass contracts where possible,
3. and the runtime normalization layer absorbs the protocol change.

The product is unreleased, but the architecture should still migrate in a disciplined order.

## Decision

Glass will adopt a spawned Pi runtime architecture based on Pi RPC mode, with a canonical event normalization layer inspired by the runtime boundary discipline used in `t3code`.

### Primary Decision

The canonical runtime architecture for Glass is:

1. **Pi subprocess** for execution,
2. **RPC protocol client** for control,
3. **desktop normalization layer** for canonical event mapping,
4. **desktop-owned derived state** for sessions/config/runtime status,
5. **web-facing contracts** that remain Glass-native.

### Supporting Decisions

#### 1. Use Pi RPC as the Canonical Runtime Protocol

Glass must not parse Pi’s interactive-mode output or terminal rendering.

Glass must use Pi’s supported subprocess protocol:

1. `pi --mode rpc`
2. strict JSONL framing
3. command/response handling
4. event stream handling
5. extension UI request/response handling when needed
6. session control commands like prompt, abort, get_state, get_messages, switch_session, new_session, and fork

`pi --mode json` is explicitly rejected as the primary Glass runtime protocol. JSON mode is event-stream output for one-shot or simple integrations. It is not the canonical control plane for a long-lived desktop agent host.

The runtime boundary must be protocol-based, not stdout-scraping.

#### 2. Introduce a Canonical Runtime Event Layer

Desktop will not pipe raw Pi RPC events directly to the web app.

Desktop will:

1. receive raw Pi RPC events,
2. classify and normalize them,
3. emit canonical Glass runtime events,
4. build session/config snapshots from those canonical events,
5. expose only canonical state through preload and IPC.

This mirrors the core boundary lesson from `t3code`.

#### 3. Preserve Existing Web-Facing State Shapes During Migration

The current renderer state should not be rewritten first.

During migration, desktop should continue to produce Glass session/config DTOs equivalent to the current renderer contract wherever possible, especially around:

1. session summaries,
2. session snapshots,
3. active streaming deltas,
4. ask state,
5. config/defaults/provider state.

The runtime integration layer is the part that changes first.

#### 4. Special Cases Like `ask` Remain Glass-Native Adaptations

Moving Pi out of process does not mean Glass must behave like Pi’s terminal UI.

The `ask` tool remains a Glass-native adaptation:

1. Pi runtime requests user input,
2. Glass parses and normalizes it,
3. the Electron/React app renders native UI,
4. the user response goes back through RPC,
5. the web app does not pretend to support full Pi TUI semantics.

#### 5. Desktop Becomes the Runtime Host and Translator

The renderer must not own Pi RPC details.

`apps/desktop` becomes the host layer that:

1. launches Pi,
2. supervises the subprocess,
3. sends commands,
4. receives events,
5. handles restarts/errors,
6. maintains normalized state,
7. exposes preload bridge methods.

This is the same boundary pattern that `t3code` uses between app UI and runtime adapters.

## Why This Decision Wins

### Why Not Keep Embedded Pi as Canonical

The embedded SDK path gives direct access, but it keeps Glass too close to Pi internals.

That creates long-term problems:

1. runtime upgrades are harder,
2. app logic and runtime logic stay mixed,
3. process isolation is weaker,
4. restart/recovery semantics are less explicit,
5. canonical protocol boundaries never form.

### Why Not Scrape JSON Events Loosely

“Spawn Pi and read JSON events” is directionally correct but not precise enough.

There is a canonical and a non-canonical version of that plan.

The non-canonical version is:

1. launch Pi,
2. parse whatever comes out,
3. let that leak into app state.

The canonical version is:

1. use Pi RPC mode,
2. treat commands/responses/events as protocol records,
3. normalize them to app-owned contracts,
4. keep runtime-specific shapes behind the adapter.

Glass must use the canonical version.

### Why Not Use Pi JSON Mode as the Main Runtime

Pi JSON mode emits events as JSON lines and is useful for:

1. one-shot prompts,
2. shell pipelines,
3. diagnostics,
4. simple batch integrations.

It is not the right canonical runtime mode for Glass because Glass needs a long-lived control protocol for:

1. prompt submission,
2. abort,
3. steering and follow-ups,
4. current state reads,
5. session switching,
6. forking,
7. extension UI request/response handling,
8. user-input round-tripping.

Those are RPC concerns, not JSON stream concerns.

Using JSON mode as the primary runtime would force Glass to either:

1. give up app-level runtime control, or
2. rebuild a partial RPC protocol on top of a mode that is not intended to be the main desktop control plane.

That would be less canonical than using Pi RPC directly.

### Why This Is Better Than a Full Web Rewrite

This ADR explicitly prefers a migration that minimizes renderer churn.

That means:

1. desktop changes first,
2. normalization happens in desktop,
3. web contracts stay stable until a future deliberate redesign,
4. the app can continue shipping current features while the runtime boundary is cleaned up.

## Canonical Target Architecture

The target architecture is:

```text
React Renderer
  -> preload bridge
    -> desktop runtime host
      -> Pi RPC client
        -> spawned `pi --mode rpc`
```

The most important boundary is inside desktop:

```text
Pi RPC protocol
  -> raw event parser
    -> canonical Glass runtime events
      -> derived Glass session/config state
        -> preload bridge
          -> renderer stores/hooks/components
```

This is the architecture that should guide implementation.

## Required Monorepo Boundaries

The implementation must follow current monorepo discipline.

### `packages/contracts`

Contracts must define the stable shapes that cross the desktop/web boundary.

These should remain the source of truth for:

1. session summaries,
2. session snapshots,
3. active session deltas,
4. ask state,
5. config state,
6. any new canonical runtime event contract if introduced across app boundaries.

If new runtime event or bridge contracts are added, they must be defined here first.

### `packages/shared`

Shared should hold:

1. pure mapping helpers,
2. runtime classification enums or string unions if reused,
3. protocol-independent helpers.

Shared must not own:

1. child process lifecycle,
2. Electron IPC,
3. React state,
4. file-system scanning side effects.

### `apps/desktop`

Desktop owns:

1. child process lifecycle,
2. RPC framing,
3. raw event parsing,
4. canonical event normalization,
5. derived session/config caches,
6. preload/IPC bridge exposure,
7. restart/recovery policy.

### `apps/web`

Web owns:

1. route/UI state,
2. renderer stores,
3. React components,
4. Glass-native pending interaction UIs like `ask`,
5. no Pi RPC details.

## Canonical Runtime Layers

The desktop runtime host should be split into explicit layers.

### Layer 1: Pi Process Manager

This layer owns the subprocess.

Responsibilities:

1. spawn Pi in RPC mode,
2. configure cwd/session/runtime flags,
3. supervise stdout/stderr,
4. shut down cleanly,
5. restart intentionally,
6. surface fatal process failures.

Suggested file shape:

1. `apps/desktop/src/pi-runtime/pi-process-manager.ts`

### Layer 2: Pi RPC Client

This layer owns protocol correctness.

Responsibilities:

1. write JSONL commands,
2. parse JSONL responses and events,
3. correlate command ids,
4. support subscriptions,
5. expose typed operations,
6. enforce protocol framing rules.

Suggested file shape:

1. `apps/desktop/src/pi-runtime/pi-rpc-client.ts`
2. `apps/desktop/src/pi-runtime/pi-rpc-types.ts`

### Layer 3: Raw Pi Event Intake

This layer receives Pi RPC events and classifies them.

Responsibilities:

1. separate responses from events,
2. identify agent lifecycle events,
3. identify tool lifecycle events,
4. identify user-input events,
5. identify runtime errors/warnings,
6. preserve raw payloads for diagnostics.

Suggested file shape:

1. `apps/desktop/src/pi-runtime/pi-rpc-event-parser.ts`

### Layer 4: Canonical Glass Event Normalization

This is the `t3code`-inspired layer.

Responsibilities:

1. map raw Pi RPC events into canonical Glass runtime events,
2. preserve enough detail for debugging,
3. hide Pi-specific protocol quirks from the rest of the app,
4. make future runtime swaps possible.

Suggested file shape:

1. `apps/desktop/src/pi-runtime/pi-runtime-normalizer.ts`

### Layer 5: Derived State Store

This layer turns canonical events into the state the app already understands.

Responsibilities:

1. maintain session summary state,
2. maintain active session snapshots,
3. maintain ask state,
4. maintain config/default/provider state,
5. emit preload bridge events for renderer consumers.

Suggested file shape:

1. `apps/desktop/src/pi-runtime/pi-runtime-store.ts`

### Layer 6: Desktop Bridge Facade

This layer presents the app-facing runtime API.

Responsibilities:

1. mirror current bridge methods where possible,
2. hide subprocess details,
3. translate app commands into Pi RPC commands,
4. serve boot snapshots and live updates.

Suggested file shape:

1. `apps/desktop/src/pi-runtime/pi-runtime-service.ts`

## Canonical Event Strategy

This migration succeeds or fails on event handling discipline.

### Raw Pi Events Are Not App State

Pi RPC events must be treated like provider-native events in `t3code`.

They are runtime input, not application truth.

The app must not let raw event names, sequencing quirks, or payload inconsistencies leak upward.

### Introduce Canonical Glass Runtime Events

Desktop should normalize into a small event vocabulary that matches Glass product concerns.

Illustrative categories:

1. `session.started`
2. `session.state.changed`
3. `session.messages.loaded`
4. `turn.started`
5. `turn.completed`
6. `content.delta`
7. `tool.started`
8. `tool.progress`
9. `tool.completed`
10. `user-input.requested`
11. `user-input.resolved`
12. `runtime.warning`
13. `runtime.error`
14. `config.updated`

These do not need to be exposed to web immediately as a brand-new renderer contract, but desktop should normalize to something equivalent internally.

### Preserve Raw Payloads For Diagnostics

Every normalized event should retain enough raw data to debug parser issues.

The normalized event model should therefore allow:

1. `rawType`
2. `rawPayload`
3. `source`
4. correlation ids where available

This follows the spirit of `t3code`’s provider runtime event model.

## Canonical Compatibility Rule

The migration must preserve the current Glass product semantics unless a deliberate product decision says otherwise.

That means:

1. session rail behavior should remain stable,
2. current routes should not be rewritten first,
3. existing boot snapshot behavior should be preserved or improved,
4. `ask` and similar Glass-native adaptations remain native,
5. provider/default settings UI remains driven by Glass contracts, not raw Pi RPC structures.

## Rejected Alternatives

### Alternative A: Keep Embedded Pi as the Canonical Runtime

Rejected because it keeps Glass coupled too tightly to Pi internals and prevents a clean runtime boundary.

### Alternative B: Spawn Pi and Scrape Interactive Output

Rejected because interactive output is not a protocol contract and would leak terminal behavior into app state.

### Alternative C: Use `pi --mode json` as the Main Runtime Protocol

Rejected because JSON mode is an event-stream output mode, not a full application control protocol.

It is acceptable for:

1. one-shot helpers,
2. diagnostics,
3. experiments,
4. shell-oriented integrations.

It is not acceptable as Glass’s canonical runtime mode because Glass needs:

1. bidirectional control,
2. request/response correlation,
3. session lifecycle control,
4. extension UI request handling,
5. structured user-input round-tripping.

### Alternative D: Rewrite the Renderer First

Rejected because the canonical migration must replace the runtime boundary first and preserve the current Glass-facing contracts during the transition.

## Migration Plan

The implementation order is part of the decision.

### Phase 0: Freeze the Canonical Direction

Before broad code changes:

1. record this ADR,
2. treat spawned Pi RPC as the canonical target,
3. reject new embedding-only features unless they are explicitly temporary.

### Phase 1: Build the Pi RPC Host in Desktop

Create the subprocess host stack without changing the renderer contract yet.

Deliverables:

1. Pi process manager
2. Pi RPC client
3. typed command/response handling
4. event intake
5. restart/shutdown logic

At the end of this phase, desktop must be able to:

1. launch Pi,
2. send prompts,
3. receive streamed events,
4. stop/restart the process.

### Phase 2: Normalize Pi RPC Events Into Canonical Desktop Events

Add the normalization layer.

Deliverables:

1. raw parser
2. canonical runtime event model
3. deterministic mapping rules
4. event logging for debugging

At the end of this phase, desktop should no longer depend on Pi RPC event shapes outside the runtime adapter folder.

### Phase 3: Rebuild Current Glass Session APIs On Top of the New Runtime Store

Re-implement current desktop-facing semantics on top of the spawned runtime.

This phase should preserve current preload/IPC behavior as much as possible.

Deliverables:

1. session summary snapshots
2. active session snapshots
3. active delta events
4. ask state bridging
5. config/default/provider state bridging

At the end of this phase, the renderer should still be able to consume the current Glass session/config hooks with minimal or no changes.

### Phase 4: Swap Desktop Consumers From Embedded Pi to Spawned Pi

Only after desktop replacement semantics are complete should embedded runtime services be retired.

This phase removes or reduces direct dependencies on:

1. `createAgentSession(...)`
2. `SessionManager` as the primary runtime source
3. direct `ExtensionRunner` wiring in app services
4. direct in-process session reconstruction as canonical control flow

At the end of this phase, spawned Pi RPC is the default runtime.

### Phase 5: Reintroduce Glass-Native Enhancements Deliberately

After the runtime boundary is stable, rebuild any feature that relied on internal embedding assumptions.

This includes:

1. `ask`
2. extension compatibility metadata
3. Paper MCP state bridging
4. runtime settings surfaces
5. native Glass preferences around runtime capabilities

These should now sit above the runtime boundary, not inside it.

### Phase 6: Remove Legacy Embedded Runtime Paths

Once parity is achieved, remove the embedded runtime path instead of carrying both indefinitely.

This is important because the product is unreleased.

Shipping both architectures in parallel would make the codebase less canonical, not more.

## What Must Change in Event Parsing

This section is the concrete `t3code`-inspired parsing change.

### Current Wrong Shape

The current architecture tends to combine:

1. runtime creation,
2. session reconstruction,
3. state derivation,
4. web-facing DTO production,
5. special-case feature wiring

inside a small number of desktop services.

That makes parsing, lifecycle handling, and state derivation too entangled.

### Canonical New Shape

The new parsing pipeline must be:

1. **raw protocol record**
2. **typed RPC command/response/event parse**
3. **canonical runtime event normalization**
4. **derived store mutation**
5. **Glass bridge emission**

No step may be skipped.

### Canonical Rule For Parsers

Parser code must:

1. be pure where possible,
2. avoid mutating renderer state directly,
3. not call Electron bridge methods from normalization helpers,
4. not mix child process management with payload mapping.

## Canonical Boot Strategy

Spawned Pi must still support fast UI hydration.

Desktop should therefore continue to provide boot snapshots by caching derived state in the desktop process, not by forcing the renderer to wait for live runtime reconstruction.

The canonical boot path is:

1. desktop process starts,
2. Pi subprocess is launched or resumed,
3. desktop runtime store reconstructs enough state,
4. preload exposes boot snapshots,
5. renderer hydrates from them,
6. live events continue afterward.

This preserves the product behavior Glass already wants.

## `ask` and Other Pending User Input

The spawned runtime does not change the product requirement that pending user input belongs to Glass-native UI.

The canonical shape remains:

1. Pi emits a user-input request through RPC,
2. desktop normalizes it to `user-input.requested`,
3. desktop derives current ask state,
4. web renders it in the composer/session domain,
5. user answers through Glass UI,
6. desktop translates the answer back into Pi RPC.

This remains a native adaptation, not terminal UI support.

## Risks and Tradeoffs

### Positive Consequences

1. Runtime boundary becomes explicit and canonical.
2. Pi process failures become recoverable with real supervision semantics.
3. Desktop no longer depends as deeply on Pi internals.
4. Event parsing and app state become cleaner and more testable.
5. Future multi-runtime support becomes more plausible.
6. The web app can remain stable while runtime architecture improves underneath it.

### Negative Consequences

1. The desktop runtime stack becomes more complex.
2. IPC and event ordering bugs become possible during migration.
3. Some embedded-only behavior will require deliberate reimplementation.
4. Performance must be monitored so subprocess indirection does not regress UX.

### Concrete Risks

1. RPC event ordering may differ from assumptions in the embedded path.
2. A weak normalizer could leak Pi protocol quirks into app state.
3. Restart handling may lose runtime state if snapshots are not maintained correctly.
4. Extension compatibility may become temporarily narrower until native adaptations are rebuilt.
5. Trying to preserve too much old desktop service structure can produce a hybrid that is harder to maintain than either pure model.

## Non-Negotiable Invariants

### Invariant A: No Interactive Output Scraping

Glass must not treat terminal output as protocol data.

Only Pi RPC mode is canonical for the spawned runtime.

### Invariant B: Desktop Owns Runtime Translation

The renderer must not parse Pi RPC events.

Desktop owns protocol handling and normalization.

### Invariant C: Preserve Glass-Facing Contracts During Migration

Unless a deliberate renderer redesign is approved, desktop must continue to provide equivalent web-facing session/config state during the migration.

### Invariant D: Canonical Event Layer Comes Before Renderer Rewrites

Do not rewrite the web state model first.

First create the runtime adapter and normalized event layer.

### Invariant E: Special-Case UX Features Stay Native

`ask`, settings pages, and Glass-specific affordances remain app-owned UX.

Spawning Pi does not imply adopting Pi TUI assumptions.

### Invariant F: The Final Architecture Must Collapse to One Runtime Path

Because Glass is unreleased, the end state must be one canonical runtime path.

A long-lived dual architecture is not acceptable.

## What Not To Do

The next agent should not do any of the following.

1. Do not parse Pi interactive mode output.
2. Do not pipe raw Pi RPC events directly into renderer state.
3. Do not rewrite the entire web app before building the runtime adapter.
4. Do not keep both embedded and spawned runtime paths indefinitely.
5. Do not treat child process management, event normalization, and UI bridge emission as one file or one service.
6. Do not claim TUI parity just because the runtime moved out of process.

## Acceptance Criteria

This migration should not be considered complete unless all of the following are true.

1. Glass runs Pi through a subprocess in RPC mode for its canonical runtime path.
2. Desktop owns a strict RPC client and child process supervisor.
3. Raw Pi RPC events are normalized into canonical desktop runtime events before app state is derived.
4. The web renderer can still consume Glass-native session/config state without wholesale rewrite during migration.
5. `ask` and other pending user interactions are still rendered natively in Glass.
6. Embedded Pi internals are no longer the canonical runtime integration mechanism.
7. The final codebase has one clear runtime path, not a permanent hybrid.

## Suggested Starting Files

For the next agent, start with these areas.

### Current Glass Runtime Path

1. `apps/desktop/src/pi-session-service.ts`
2. `apps/desktop/src/pi-config-service.ts`
3. `apps/desktop/src/main.ts`
4. `apps/desktop/src/preload.ts`

### New Runtime Host Area To Create

1. `apps/desktop/src/pi-runtime/pi-process-manager.ts`
2. `apps/desktop/src/pi-runtime/pi-rpc-client.ts`
3. `apps/desktop/src/pi-runtime/pi-rpc-types.ts`
4. `apps/desktop/src/pi-runtime/pi-rpc-event-parser.ts`
5. `apps/desktop/src/pi-runtime/pi-runtime-normalizer.ts`
6. `apps/desktop/src/pi-runtime/pi-runtime-store.ts`
7. `apps/desktop/src/pi-runtime/pi-runtime-service.ts`

### Contracts To Revisit

1. `packages/contracts/src/session.ts`
2. `packages/contracts/src/pi.ts`
3. `packages/contracts/src/ipc.ts`

## Final Decision Statement

Glass will not treat embedded Pi internals as its canonical runtime architecture.

Glass will canonically run Pi as a spawned RPC subprocess, normalize Pi’s runtime stream into app-owned canonical events inside desktop, and preserve Glass-native UI and contracts above that boundary.

That is the direction this unreleased codebase must now follow.
