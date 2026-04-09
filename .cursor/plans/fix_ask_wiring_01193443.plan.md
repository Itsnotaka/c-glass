---
name: fix ask wiring
overview: Four UI surfaces are broken because the runtime split between `WorkingState` and `ProviderRuntimeIngestion` lets the rail and the read-model disagree, and because tool/reasoning/ask events never reach the transcript path. Collapse `WorkingState` into the orchestration read-model so a single normalized event lifecycle drives busy/thinking, ask/approval prompts, and tool cards. Keep `GlassAskTool` as a floating panel — just fix the wiring that feeds it.
todos:
  - id: collapse-working-state
    content: Delete `WorkingState` and derive the rail (busy/thinking/work) from the orchestration read-model so one path drives every visible chat surface.
    status: pending
  - id: materialize-toolcall-blocks
    content: Make `ProviderRuntimeIngestion` emit `toolCall`/`toolResult` content blocks (or equivalent transcript items) so `chat-timeline.ts` can render tool cards instead of treating tool lifecycle as activity-only.
    status: pending
  - id: fix-claude-thinking
    content: Update `ClaudeAdapter` `content_block_start` to register `thinking` blocks and reserve a slot, and confirm `thinking_delta`/`signature_delta` and zero-delta (redacted) thinking cases all surface.
    status: pending
  - id: verify-codex-reasoning
    content: Verify Codex reasoning (`item/reasoning/textDelta`, `summaryTextDelta`, `codex/event/reasoning_content_delta`) emits a normalized `content.delta` that materializes a thinking block; if not, route through the same buffered slot path as Claude.
    status: pending
  - id: fix-rail-visibility-gap
    content: Stop `GlassChatWorking` from hiding the rail before a thinking block has materialized; the rail must remain visible whenever the turn is busy and there is no other visible signal yet.
    status: pending
  - id: wire-ask-and-approval
    content: Confirm `derivePendingUserInputs`/`derivePendingApprovals` see the activities they need from the new ingestion path, and that `GlassAskTool` opens for both Codex `requestUserInput` and Claude tool-permission approvals.
    status: pending
  - id: add-regression-tests
    content: Add focused tests across `projector.test.ts`, the adapter tests, and a runtime/rail test so reasoning-before-text, ask requests, approval requests, and tool-card materialization cannot regress silently.
    status: pending
isProject: false
---

# Fix Ask UI Event Wiring

## Diagnosis

Four user-visible surfaces are broken — the ask prompt, the thinking rail, the approval prompt, and tool cards. They all trace back to the same root cause: there are two independent reducers consuming the same provider stream, and the transcript reducer is missing several mappings.

### The split runtime

- [apps/server/src/orchestration/Layers/WorkingState.ts](apps/server/src/orchestration/Layers/WorkingState.ts) subscribes to `ProviderService.streamEvents` directly and builds `GlassWorkingState` (the rail).
- [apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts](apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts) is the _only_ path that converts provider runtime events into `thread.message.assistant.delta`, `user-input.requested`, and thread activities.
- The two reducers can disagree. `WorkingState` can flip to "busy/thinking" while the transcript path never receives anything to render — the UI looks "stuck in thinking" with nothing visible.

### Tool cards are missing

- [apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts](apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts) maps tool lifecycle events into `OrchestrationThreadActivity` only (`tool.started/updated/completed`, `task.*`, etc.). It never adds `toolCall` blocks to assistant message content.
- [apps/web/src/lib/chat-timeline.ts](apps/web/src/lib/chat-timeline.ts) builds tool rows by walking `assistant.content[type==="toolCall"]` and `role==="toolResult"` items. It does **not** walk `thread.activities`.
- Net result: tool cards never render in the new ingestion path, regardless of provider.

### Claude thinking block gap

- [apps/server/src/provider/Layers/ClaudeAdapter.ts](apps/server/src/provider/Layers/ClaudeAdapter.ts) `content_block_start` (around L1625-1639) handles `text` and `tool_use` but silently drops `content_block.type === "thinking"`.
- `content_block_delta` (L1504-1556) does emit `content.delta` for `thinking_delta` because it forwards `contentIndex`, so streaming thinking deltas usually arrive — but a thinking block that emits zero deltas (e.g. redacted thinking) will never reserve a slot in `BufferedAssistantContent`, leaving the UI in a silent running state.

