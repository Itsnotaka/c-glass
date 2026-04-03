# Canonical Pi Runtime And libghostty Architecture

## Goal

Define a production-grade architecture for `c-glass` that is centered on:

1. `@mariozechner/pi-ai` and `@mariozechner/pi-agent-core` runtime primitives.
2. Rich, semantic tool-call UX without lossy JSON-only rendering.
3. Full `libghostty`-backed terminal support, not a demo shell pane.

This document is intentionally implementation-oriented and source-backed.

## Pi Codebase And GitHub Links

1. Local Pi codebase used for `@mariozechner/pi-agent-core` and `@mariozechner/pi-ai` analysis: `.pi/codebases/cb-mnj28t30-giyq`.
2. Local Pi codebase used for `packages/web-ui` renderer architecture analysis: `.pi/codebases/cb-mnj26eeh-fp06`.
3. GitHub repository: `https://github.com/badlogic/pi-mono`.
4. GitHub package links:
   - `https://github.com/badlogic/pi-mono/tree/main/packages/agent`
   - `https://github.com/badlogic/pi-mono/tree/main/packages/ai`
   - `https://github.com/badlogic/pi-mono/tree/main/packages/web-ui`

## Source-Backed Constraints

1. `pi-agent-core` already exposes the right hooks and lifecycle events for canonical tool interception: `beforeToolCall`, `afterToolCall`, and `tool_execution_*` in `.pi/codebases/cb-mnj28t30-giyq/packages/agent/src/types.ts#L200`, `#L213`, `#L339-L341`, plus concrete execution flow in `agent-loop.ts#L491-L611`.
2. `pi-ai` already models `ToolResultMessage.details` (`.pi/codebases/cb-mnj28t30-giyq/packages/ai/src/types.ts#L203-L208`).
3. `c-glass` currently drops tool result richness at the bridge mapping boundary: `toolResult` mapping in `apps/desktop/src/pi-session-service.ts#L210-L216` preserves `toolCallId/toolName/isError/content` but not `details`.
4. `c-glass` UI currently renders tool calls mostly as raw argument/output blobs (`apps/web/src/lib/pi-chat-timeline.ts#L247`, `#L270`, `apps/web/src/components/glass/glass-pi-messages.tsx#L398-L454`).
5. `pi-web-ui` proves a good renderer registry pattern (`renderer-registry.ts#L14-L21`, `tools/index.ts#L10-L40`, `components/Messages.ts#L258-L263`) and a JSON fallback strategy (`tools/renderers/DefaultRenderer.ts`).
6. `t3code` provides a strong terminal architecture pattern with PTY abstraction, terminal manager lifecycle, and typed RPC/event contracts (`apps/server/src/terminal/Services/PTY.ts#L25-L50`, `.../Manager.ts#L69-L115`, `packages/contracts/src/terminal.ts#L37-L151`, `packages/contracts/src/rpc.ts#L98-L114`, `#L228-L305`, `apps/server/src/ws.ts#L360-L389`, `apps/web/src/terminalStateStore.ts#L514-L572`).
7. `t3code` has no `libghostty` integration (`rg "ghostty|libghostty"` returns no matches).
8. `libghostty` API state is currently evolving and must be pinned/isolated: `include/ghostty/vt.h#L10-L25` warns API is work in progress; `include/ghostty.h#L6-L8` notes the embedding API is currently only used by the macOS app, with platform tags currently macOS/iOS (`include/ghostty.h#L67-L68`).

## Canonical Architecture (Target)

## Layer 1: Runtime Canonicalization (Desktop, Agent-Facing)

Create a runtime adapter in desktop that subscribes to `AgentSession` events and emits a typed, lossless event stream for UI consumption.

Responsibilities:

1. Preserve every `tool_execution_start/update/end` with typed arguments and details.
2. Correlate tool call lifecycle by `toolCallId`.
3. Preserve partial updates for streaming tools.
4. Keep current summary/snapshot behavior for compatibility.

