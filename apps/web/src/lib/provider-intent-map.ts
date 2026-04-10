import {
  PROVIDER_RUNTIME_EVENT_INTENTS,
  PROVIDER_RUNTIME_EVENT_TYPES,
  type ProviderRuntimeEventType,
} from "@glass/contracts";

export type ProviderIntentStatus = "rendered" | "hidden" | "not-mapped-yet";

export interface ProviderIntentComponent {
  componentName: string;
  status: ProviderIntentStatus;
  note: string;
}

export interface ProviderIntentRow extends ProviderIntentComponent {
  eventType: ProviderRuntimeEventType;
  intent: string;
}

export const PROVIDER_INTENT_COMPONENTS = {
  "session.started": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Session lifecycle state only; no dedicated transcript row.",
  },
  "session.configured": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Configuration metadata is not surfaced in chat UI.",
  },
  "session.state.changed": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Runtime status changes are not rendered as transcript rows.",
  },
  "session.exited": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Session exit only updates runtime state.",
  },
  "thread.started": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Provider thread start does not emit a visible chat row.",
  },
  "thread.state.changed": {
    componentName: "TextCard",
    status: "rendered",
    note: "Compaction state is rendered via custom activity rows.",
  },
  "thread.metadata.updated": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Thread metadata updates are reflected in title/state, not transcript rows.",
  },
  "thread.token-usage.updated": {
    componentName: "TextCard",
    status: "hidden",
    note: "Mapped to context-window activity but hidden in transcript filter.",
  },
  "thread.realtime.started": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Realtime stream lifecycle is not shown in chat.",
  },
  "thread.realtime.item-added": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Realtime side-channel items are not surfaced in transcript.",
  },
  "thread.realtime.audio.delta": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Audio deltas are not rendered in current chat UI.",
  },
  "thread.realtime.error": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Realtime errors are not currently mapped into transcript rows.",
  },
  "thread.realtime.closed": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Realtime close notifications are not shown in chat.",
  },
  "turn.started": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Turn start affects session state but not a dedicated row.",
  },
  "turn.completed": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Turn completion finalizes state/messages; no direct row.",
  },
  "turn.aborted": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Turn abort is stateful and not rendered directly.",
  },
  "turn.plan.updated": {
    componentName: "TextCard",
    status: "rendered",
    note: "Plan updates are appended as custom activity rows.",
  },
  "turn.proposed.delta": {
    componentName: "TextCard",
    status: "rendered",
    note: "Proposed plan content is rendered as custom plan rows.",
  },
  "turn.proposed.completed": {
    componentName: "TextCard",
    status: "rendered",
    note: "Completed proposed plan is rendered in transcript.",
  },
  "turn.diff.updated": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Diff checkpoint metadata does not render a chat row.",
  },
  "item.started": {
    componentName: "ToolCard",
    status: "rendered",
    note: "Tool lifecycle starts render as tool rows.",
  },
  "item.updated": {
    componentName: "ToolCard",
    status: "rendered",
    note: "Tool lifecycle updates render in existing tool rows.",
  },
  "item.completed": {
    componentName: "ToolCard",
    status: "rendered",
    note: "Tool completion and tool results render in tool rows.",
  },
  "content.delta": {
    componentName: "AssistantBlock",
    status: "rendered",
    note: "Assistant/reasoning deltas render as assistant/thinking blocks.",
  },
  "request.opened": {
    componentName: "TextCard",
    status: "rendered",
    note: "Approval requests render as custom activity rows.",
  },
  "request.resolved": {
    componentName: "TextCard",
    status: "rendered",
    note: "Approval resolution renders as custom activity rows.",
  },
  "user-input.requested": {
    componentName: "TextCard",
    status: "rendered",
    note: "User-input prompts render as custom activity rows.",
  },
  "user-input.resolved": {
    componentName: "TextCard",
    status: "rendered",
    note: "User-input answers render as custom activity rows.",
  },
  "task.started": {
    componentName: "TextCard",
    status: "hidden",
    note: "Task start is appended but filtered from transcript.",
  },
  "task.progress": {
    componentName: "TextCard",
    status: "rendered",
    note: "Task progress renders as reasoning-update custom rows.",
  },
  "task.completed": {
    componentName: "TextCard",
    status: "hidden",
    note: "Task completion is appended but filtered from transcript.",
  },
  "hook.started": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Hook lifecycle events are not yet mapped to chat rows.",
  },
  "hook.progress": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Hook progress events are not yet mapped to chat rows.",
  },
  "hook.completed": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Hook completion events are not yet mapped to chat rows.",
  },
  "tool.progress": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "High-level tool progress is not currently surfaced in transcript.",
  },
  "tool.summary": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "High-level tool summaries are not currently surfaced in transcript.",
  },
  "auth.status": {
    componentName: "GlassProviderNoticeBanner",
    status: "rendered",
    note: "Auth notices render in the provider notice banner.",
  },
  "account.updated": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Account metadata changes are not shown in chat UI.",
  },
  "account.rate-limits.updated": {
    componentName: "GlassProviderNoticeBanner",
    status: "rendered",
    note: "Rate-limit notices render in the provider notice banner.",
  },
  "mcp.status.updated": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "MCP status changes are not shown in chat UI.",
  },
  "mcp.oauth.completed": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "MCP OAuth completion is not shown in chat UI.",
  },
  "model.rerouted": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Model reroute notices are not currently mapped in chat.",
  },
  "config.warning": {
    componentName: "GlassProviderNoticeBanner",
    status: "rendered",
    note: "Configuration warnings render in the provider notice banner.",
  },
  "deprecation.notice": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Deprecation notices are not currently mapped in chat.",
  },
  "files.persisted": {
    componentName: "NotRendered",
    status: "not-mapped-yet",
    note: "Files persisted events are not rendered in transcript.",
  },
  "runtime.warning": {
    componentName: "TextCard",
    status: "hidden",
    note: "Runtime warnings are appended but hidden by transcript filtering.",
  },
  "runtime.error": {
    componentName: "TextCard",
    status: "rendered",
    note: "Runtime errors render as custom activity rows.",
  },
} as const satisfies Record<ProviderRuntimeEventType, ProviderIntentComponent>;

export const PROVIDER_INTENT_ROWS: ProviderIntentRow[] = PROVIDER_RUNTIME_EVENT_TYPES.map(
  (eventType) => ({
    eventType,
    intent: PROVIDER_RUNTIME_EVENT_INTENTS[eventType],
    ...PROVIDER_INTENT_COMPONENTS[eventType],
  }),
);