### Codex reasoning is unverified

- [apps/server/src/provider/Layers/CodexAdapter.ts](apps/server/src/provider/Layers/CodexAdapter.ts) maps `item/reasoning/textDelta`, `summaryTextDelta`, and `codex/event/reasoning_content_delta` into `content.delta` with `reasoning_text`/`reasoning_summary_text` kinds. Needs an end-to-end check that the buffered-content slot is created and that `hasStreamingThinking` flips, especially for ask-flow turns that lead with a `requestUserInput`.

### Ask/approval wiring

- [apps/web/src/components/glass/session/runtime.ts](apps/web/src/components/glass/session/runtime.ts) (`useRuntimeSession`, L155-174) derives `askBox` from `derivePendingUserInputs` / `derivePendingApprovals` over `thread.activities`.
- That depends on `ProviderRuntimeIngestion` actually emitting `user-input.requested` and `approval.requested` activities for both providers. Codex `item/tool/requestUserInput` is wired (CodexAdapter L640-654); Claude tool-permission flow needs to be verified end-to-end and the resulting activity must reach the projector.

### Rail visibility gap

- [apps/web/src/components/glass/chat/rows.tsx](apps/web/src/components/glass/chat/rows.tsx) `GlassChatWorking` (L360-364) returns `null` when `props.thinking && !props.work?.tool && !props.work?.task`. With `thinking` derived from `hasStreamingThinking(thread.messages)`, the rail hides as soon as a thinking block materializes — but until then there is nothing on screen at all. Combined with the server-side split, this is the visible "looks stuck" symptom.

## Change Plan

The change plan is one PR that pulls every broken surface through a single authoritative event lifecycle. Floating panels (`GlassAskTool`) stay where they are — only their data source changes.

### 1. Collapse `WorkingState` into the read-model

- Delete [apps/server/src/orchestration/Layers/WorkingState.ts](apps/server/src/orchestration/Layers/WorkingState.ts) and its `WorkingStateLive` layer.
- Move the rail-state computation into the projector / read-model so `GlassWorkingState` is derived from the same `thread.message.assistant.delta`, `thread.activity.append`, and turn lifecycle events that drive the transcript.
- Update [apps/web/src/lib/thread-session-store.ts](apps/web/src/lib/thread-session-store.ts) to read `work` from the new derived field instead of `WorkingState`'s `PubSub`. Remove `syncWork`/`putWork` callsites that no longer have a producer.
- Keep the public `GlassWorkingState` shape (`tool`, `task`, `startedAt`, etc.) so the UI does not move.
- Acceptance: there is exactly one place in the server that turns provider runtime events into chat state. `WorkingState.ts` is gone.

### 2. Materialize tool-call blocks in `ProviderRuntimeIngestion`

- In [apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts](apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts), when a tool lifecycle event arrives (`tool.started`, `tool.updated`, `tool.completed`, plus the tool-flavored `item.*` events), in addition to the existing activity append, also patch the in-flight assistant message with a `toolCall` content block:
  - On `started`: insert a `toolCall` block with `id`, `name`, and the initial `arguments` object.
  - On `updated`: update the matching `toolCall` block (deep-merge or replace `arguments`).
  - On `completed` with output: append a `toolResult` item to the message stream so the existing `chat-timeline.ts` tool-row builder finds it.
- Reuse the existing `BufferedAssistantContent` slot mechanism so reasoning, text, and tool blocks stay in the order the provider emitted them.
- Verify the projector preserves `content` ordering through `thread.message.assistant.delta` and `thread.message-sent` (see [apps/server/src/orchestration/projector.ts](apps/server/src/orchestration/projector.ts) L360-421) — overwriting `content` is fine as long as we always send the full latest array.
- Acceptance: a turn that runs `bash`, `edit`, or `read` produces inline `toolCall` blocks on the assistant message and `chat-timeline.ts` renders the corresponding `ToolCard` / `BashCard` / `FileEditToolCard` / `ExploredCard` rows.

### 3. Fix Claude `content_block_start` thinking