Do not derive UI semantics in this layer. Only normalize and preserve.

## Layer 2: Bridge Contracts (Desktop <-> Web)

Extend `packages/contracts/src/session.ts` with explicit tool lifecycle payloads. Keep backwards compatibility via optional fields.

Proposed additions:

```ts
export interface PiToolCallBlock {
  type: "toolCall";
  id?: string;
  name: string;
  arguments?: unknown;
  [key: string]: unknown;
}

export interface PiToolResultMessage {
  role: "toolResult";
  toolCallId?: string;
  toolName?: string;
  content: PiBlock[];
  details?: unknown;
  isError?: boolean;
}
```

Add a dedicated runtime lane for high-frequency state:

```ts
export interface PiRuntimeToolEvent {
  lane: "runtime";
  sessionId: string;
  event:
    | { type: "tool.start"; toolCallId: string; toolName: string; args: unknown }
    | { type: "tool.update"; toolCallId: string; toolName: string; partial: unknown }
    | { type: "tool.end"; toolCallId: string; toolName: string; result: unknown; isError: boolean };
}
```

Keep `summary` and `active` lanes for existing consumers.

## Layer 3: UI Rendering Pipeline (Web)

Adopt a React renderer registry analogous to `pi-web-ui`.

Design:

1. `registerToolRenderer(name, renderer)`.
2. `renderTool(call, result, state)`.
3. Default JSON fallback renderer for unknown tools.
4. Optional "force JSON" debug switch.

Initial built-in renderers:

1. `read` with truncation metadata and image/text split.
2. `edit` with structured diff + changed line hints.
3. `write` with path confirmation and content preview.
4. `grep` with match count and file-grouped hits.
5. `find` with result list and limit indicators.
6. `ls` with entry list and truncation indicators.
7. `bash` with command, output, exit status, truncation/full path hints.

This removes "card over card with plain json" while retaining robust fallback behavior.

## Layer 4: Terminal Subsystem (libghostty)

Use the same architecture shape as `t3code` terminal manager, but replace terminal emulation core with `libghostty`.

Core split:

1. PTY process control (spawn/write/resize/kill): platform adapter (Node/Electron side).
2. Terminal emulation + render state: `libghostty-vt` engine (`ghostty_terminal_*`, `ghostty_render_state_*`).
3. Event publication + history persistence: terminal manager.
4. UI rendering: custom terminal surface driven by render deltas (not xterm fallback in this plan).

Engine requirements for "full support":

1. Feed PTY bytes into `ghostty_terminal_vt_write`.
2. Handle `WRITE_PTY` callback for terminal responses (DSR/DA/etc) and write back to PTY.
3. Maintain scrollback, alternate screen, resize reflow through Ghostty state.
4. Use render-state dirty tracking for incremental paints (`include/ghostty/vt/render.h#L44`, `#L331`).
5. Wire keyboard/mouse encoding from libghostty-vt encoder APIs.
6. Support clipboard, bell, title, and side effects via terminal effect callbacks (`include/ghostty/vt/terminal.h#L70-L77`, `#L418`, `#L426`).

## Layer 5: Persistence And Replay

Mirror the robust replay pattern from `t3code`:

1. `open` returns full terminal snapshot.
2. event stream delivers incremental events.
3. web store keeps bounded event buffer per terminal key.
4. renderer hydrates from snapshot, then replays pending events.

This avoids missed-output races across reconnects and tab transitions.

## libghostty Integration Plan (Production-Grade)

## Native Addon Boundary

Implement a dedicated `glass-terminal-engine` native module (N-API) that wraps a pinned `libghostty` commit.

Exported surface:

1. `create({ cols, rows, scrollback }) -> handle`.
2. `writeVt(handle, bytes)` for PTY output.
3. `sendInput(handle, bytes)` for user input encoding/write path.
4. `resize(handle, cols, rows)`.
5. `snapshot(handle)` for full screen state.
6. `collectDirty(handle)` for incremental render deltas.
7. callback registration for `write_pty`, bell, title, clipboard, and process state changes.

