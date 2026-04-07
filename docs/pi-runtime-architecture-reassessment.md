# Pi Runtime Architecture Reassessment

Date: 2026-04-07
Status: research and planning only

## Purpose

This note reassesses Glass's current Pi runtime direction before more implementation work.

The goal is to answer four questions with source-backed evidence:

1. Should Glass keep the spawned Pi RPC pass-through architecture?
2. Should Glass switch back toward direct `pi-mono` / SDK integration with `pi-ai`, login flows, and direct session wiring?
3. What is the real extension constraint in GUI environments?
4. Does Pi JSON mode transport everything canonically, and would that solve the current problems?

This note also records the current known Glass implementation facts so the next thread can make a deliberate architectural decision instead of continuing ad hoc fixes.

## Executive Conclusions

1. `pi --mode json` is not a solution to the current Glass problems.
2. Pi JSON mode is a one-shot event stream built on print mode. It does not provide a long-lived control plane, does not round-trip interactive extension UI, and does not expose `ctx.hasUI`. It cannot replace Glass's current runtime integration.
3. Pi RPC mode is the only Pi subprocess transport that currently carries extension interactivity at all, but only for a limited subset of UI methods.
4. Pi RPC does not canonically transport TUI custom components. In Pi's own source, `ctx.ui.custom()` is explicitly unsupported in RPC mode and returns `undefined`.
5. The stock `ask` extension is TUI-native, not GUI-native. It is implemented with `ctx.ui.custom(...)` and `pi-tui` components, which is why it worked in interactive TUI mode and broke in Glass's spawned RPC runtime.
6. Glass's current `ask` override in `apps/desktop/src/pi-runtime/pi-runtime-worker.ts` is not a hack in the sense of bypassing a canonical Pi transport. It is a compatibility adapter for a real upstream limitation.
7. Switching back to direct SDK embedding inside the desktop process would not, by itself, solve `ask`. The deeper issue is that Pi's rich extension UI API is TUI-oriented. Direct SDK use would give Glass more control, but it would not magically make `ctx.ui.custom(...)` GUI-native.
8. The strongest external precedent is not Pi JSON mode. It is the Codex app-server and `t3code` pattern: provider-native bidirectional protocols are normalized into app-owned canonical runtime events, and interactive requests are explicit first-class protocol entities.
9. The most defensible next direction is still an explicit runtime boundary above the renderer and below canonical Glass state. The open question is whether that boundary should remain a spawned Pi runtime host with RPC semantics, or become a richer Glass-owned runtime host built from Pi SDK/runtime packages while preserving the same out-of-process discipline.
10. Do not reintroduce renderer-side pending-session hacks. The runtime/session issues still belong in desktop/runtime normalization layers first, consistent with ADR-004.
11. Boot and first-open performance are substantially improved in the current runtime path, but should still be treated as partially fixed rather than conclusively solved.
12. Glass should target a curated GUI compatibility layer, not universal TUI-extension compatibility. The immediate target should cover `ask`, RPC-safe extension dialogs, custom extension tool-call presentation where needed, `context7`, and web search.

## Current Glass Facts

### Runtime and Ask Bridge Facts