- In [apps/server/src/provider/Layers/ClaudeAdapter.ts](apps/server/src/provider/Layers/ClaudeAdapter.ts), extend `content_block_start` to handle `content_block.type === "thinking"`: emit a `content.delta` with kind `reasoning_text` and an empty string (or a dedicated `content.start` event if the contract supports one) so `BufferedAssistantContent` reserves a slot at the right `contentIndex`.
- Confirm `content_block_delta` handles both `thinking_delta.thinking` and `signature_delta` consistently — `signature_delta` should not produce visible content but should not reset the slot either.
- For redacted-thinking blocks (zero deltas), make sure the slot reservation alone is enough for the UI to show a "thinking" indicator.
- Acceptance: a Claude turn that streams a thinking block always produces a thinking row in the transcript, including for short or redacted thinking.

### 4. Verify Codex reasoning coverage

- Walk through [apps/server/src/provider/Layers/CodexAdapter.ts](apps/server/src/provider/Layers/CodexAdapter.ts) L966-994 and L1109-1146 with a real ask-flow trace and confirm `content.delta` events with `reasoning_text` / `reasoning_summary_text` kinds reach `BufferedAssistantContent`.
- If the Codex ask flow ever skips reasoning entirely, make sure the transcript still shows a non-blank working state — either a placeholder row or the rail (now derived from the read-model).
- Acceptance: the Codex ask flow either renders a thinking block or keeps the rail visible until the `requestUserInput` activity arrives.

### 5. Fix rail visibility gap

- In [apps/web/src/components/glass/chat/rows.tsx](apps/web/src/components/glass/chat/rows.tsx) `GlassChatWorking`, drop the early `return null` that hides the rail whenever `thinking` is true with no `tool`/`task`. Replace it with: show the rail whenever the turn is busy _and_ nothing else (transcript thinking row, tool card, or live message) is on screen.
- Driving the rail and the transcript from the same read-model (Step 1) makes this trivial: the rail is just a fallback for "busy with no visible signal yet".
- Acceptance: from the moment a turn starts to the moment the first visible block appears, the user always sees either the rail or a transcript row — never a blank streaming state.

### 6. Wire ask/approval prompts

- Confirm both providers emit `user-input.requested` and `approval.requested` activities through `ProviderRuntimeIngestion`. CodexAdapter L640-654 already does `requestUserInput`; verify Claude tool-permission requests turn into `approval.requested` activities.
- Confirm [apps/web/src/session-logic.ts](apps/web/src/session-logic.ts) `derivePendingUserInputs` / `derivePendingApprovals` parse them, and that `useRuntimeSession.askBox` resolves.
- Confirm `GlassAskTool` mounts above the composer in both `HeroSession` and `DockSession` ([apps/web/src/components/glass/chat/session.tsx](apps/web/src/components/glass/chat/session.tsx)) — no UI changes needed, only the data wiring.
- Acceptance: a Codex `requestUserInput` opens `GlassAskTool` with the right questions; a Claude tool-permission request opens `GlassAskTool` with the approval choices; replying via `answerAsk` resolves the activity and closes the panel.

## Validation

Manual reproduction (must all pass):

1. **Codex ask flow** — start a turn that triggers `requestUserInput`. Confirm: rail visible immediately, reasoning row appears (or rail stays up), ask panel opens, replying closes the panel and the turn continues.
2. **Claude ask flow** — start a turn that triggers a tool-permission approval. Confirm: rail visible, thinking row appears, approval panel opens, decision flows back, transcript continues.
3. **Tool card flow (both providers)** — start a turn that runs `bash` / `edit` / `read` / `grep`. Confirm: corresponding `ToolCard` / `BashCard` / `FileEditToolCard` / `ExploredCard` rows render inline in the transcript and update through `started → updated → completed`.
4. **Redacted Claude thinking** — turn with thinking enabled that produces zero text deltas. Confirm: a thinking row still appears.
5. **Rail handoff** — confirm the rail is visible at every point where there is no other visible signal, and disappears the instant a real row materializes.

Automated coverage:

- Extend [apps/server/src/orchestration/projector.test.ts](apps/server/src/orchestration/projector.test.ts) with cases for: reasoning-before-text, tool block ordering, ask/approval activity append, and the collapsed rail derivation.
- Add `ClaudeAdapter` adapter tests for `content_block_start` `thinking`, `thinking_delta`, `signature_delta`, and zero-delta thinking blocks.
- Add `CodexAdapter` adapter tests for the ask-flow trace (reasoning + `requestUserInput`).
- Add a runtime/rail test asserting that `GlassChatWorking` stays visible until the first transcript row appears.