## Threading Rules

1. One terminal engine instance per session terminal.
2. A dedicated worker thread per engine or a bounded worker pool with strict session affinity.
3. Never call `ghostty_terminal_vt_write` reentrantly inside callbacks (`terminal.h#L65-L66`, `#L836-L838`).

## Version Strategy

Given upstream warnings (`vt.h#L10-L25`), pin exact commit SHA and vendor adapter shims.

Rules:

1. Never target floating `main` for release builds.
2. Keep addon-facing C shim stable and isolate upstream API churn there.
3. Upgrade only with compatibility test pass and golden fixture diffs.

## Cross-Platform Packaging

1. Build precompiled native artifacts for macOS arm64/x64 and Windows x64/arm64.
2. Ship deterministic CI build matrix with symbol checks.
3. Verify Electron ASAR unpack and code-signing behavior for native binaries.

## Contract And UI Changes In c-glass

## Required Contract Changes

1. Add `details?: unknown` to `PiToolResultMessage` in `packages/contracts/src/session.ts`.
2. Add typed tool lifecycle events (new runtime lane) so UI can show progress before final tool result commit.
3. Add terminal bridge namespace to `GlassBridge` with typed open/write/resize/clear/restart/close/subscribe methods.

## Required Desktop Changes

1. Update `apps/desktop/src/pi-session-service.ts` to preserve tool `details` and forward lifecycle updates.
2. Introduce terminal manager service in desktop main process with the same lifecycle semantics as `t3code` manager.
3. Add IPC handlers and push channels for terminal events.

## Required Web Changes

1. Replace direct JSON tool rendering path with registry dispatch.
2. Add terminal state store with snapshot + event replay semantics.
3. Integrate terminal drawer/panel with multi-terminal groups and persisted layout.
4. Persist left/right pane widths and terminal panel dimensions.

## Rollout (No Half-Baked Milestones)

## Phase A: Lossless Runtime Data

1. Contracts and desktop mapping preserve `toolCall.id/arguments`, `toolResult.details`, and lifecycle deltas.
2. Validation tests prove parity between agent events and bridge events.

Exit gate: no dropped fields for built-in tools in golden transcript tests.

## Phase B: Semantic Tool UI

1. Introduce renderer registry and fallback renderer.
2. Ship built-in renderers for `read/edit/write/grep/find/ls/bash`.

Exit gate: all built-ins render semantically without raw JSON as primary UI.

## Phase C: libghostty Engine

1. Land native addon with VT write, effects callbacks, resize, dirty render extraction.
2. Add deterministic fixture tests for ANSI sequences, wide chars, scrollback, alternate screen, and cursor behavior.

Exit gate: parity suite passes against golden outputs across supported OS targets.

## Phase D: Terminal Product Integration

1. Terminal manager + IPC + web terminal surface wired end to end.
2. Snapshot/replay reconnect behavior validated.
3. Multi-terminal split/group UX and keyboard shortcuts integrated.

Exit gate: recovery/restart/race scenarios pass stress suite.

## Phase E: Hardening

1. Memory and CPU profiling under long sessions.
2. Crash recovery and addon watchdog behavior.
3. Release-candidate soak with telemetry and log-based assertions.

Exit gate: `fmt`, `lint`, `typecheck`, terminal integration tests, and soak metrics pass.

## Quality Gates

1. Transcript parity tests for tool lifecycle and details preservation.
2. Native addon ABI tests across Electron/Node versions used in release.
3. Terminal golden fixtures covering control sequences and rendering deltas.
4. UI interaction tests for tool approvals, streaming updates, and terminal reconnect.
5. Performance budgets for high-output terminal sessions.

## What This Explicitly Avoids

1. Rebuilding architecture around `packages/web-ui` internals.
2. Adopting emdash Electron RPC shape directly.
3. Shipping xterm-style fallback as the "libghostty solution".
4. Collapsing structured tool metadata back into plain JSON strings.