1. Glass currently overrides `ask` in `apps/desktop/src/pi-runtime/pi-runtime-worker.ts`.
2. That override replaces the stock TUI-only `ask` implementation with an RPC-safe version that only uses `ctx.ui.select(...)` and `ctx.ui.input(...)`.
3. The worker then constructs a Pi session via `createAgentSession(...)` and runs `runRpcMode(...)` against it, with the custom `ask` tool registered in `customTools`.
4. Glass currently spawns that worker through `apps/desktop/src/pi-runtime/pi-process-manager.ts`, which runs `process.execPath` with `pi-runtime-worker`. So today's implementation is already a Glass-owned spawned runtime host around Pi packages, not a literal `pi` CLI subprocess.
5. Desktop runtime code in `apps/desktop/src/pi-runtime/pi-runtime-service.ts` translates Pi RPC `extension_ui_request` records into Glass-native ask state via `handleUiRequest(...)`, `emitAsk(...)`, `answerAsk(...)`, and `replyUi(...)`.
6. The IPC bridge for ask already existed in `apps/desktop/src/main.ts` and `apps/desktop/src/preload.ts` via `glass:session.read-ask`, `glass:session.answer-ask`, and `glass:session.ask`.
7. Debug evidence confirmed the current bridge emits `runtime-user-input-requested`, `runtime-handle-ui-request`, `runtime-ask-state-built`, `runtime-emit-ask`, `preload-on-ask`, and `ui-on-ask`.
8. A renderer mount bug prevented the response path from firing until the ask overlay was moved relative to the composer. That was fixed in `apps/web/src/components/glass/chat-session.tsx`.
9. After that fix, the pending response path reached `ipc-session-answer-ask`, `runtime-answer-ask`, and `runtime-reply-ui` as expected.

### Startup and Session Facts

1. `PiRuntimeService.create()` now locally seeds a session file and returns a boot snapshot immediately instead of waiting for the spawned runtime to fully warm.
2. The actual runtime warm-up now happens in the background via `warm(...)`.
3. `openRun(...)` concurrently loads `get_state` and `get_messages` with `Promise.all(...)`.
4. This means open-chat startup is already partially improved without reintroducing renderer-side hacks.
5. `prompt(sessionId, input)` now auto-skips a pending ask before sending the next prompt and submits the next prompt with `streamingBehavior: "followUp"` when needed.
6. `apps/desktop/src/pi-rpc-client.ts` and `apps/desktop/src/pi-rpc-types.ts` already support `streamingBehavior?: "steer" | "followUp"` for prompts.
7. Current validations already run after those logic changes: `pnpm run fmt` and `pnpm run typecheck` passed.
8. `pnpm run lint` still had pre-existing unrelated warnings in `apps/desktop/src/pi-runtime/pi-rpc-client.ts`, `apps/desktop/src/pi-runtime/pi-runtime-store.test.ts`, and `apps/web/src/components/glass/use-pi-session.ts`.
9. The hero-to-chat transition can still regress if the renderer waits only for committed messages. Newly created threads can already be streaming with `live` content while `messages.length` is still `0`.
10. The desktop watch path can also regress if it returns the seeded snapshot without attaching to the warmed boot run. In that case the first-turn runtime can stream with `refs === 0`, which drops active delta bridge events even though the runtime store is mutating.

### Parked UI Intentions

These are intentionally not the priority for the next thread, but they should remain recorded:

1. Ask tool calls should not appear as normal interactive tool rows in chat.
2. During generation, the status text should read more like "asking questions" than like a normal tool execution.
3. Once the ask UI is formed, the transient tool call should disappear from the transcript, leaving only the ask UI as the interactable surface.
4. After answer submission, the transcript should show only a passive question-and-answer preview.
5. The user intends to handle UI later. The next thread should stay logic and architecture focused.

## Pi Source Findings

### Interactive Mode Is Full TUI, Not Generic GUI

Pi interactive mode exposes a rich `ExtensionUIContext` in `badlogic/pi-mono/packages/coding-agent/src/modes/interactive/interactive-mode.ts`.

That context includes:

1. `select`, `confirm`, `input`, `editor`
2. `notify`, `onTerminalInput`, `setStatus`, `setWorkingMessage`, `setHiddenThinkingLabel`
3. `setWidget` with either string arrays or real component factories
4. `setFooter`, `setHeader`, `setTitle`
5. `custom()`
6. `setEditorComponent`, theme APIs, `getEditorText`, `getToolsExpanded`, and more

The key type is in `badlogic/pi-mono/packages/coding-agent/src/core/extensions/types.ts`.

`custom()` is not abstract GUI UI. It expects:

1. a `TUI`
2. a TUI `Theme`
3. a `KeybindingsManager`
4. and a returned `pi-tui` `Component`

That means the richest Pi extension UI surface is terminal-native by design.

### RPC Mode Carries Only a Subset of Extension UI

Pi RPC mode is implemented in `badlogic/pi-mono/packages/coding-agent/src/modes/rpc/rpc-mode.ts`.

It creates an RPC-specific `ExtensionUIContext` with these behaviors:

1. `select`, `confirm`, `input`, and `editor` emit `extension_ui_request` records and wait for `extension_ui_response`.
2. `notify`, `setStatus`, `setWidget`, `setTitle`, and `set_editor_text` emit fire-and-forget `extension_ui_request` records.
3. `custom()` is explicitly unsupported and returns `undefined`.
4. `setWorkingMessage`, `setFooter`, `setHeader`, and `setEditorComponent` are no-ops.
5. `getEditorText()` returns `""`.
6. `getToolsExpanded()` returns `false`.
7. `setTheme()` returns `{ success: false, error: ... }`.
8. `setWidget(...)` only supports string arrays in RPC mode; component factories are ignored.

Pi's own docs say the same thing in:

1. `badlogic/pi-mono/packages/coding-agent/docs/rpc.md`
2. `badlogic/pi-mono/packages/coding-agent/docs/extensions.md`

Most importantly, `docs/rpc.md` explicitly says:

1. dialog methods are supported via the extension UI sub-protocol
2. fire-and-forget methods emit requests
3. `custom()` returns `undefined`
4. several TUI-specific methods are unsupported or degraded

So Pi RPC mode is real and structured, but it is not a complete transport for all TUI extension interactions.

### JSON Mode Is Not a Headless Interactive Runtime

Pi JSON mode is documented in `badlogic/pi-mono/packages/coding-agent/docs/json.md` and implemented by print mode in `badlogic/pi-mono/packages/coding-agent/src/modes/print-mode.ts`.

Source-backed facts:

1. `runPrintMode(...)` handles both text mode and JSON mode.
2. JSON mode writes the session header followed by streamed session events to stdout.
3. It is single-shot request execution, not a long-lived request/response runtime protocol.
4. It does not provide command correlation, session switching, turn interruption control, message reads, or a bidirectional extension UI sub-protocol.
5. In print/JSON mode, extensions are bound without a UI context.
6. The `ExtensionRunner` falls back to `noOpUIContext` when no UI context is provided.
7. `ExtensionRunner.hasUI()` is defined as `this.uiContext !== noOpUIContext`.
8. Pi docs explicitly say `ctx.hasUI` is `false` in print and JSON mode, and UI methods are no-op there.

This is decisive.

Pi JSON mode does not transport `ask`, approvals, or other interactive extension semantics canonically. It cannot solve Glass's current ask/runtime problem.

### Stock Ask Is TUI-Oriented by Construction

The local stock ask extension at `~/.pi/agent/extensions/ask.ts` is built around `ctx.ui.custom(...)` and hand-written `pi-tui` components.

Source-backed facts from that file:

1. it defines `SingleSelectComponent` and `MultiSelectComponent`
2. it calls `ctx.ui.custom(...)`
3. it expects TUI keyboard input handling and TUI rendering lifecycle
4. it uses overlay options meant for the TUI environment

So the failure mode in Glass's spawned RPC runtime is not accidental. The extension is using a UI primitive that Pi RPC does not transport.

## Direct SDK and `pi-ai` Findings

### What Direct SDK Integration Gives You

Pi SDK docs in `badlogic/pi-mono/packages/coding-agent/docs/sdk.md` explicitly recommend direct `AgentSession` usage for Node.js applications.

The SDK gives you:

1. `createAgentSession(...)`
2. `createAgentSessionRuntime(...)`
3. `AgentSessionRuntime` session replacement for new-session, fork, resume, and import flows
4. `AuthStorage`
5. `ModelRegistry`
6. direct event subscriptions and direct access to session state
7. the option to call `runRpcMode(...)` yourself from your own runtime host if you still want a protocol boundary

This is important: Pi's SDK and Pi's RPC mode are not opposites. RPC mode itself is built on the same runtime/session machinery.

### What Direct Auth and Login Wiring Gives You

Pi auth is accessible directly through both Pi SDK and `pi-ai`.

Evidence:

1. `badlogic/pi-mono/packages/coding-agent/src/core/auth-storage.ts` exposes `AuthStorage.login(providerId, callbacks)`.
2. `badlogic/pi-mono/packages/ai/README.md` documents programmatic OAuth through `@mariozechner/pi-ai/oauth`.
3. `pi-ai` exposes functions such as `loginAnthropic`, `loginOpenAICodex`, `loginGitHubCopilot`, `loginGeminiCli`, and `loginAntigravity`.
4. `pi-ai` also exposes `getOAuthApiKey(...)` and token refresh flows, with credential storage owned by the caller.
5. `badlogic/pi-mono/packages/coding-agent/examples/sdk/09-api-keys-and-oauth.ts` and SDK docs show that `AuthStorage` and `ModelRegistry` are straightforward to embed.

So if Glass wants more direct ownership of auth/login UI, the source does support that.

### What Direct SDK Integration Does Not Automatically Solve

Direct SDK integration does not automatically make Pi extensions GUI-aware.

Why:

1. extensions still target `ExtensionUIContext`
2. the richest extension API surface is still TUI-shaped
3. `custom()` still expects a `TUI`, `Theme`, `KeybindingsManager`, and `Component`
4. a GUI host would still need to either:
   - implement a TUI-compatible adapter layer,
   - replace TUI-only extensions with GUI-aware variants,
   - or define a new higher-level interactive contract and migrate extensions to it

This means direct SDK embedding can improve control, auth, and runtime composition, but it does not by itself remove the core ask-extension mismatch.

## Comparison: Codex App-Server, Codex CLI, and `t3code`

### Codex App-Server Uses a First-Class Bidirectional Protocol

OpenAI's `codex app-server` is documented in `openai/codex/codex-rs/app-server/README.md`.

It is a bidirectional JSON-RPC protocol over stdio or websocket, not a one-way event log.

Source-backed facts:

1. it requires `initialize` / `initialized`
2. it exposes thread, turn, item, config, and tool APIs
3. it sends server-initiated requests to the client for interactive work
4. those requests include:
   - `item/commandExecution/requestApproval`
   - `item/fileChange/requestApproval`
   - `item/tool/requestUserInput`
   - `item/permissions/requestApproval`
   - `item/tool/call`
   - auth-token refresh and MCP elicitation requests
5. `request_user_input` has explicit typed request and response schemas in `openai/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputParams.ts`, `ToolRequestUserInputQuestion.ts`, and `ToolRequestUserInputResponse.ts`.
6. the app-server README documents a `serverRequest/resolved` lifecycle notification for these interactive requests.
7. test coverage in `openai/codex/codex-rs/app-server/tests/suite/v2/request_user_input.rs` verifies full round-trip behavior.

Codex therefore has a genuine canonical transport for ask-like prompts because the protocol was designed to carry them.

### Codex CLI Surfaces Preserve the Protocol Even In-Process

OpenAI's `codex-app-server-client` in `openai/codex/codex-rs/app-server-client/README.md` is especially relevant.

It is an in-process client facade for CLI surfaces such as:

1. `codex-exec`
2. `codex-tui`

The critical design choice is that it removes the process boundary while preserving app-server semantics.

Its README says:

1. client to server uses typed channels
2. server to client uses typed `ServerRequest` and notification events
3. JSON serialization is only used at external transport boundaries
4. the in-process path deliberately preserves app-server request/response semantics instead of inventing a second contract

This is a very strong precedent for Glass.

It suggests the meaningful choice is not simply binary process vs SDK embedding. The meaningful choice is whether the app owns a strong canonical interaction protocol.

### Not Every Codex Surface Supports Every Interactive Request

Codex also shows that a strong protocol does not mean every surface supports every interaction.

Evidence:

1. `openai/codex/codex-rs/exec/src/lib.rs` explicitly rejects server requests such as command approvals, file-change approvals, and `request_user_input` in exec mode.
2. `openai/codex/codex-rs/tui/src/app/app_server_requests.rs` tracks pending request ids for approvals and user inputs and serializes corresponding responses.

This is a useful parallel to Glass.

It shows that even with a canonical server protocol, surface capabilities still vary. Unsupported interactions must still be rejected, adapted, or specialized.

### `t3code` Uses Canonical Runtime Events Above Provider-Specific Protocols

`t3code` provides the clearest external architectural precedent for Glass.

Source-backed facts:

1. `packages/contracts/src/providerRuntime.ts` defines a canonical provider runtime event vocabulary.
2. That vocabulary includes `request.opened`, `request.resolved`, `user-input.requested`, and `user-input.resolved`.
3. `apps/server/src/provider/Services/ProviderAdapter.ts` defines provider adapters that expose `respondToRequest(...)` and `respondToUserInput(...)`.
4. `apps/server/src/provider/Layers/CodexAdapter.ts` maps Codex native server requests into canonical runtime events.
5. `apps/server/src/provider/Layers/ClaudeAdapter.ts` does the same for Claude's own callback model, including a dedicated path for `AskUserQuestion`.
6. `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts` projects those runtime events into app activities such as approval requested/resolved and user input requested/resolved.
7. UI responses are then turned back into provider calls through orchestration events such as `thread.approval-response-requested` and `thread.user-input-response-requested`.

This is the exact shape ADR-004 was reaching for.

### Canonical Transport Still Does Not Eliminate Callback-Lifecycle Problems

One of the most useful findings from `t3code` is that even a strong canonical protocol does not make pending callback state magically persistent.

Evidence:

1. `apps/web/src/session-logic.ts` and `apps/web/src/session-logic.test.ts` explicitly handle stale pending approval and stale pending user-input failures.
2. Those tests mention that provider callback state does not survive app restarts or recovered sessions.

This matters for Glass.

It means that even if Pi had a richer canonical user-input transport tomorrow, transport alone would not solve every lifecycle problem. Pending callback persistence and restart semantics are separate concerns.

## What This Means for Glass

### Narrow Compatibility Target

Glass does not need to promise compatibility with arbitrary TUI-first Pi extensions.

The more realistic near-term target is:

1. `ask`
2. RPC-safe extension dialogs and notifications
3. custom extension tool calls rendered as Glass-native tool/result UI where needed
4. selected high-value tool experiences such as `context7` and web search, with web search treated as a lighter core search/thinking-style lane rather than a heavy bespoke card

That implies a curated compatibility layer, not a generic TUI emulation layer.

This is also supported by the local extension inventory in `~/.pi/agent/extensions`.
Most of the high-value local integrations are plain tools, including `context7`, `websearch`, `codebase`, `debug`, `get-diagnostics`, and `paper-mcp`. Those are better served by generic tool-call cards plus good request/result presentation than by trying to recreate arbitrary extension-specific GUI semantics.

Concretely, the product boundary should be:

1. support RPC-safe UI primitives natively
2. adapt a few important tools into better Glass-native presentations
3. classify richer TUI-only extension UI as unsupported or degraded in GUI mode unless explicitly adapted

### What the Current Ask Fix Really Is

The current `ask` override in `apps/desktop/src/pi-runtime/pi-runtime-worker.ts` is a compatibility strategy for a real upstream mismatch:

1. Pi interactive extensions assume a TUI host for `custom()`.
2. Pi RPC only transports a subset of UI primitives.
3. Glass is a GUI host speaking Pi RPC.
4. Therefore Glass either has to:
   - override `ask`,
   - patch upstream `ask` to become RPC-safe,
   - or build a richer runtime host / protocol than current Pi RPC exposes.

The current override is therefore legitimate and consistent with ADR-004's guidance to solve these issues in the runtime/normalization layer instead of the renderer.

### Why JSON Mode Does Not Fix the Current Problems

The user hypothesis was:

> Does JSON mode transport everything, and would that fix literally all the problems?

The source-backed answer is no.

JSON mode fails on every requirement that matters here:

1. it is not a long-lived runtime control plane
2. it cannot read state on demand
3. it cannot fetch messages on demand
4. it cannot switch sessions canonically
5. it cannot fork sessions canonically
6. it cannot round-trip `ask`
7. it does not expose `ctx.hasUI`
8. it does not carry `extension_ui_request` / `extension_ui_response`
9. it cannot transport `ctx.ui.custom(...)`

At best, JSON mode is useful for:

1. one-shot prompt execution
2. event logging
3. shell piping
4. diagnostics or experiments

It would remove capabilities Glass currently depends on. It would not fix the ask issue.

### Boot-Time Performance Status

The current codebase already contains meaningful boot and open-chat performance fixes.

Specifically:

1. `PiRuntimeService.create()` seeds a local session file and returns a boot snapshot immediately.
2. Runtime warm-up is pushed into `warm(...)` in the background.
3. `openRun(...)` fetches `get_state` and `get_messages` concurrently.

Those changes explain why thread creation now feels instant.

However, the problem should still be considered partially fixed, not fully resolved:

1. first-open timing still depends on when the renderer attaches relative to the warmed runtime
2. the hero-to-chat transition must account for streaming `live` state, not just committed message count
3. attach/watch races can still hide live updates if the desktop bridge returns only the seeded snapshot and does not bind to the warmed run in time

The safest wording for the next thread is:

1. create-time latency is substantially improved
2. first-thread hydration and bridging are improved but still regression-prone until watch/attach timing and chat-shell transitions are fully stabilized

### What the Real Constraint Actually Is

The real constraint is not "Pi subprocesses are bad" and not "Glass needs JSON mode".

The real constraint is:

1. Pi's richest extension UI model is TUI-native.
2. Pi RPC only transports a subset of that model.
3. Pi JSON transports none of that model.
4. Glass wants GUI-native interaction surfaces for tools such as `ask`.
5. The stock extension ecosystem was not designed around a GUI-first canonical interaction protocol.

That is the architectural mismatch.

## Reassessing the Architecture Options

### Option A: Keep the Spawned Pi RPC Host Boundary

This remains the strongest conservative option.

Pros:

1. preserves the ADR-004 boundary
2. keeps process isolation and restart semantics explicit
3. matches the strongest external pattern from `t3code` and Codex app-server
4. keeps renderer free of Pi protocol details
5. already aligns with current Glass runtime normalization and boot snapshot work
6. avoids re-embedding large Pi internals into desktop product code

Cons:

1. RPC does not carry full TUI extension UI
2. Glass must own compatibility adaptation for TUI-only extensions like stock `ask`
3. auth/login flows are less direct unless Glass separately uses Pi auth files or Pi SDK pieces
4. some Pi features may remain awkward until a richer compatibility layer exists

Recommendation:

Keep this as the short-term canonical path unless there is a broader decision to replace the runtime host itself.

### Option B: Switch Back to Direct Pi SDK Integration in Electron/Desktop

This is attractive for control, but weak as an answer to the current ask problem.

Pros:

1. full direct access to `createAgentSessionRuntime`, `AuthStorage`, `ModelRegistry`, and `pi-ai` OAuth flows
2. easier direct login UI ownership
3. easier access to runtime/session internals without subprocess coordination
4. easier to build custom host behavior using Pi packages directly

Cons:

1. reintroduces the coupling ADR-004 explicitly moved away from
2. weakens process isolation and runtime supervision boundaries
3. does not automatically solve TUI-only extension UI such as `ctx.ui.custom(...)`
4. risks sliding back into app-specific runtime wiring intertwined with product code

Recommendation:

Do not switch back to full in-process desktop embedding just to solve `ask`. The evidence does not support that as the actual fix.

### Option C: Deepen the Glass-Owned Runtime Host, But Keep It Out of Process

This is not the current implementation, but it is the most interesting strategic alternative.

Shape:

1. keep the runtime boundary out of process
2. stop depending on the `pi` CLI binary as the only host form if needed
3. build or extend a Glass-owned runtime host on top of `createAgentSessionRuntime`, `AuthStorage`, `ModelRegistry`, and optionally `runRpcMode(...)` or a Glass-specific protocol
4. keep canonical event normalization in desktop
5. define a richer Glass-native interaction contract where needed

Pros:

1. keeps ADR-004 boundary discipline
2. gives more direct ownership over auth/login/runtime composition
3. avoids main-process re-embedding as the product architecture
4. creates room for a better interactive request protocol than current Pi RPC if Glass wants to invest there

Cons:

1. more work than continuing with the current spawned host path
2. Glass would become the owner of more runtime-host maintenance
3. extension compatibility still needs a product decision, not just plumbing

Recommendation:

If the current Pi binary pass-through becomes strategically limiting, this is the better reevaluation path than returning to direct desktop-process embedding.

## Recommended Direction for the Next Thread

1. Keep spawned RPC as the canonical active path for now.
2. Explicitly reject Pi JSON mode as a runtime architecture candidate.
3. Treat the stock `ask` breakage as evidence that Glass needs an extension-compatibility policy, not as evidence that the whole spawned architecture is wrong.
4. Decide whether Glass wants:
   - an RPC-safe curated subset of extensions with targeted overrides, or
   - a bigger investment in a Glass-owned runtime host/protocol built on Pi SDK packages.
5. If exploring Pi SDK again, scope it as a runtime-host spike, not a return to renderer or main-process coupling.
6. Keep all runtime/session fixes in desktop normalization/runtime layers first.
7. Do not reintroduce renderer-side pending session hacks.
8. Leave transcript/ask-row UI cleanup for a later thread.
9. Treat the compatibility target as curated and product-led: `ask`, RPC-safe dialogs, custom extension tool-call presentation where needed, `context7`, and web search.

## Practical Planning Notes

### If Glass Stays on the Current Spawned Pi RPC Host

The next planning thread should focus on:

1. defining which extension UI methods are considered RPC-safe in Glass
2. classifying extensions as:
   - RPC-safe
   - RPC-degraded but acceptable
   - TUI-only and requiring override
3. deciding which first-class compatibility targets Glass will actively adapt, starting with `ask`, custom extension tool calls, `context7`, and web search
4. deciding whether `ask` remains a Glass-owned override or should be upstreamed as an RPC-safe extension variant
5. deciding whether to add extension capability metadata so Glass knows what it can surface natively

### If Glass Explores a Pi SDK Runtime Host

The next planning thread should focus on:

1. keeping the runtime host out of process
2. using `createAgentSessionRuntime(...)` as the core session lifecycle primitive
3. using `AuthStorage`, `ModelRegistry`, and `@mariozechner/pi-ai/oauth` for first-class login/config ownership
4. preserving a canonical Glass event layer above provider/runtime specifics
5. deciding whether to preserve Pi RPC semantics or define a richer Glass-specific runtime protocol

## Source References

### Glass

1. `docs/decisions/004-spawned-pi-rpc-runtime-and-canonical-event-normalization.md`
2. `apps/desktop/src/pi-runtime/pi-runtime-worker.ts`
3. `apps/desktop/src/pi-runtime/pi-runtime-service.ts`
4. `apps/desktop/src/pi-runtime/pi-process-manager.ts`
5. `apps/desktop/src/pi-runtime/pi-rpc-client.ts`
6. `apps/desktop/src/pi-runtime/pi-rpc-types.ts`
7. `apps/desktop/src/pi-runtime/pi-runtime-normalizer.ts`
8. `apps/desktop/src/pi-runtime/pi-rpc-event-parser.ts`
9. `apps/desktop/src/main.ts`
10. `apps/desktop/src/preload.ts`
11. `apps/web/src/components/glass/chat-session.tsx`
12. `apps/web/src/components/glass/use-pi-session.ts`
13. `apps/web/src/components/glass/ask-tool.tsx`
14. `apps/web/src/components/glass/pi-chat-rows.tsx`
15. `apps/web/src/lib/tool-renderers.tsx`
16. `apps/web/src/lib/pi-chat-timeline.ts`
17. `~/.pi/agent/extensions/ask.ts`

### Pi / Pi Mono

1. `badlogic/pi-mono/packages/coding-agent/src/modes/rpc/rpc-mode.ts`
2. `badlogic/pi-mono/packages/coding-agent/src/modes/interactive/interactive-mode.ts`
3. `badlogic/pi-mono/packages/coding-agent/src/modes/print-mode.ts`
4. `badlogic/pi-mono/packages/coding-agent/src/core/extensions/types.ts`
5. `badlogic/pi-mono/packages/coding-agent/src/core/extensions/runner.ts`
6. `badlogic/pi-mono/packages/coding-agent/src/core/agent-session.ts`
7. `badlogic/pi-mono/packages/coding-agent/src/core/agent-session-runtime.ts`
8. `badlogic/pi-mono/packages/coding-agent/src/core/auth-storage.ts`
9. `badlogic/pi-mono/packages/coding-agent/docs/rpc.md`
10. `badlogic/pi-mono/packages/coding-agent/docs/json.md`
11. `badlogic/pi-mono/packages/coding-agent/docs/extensions.md`
12. `badlogic/pi-mono/packages/coding-agent/docs/sdk.md`
13. `badlogic/pi-mono/packages/ai/README.md`
14. `badlogic/pi-mono/packages/coding-agent/examples/rpc-extension-ui.ts`
15. `badlogic/pi-mono/packages/coding-agent/examples/sdk/09-api-keys-and-oauth.ts`
16. `badlogic/pi-mono/packages/coding-agent/examples/sdk/13-session-runtime.ts`
17. `badlogic/pi-mono/packages/coding-agent/examples/extensions/questionnaire.ts`

### t3code

1. `pingdotgg/t3code/packages/contracts/src/providerRuntime.ts`
2. `pingdotgg/t3code/apps/server/src/provider/Services/ProviderAdapter.ts`
3. `pingdotgg/t3code/apps/server/src/provider/Layers/CodexAdapter.ts`
4. `pingdotgg/t3code/apps/server/src/provider/Layers/ClaudeAdapter.ts`
5. `pingdotgg/t3code/apps/server/src/provider/Layers/ProviderService.ts`
6. `pingdotgg/t3code/apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts`
7. `pingdotgg/t3code/apps/server/src/orchestration/Layers/ProviderCommandReactor.ts`
8. `pingdotgg/t3code/packages/contracts/src/orchestration.ts`
9. `pingdotgg/t3code/apps/web/src/session-logic.ts`
10. `pingdotgg/t3code/apps/web/src/session-logic.test.ts`
11. `pingdotgg/t3code/apps/web/src/components/chat/ComposerPendingApprovalPanel.tsx`

### Codex

1. `openai/codex/codex-rs/app-server/README.md`
2. `openai/codex/codex-rs/app-server-protocol/schema/typescript/ServerRequest.ts`
3. `openai/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputParams.ts`
4. `openai/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputQuestion.ts`
5. `openai/codex/codex-rs/app-server-protocol/schema/typescript/v2/ToolRequestUserInputResponse.ts`
6. `openai/codex/codex-rs/app-server/tests/suite/v2/request_user_input.rs`
7. `openai/codex/codex-rs/app-server-client/README.md`
8. `openai/codex/codex-rs/exec/src/lib.rs`
9. `openai/codex/codex-rs/tui/src/app/app_server_requests.rs`

## Final Answer to the JSON-Mode Hypothesis

No.

Pi JSON mode does not transport everything.

It transports a streamed event log for one-shot runs. It does not transport the full interactive semantics Glass needs, and it definitely does not transport TUI custom extension UI like the stock `ask` tool.

A future canonical structured transport for Pi could solve a large subset of the current problems if it looked more like a real app-server protocol with:

1. bidirectional request/response semantics
2. long-lived session control
3. explicit interactive request types
4. clear resolution lifecycle
5. surface-capability-aware degradation rules

But that is not what Pi JSON mode is today.
