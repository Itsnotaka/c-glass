import {
  ApprovalRequestId,
  type AssistantDeliveryMode,
  CommandId,
  MessageId,
  type OrchestrationAssistantContent,
  type OrchestrationAssistantContentBlock,
  type OrchestrationEvent,
  type OrchestrationProposedPlanId,
  CheckpointRef,
  isToolLifecycleItemType,
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_NOTICE_KIND,
  ThreadId,
  type ThreadTokenUsageSnapshot,
  TurnId,
  type OrchestrationThreadActivity,
  type ProviderRuntimeEvent,
} from "@glass/contracts";
import { Cache, Cause, Duration, Effect, Layer, Option, Stream } from "effect";
import { makeDrainableWorker } from "@glass/shared/DrainableWorker";

import { ProviderService } from "../../provider/Services/ProviderService.ts";
import { ProjectionTurnRepository } from "../../persistence/Services/ProjectionTurns.ts";
import { ProjectionTurnRepositoryLive } from "../../persistence/Layers/ProjectionTurns.ts";
import { resolveThreadWorkspaceCwd } from "../../checkpointing/Utils.ts";
import { isGitRepository } from "../../git/Utils.ts";
import { OrchestrationEngineService } from "../Services/OrchestrationEngine.ts";
import {
  ProviderRuntimeIngestionService,
  type ProviderRuntimeIngestionShape,
} from "../Services/ProviderRuntimeIngestion.ts";
import { ServerSettingsService } from "../../serverSettings.ts";

const providerTurnKey = (threadId: ThreadId, turnId: TurnId) => `${threadId}:${turnId}`;
const providerCommandId = (event: ProviderRuntimeEvent, tag: string): CommandId =>
  CommandId.makeUnsafe(`provider:${event.eventId}:${tag}:${crypto.randomUUID()}`);

const TURN_MESSAGE_IDS_BY_TURN_CACHE_CAPACITY = 10_000;
const TURN_MESSAGE_IDS_BY_TURN_TTL = Duration.minutes(120);
const BUFFERED_MESSAGE_TEXT_BY_MESSAGE_ID_CACHE_CAPACITY = 20_000;
const BUFFERED_MESSAGE_TEXT_BY_MESSAGE_ID_TTL = Duration.minutes(120);
const BUFFERED_MESSAGE_CONTENT_BY_MESSAGE_ID_CACHE_CAPACITY = 20_000;
const BUFFERED_MESSAGE_CONTENT_BY_MESSAGE_ID_TTL = Duration.minutes(120);
const BUFFERED_PROPOSED_PLAN_BY_ID_CACHE_CAPACITY = 10_000;
const BUFFERED_PROPOSED_PLAN_BY_ID_TTL = Duration.minutes(120);
const MAX_BUFFERED_ASSISTANT_CHARS = 24_000;
const STRICT_PROVIDER_LIFECYCLE_GUARD = process.env.GLASS_STRICT_PROVIDER_LIFECYCLE_GUARD !== "0";

type TurnStartRequestedDomainEvent = Extract<
  OrchestrationEvent,
  { type: "thread.turn-start-requested" }
>;

type RuntimeIngestionInput =
  | {
      source: "runtime";
      event: ProviderRuntimeEvent;
    }
  | {
      source: "domain";
      event: TurnStartRequestedDomainEvent;
    };

function toTurnId(value: TurnId | string | undefined): TurnId | undefined {
  return value === undefined ? undefined : TurnId.makeUnsafe(String(value));
}

function assistantMessageId(event: ProviderRuntimeEvent): MessageId {
  const turnId = toTurnId(event.turnId);
  if (turnId) {
    return MessageId.makeUnsafe(`assistant:${turnId}`);
  }
  return MessageId.makeUnsafe(`assistant:${event.itemId ?? event.eventId}`);
}

function toApprovalRequestId(value: string | undefined): ApprovalRequestId | undefined {
  return value === undefined ? undefined : ApprovalRequestId.makeUnsafe(value);
}

function sameId(left: string | null | undefined, right: string | null | undefined): boolean {
  if (left === null || left === undefined || right === null || right === undefined) {
    return false;
  }
  return left === right;
}

function truncateDetail(value: string, limit = 180): string {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function obj(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function str(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const next = value.trim();
  if (next.length === 0) {
    return undefined;
  }
  return next;
}

function num(value: unknown): number | undefined {
  if (typeof value !== "number") {
    return undefined;
  }
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function iso(value: unknown): string | undefined {
  if (typeof value === "string") {
    const stamp = Date.parse(value);
    if (!Number.isFinite(stamp)) {
      return undefined;
    }
    return new Date(stamp).toISOString();
  }

  const stamp = num(value);
  if (stamp === undefined || stamp <= 0) {
    return undefined;
  }

  return new Date(stamp > 100_000_000_000 ? stamp : stamp * 1_000).toISOString();
}

function label(provider: ProviderRuntimeEvent["provider"]): string {
  return PROVIDER_DISPLAY_NAMES[provider];
}

function rate(event: Extract<ProviderRuntimeEvent, { type: "account.rate-limits.updated" }>) {
  const raw = obj(event.payload.rateLimits);
  const info = obj(raw?.rate_limit_info) ?? raw;
  const status = str(info?.status);
  const over = str(info?.overageStatus);
  const blocked = status === "rejected" || over === "rejected";
  if (!blocked) return [];

  const name = label(event.provider);
  const title = `${name} rate limit reached`;
  const until = iso(info?.overageResetsAt) ?? iso(info?.resetsAt);
  const payload: Record<string, unknown> = {
    provider: event.provider,
    level: "warning",
    title,
    detail: `${name} is currently rate limited for this thread.`,
    raw: event.payload.rateLimits,
  };
  if (until) {
    payload.until = until;
  }

  const activity: OrchestrationThreadActivity = {
    id: event.eventId,
    createdAt: event.createdAt,
    tone: "info",
    kind: PROVIDER_NOTICE_KIND.rateLimit,
    summary: title,
    payload,
    turnId: toTurnId(event.turnId) ?? null,
  };
  return [activity];
}

function auth(event: Extract<ProviderRuntimeEvent, { type: "auth.status" }>) {
  const err = str(event.payload.error);
  if (!err) return [];

  const name = label(event.provider);
  const title = `${name} authentication issue`;
  const activity: OrchestrationThreadActivity = {
    id: event.eventId,
    createdAt: event.createdAt,
    tone: "error",
    kind: PROVIDER_NOTICE_KIND.auth,
    summary: title,
    payload: {
      provider: event.provider,
      level: "error",
      title,
      detail: err,
      raw: event.payload,
    },
    turnId: toTurnId(event.turnId) ?? null,
  };
  return [activity];
}

function config(event: Extract<ProviderRuntimeEvent, { type: "config.warning" }>) {
  const payload: Record<string, unknown> = {
    provider: event.provider,
    level: "warning",
    title: event.payload.summary,
    raw: event.payload,
  };
  if (event.payload.details) {
    payload.detail = event.payload.details;
  }

  const activity: OrchestrationThreadActivity = {
    id: event.eventId,
    createdAt: event.createdAt,
    tone: "info",
    kind: PROVIDER_NOTICE_KIND.config,
    summary: event.payload.summary,
    payload,
    turnId: toTurnId(event.turnId) ?? null,
  };
  return [activity];
}

function normalizeProposedPlanMarkdown(planMarkdown: string | undefined): string | undefined {
  const trimmed = planMarkdown?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
}

function proposedPlanIdForTurn(threadId: ThreadId, turnId: TurnId): string {
  return `plan:${threadId}:turn:${turnId}`;
}

function proposedPlanIdFromEvent(event: ProviderRuntimeEvent, threadId: ThreadId): string {
  const turnId = toTurnId(event.turnId);
  if (turnId) {
    return proposedPlanIdForTurn(threadId, turnId);
  }
  if (event.itemId) {
    return `plan:${threadId}:item:${event.itemId}`;
  }
  return `plan:${threadId}:event:${event.eventId}`;
}

function buildContextWindowActivityPayload(
  event: ProviderRuntimeEvent,
): ThreadTokenUsageSnapshot | undefined {
  if (event.type !== "thread.token-usage.updated" || event.payload.usage.usedTokens <= 0) {
    return undefined;
  }
  return event.payload.usage;
}

function normalizeRuntimeTurnState(
  value: string | undefined,
): "completed" | "failed" | "interrupted" | "cancelled" {
  switch (value) {
    case "failed":
    case "interrupted":
    case "cancelled":
    case "completed":
      return value;
    default:
      return "completed";
  }
}

function toolName(data: unknown, fallback: { title?: string; itemType?: string }): string {
  const rec = obj(data);
  const direct = str(rec?.toolName) ?? str(rec?.tool_name) ?? str(rec?.name);
  if (direct) return direct;
  const item = obj(rec?.item);
  const nested =
    item &&
    (str(item.toolName) ??
      str(item.tool_name) ??
      str(item.name) ??
      str(item.type) ??
      str(item.kind));
  return nested || fallback.title || fallback.itemType || "tool";
}

function toolArgs(data: unknown): Record<string, unknown> | undefined {
  const rec = obj(data);
  if (!rec) return undefined;
  const direct = obj(rec.input) ?? obj(rec.arguments) ?? obj(rec.args);
  if (direct) return direct;
  const item = obj(rec.item);
  if (!item) return undefined;
  const nested = obj(item.input) ?? obj(item.arguments) ?? obj(item.args);
  if (nested) return nested;
  // Codex items carry command/path/etc. directly on the item — surface the rest.
  const { id: _id, type: _type, kind: _kind, ...rest } = item;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

function toolResult(data: unknown): { text: string; details?: unknown } {
  const rec = obj(data);
  if (!rec) return { text: "" };
  const result = rec.result ?? rec.output ?? obj(rec.item)?.output ?? obj(rec.item)?.result;
  if (typeof result === "string") return { text: result, details: result };
  const o = obj(result);
  if (o) {
    const text = str(o.text) ?? str(o.content) ?? str(o.output);
    if (text) return { text, details: result };
  }
  if (Array.isArray(result)) {
    const parts = result
      .map((entry) => obj(entry))
      .filter((entry): entry is Record<string, unknown> => entry !== null)
      .map((entry) => str(entry.text) ?? str(entry.content))
      .filter((text): text is string => text !== undefined);
    if (parts.length > 0) return { text: parts.join("\n"), details: result };
  }
  return result !== undefined ? { text: "", details: result } : { text: "" };
}

type BufferedAssistantContent = {
  blocks: Record<string, OrchestrationAssistantContentBlock>;
  summary: Record<string, string>;
  textSlot: number | null;
  thinkingSlot: number | null;
  toolSlots: Record<string, number>;
  reservedThinkingSlots: Record<string, true>;
};

function emptyAssistantContent(): BufferedAssistantContent {
  return {
    blocks: {},
    summary: {},
    textSlot: null,
    thinkingSlot: null,
    toolSlots: {},
    reservedThinkingSlots: {},
  };
}

function nextAssistantSlot(state: BufferedAssistantContent) {
  const keys = Object.keys(state.blocks)
    .map((key) => Number.parseInt(key, 10))
    .filter((key) => Number.isFinite(key));
  if (keys.length === 0) {
    return 0;
  }
  return Math.max(...keys) + 1;
}

function joinAssistantSummary(summary: BufferedAssistantContent["summary"]) {
  const text = Object.entries(summary)
    .map(([key, val]) => [Number.parseInt(key, 10), val] as const)
    .filter(([key]) => Number.isFinite(key))
    .toSorted((left, right) => left[0] - right[0])
    .map(([, val]) => val.trim())
    .filter((val) => val.length > 0)
    .join("\n\n");
  return text.length > 0 ? text : undefined;
}

function assistantSlot(
  state: BufferedAssistantContent,
  kind: "text" | "thinking",
  idx: number | undefined,
) {
  if (idx !== undefined) {
    if (kind === "text" && state.textSlot === null) {
      state.textSlot = idx;
    }
    if (kind === "thinking" && state.thinkingSlot === null) {
      state.thinkingSlot = idx;
    }
    return idx;
  }

  if (kind === "text" && state.textSlot !== null) {
    return state.textSlot;
  }
  if (kind === "thinking" && state.thinkingSlot !== null) {
    return state.thinkingSlot;
  }

  const slot = nextAssistantSlot(state);
  if (kind === "text") {
    state.textSlot = slot;
  } else {
    state.thinkingSlot = slot;
  }
  return slot;
}

type AssistantContentOp =
  | {
      kind: "assistant_text" | "reasoning_text" | "reasoning_summary_text";
      delta: string;
      contentIndex?: number;
      summaryIndex?: number;
    }
  | {
      kind: "reserve_thinking";
      contentIndex?: number;
    }
  | {
      kind: "tool_call";
      itemId: string;
      name: string;
      arguments?: Record<string, unknown>;
    };

function applyAssistantContent(state: BufferedAssistantContent, op: AssistantContentOp) {
  const next: BufferedAssistantContent = {
    blocks: { ...state.blocks },
    summary: { ...state.summary },
    textSlot: state.textSlot,
    thinkingSlot: state.thinkingSlot,
    toolSlots: { ...state.toolSlots },
    reservedThinkingSlots: { ...state.reservedThinkingSlots },
  };

  if (op.kind === "tool_call") {
    const existing = next.toolSlots[op.itemId];
    const slot = existing ?? nextAssistantSlot(next);
    next.toolSlots[op.itemId] = slot;
    next.blocks[String(slot)] = {
      type: "toolCall",
      id: op.itemId,
      name: op.name,
      ...(op.arguments !== undefined ? { arguments: op.arguments } : {}),
    };
    return next;
  }

  if (op.kind === "reserve_thinking") {
    const slot = assistantSlot(next, "thinking", op.contentIndex);
    next.reservedThinkingSlots[String(slot)] = true;
    const cur = next.blocks[String(slot)];
    if (!cur || cur.type !== "thinking") {
      next.blocks[String(slot)] = { type: "thinking", thinking: "" };
    }
    return next;
  }

  if (op.kind === "assistant_text") {
    const slot = assistantSlot(next, "text", op.contentIndex);
    const cur = next.blocks[String(slot)];
    next.blocks[String(slot)] = {
      type: "text",
      text: `${cur?.type === "text" ? cur.text : ""}${op.delta}`,
    };
    return next;
  }

  const slot = assistantSlot(next, "thinking", op.contentIndex);
  const cur = next.blocks[String(slot)];
  const summary =
    op.kind === "reasoning_summary_text"
      ? (() => {
          next.summary[String(op.summaryIndex ?? 0)] =
            `${next.summary[String(op.summaryIndex ?? 0)] ?? ""}${op.delta}`;
          return joinAssistantSummary(next.summary);
        })()
      : cur?.type === "thinking"
        ? cur.summary
        : undefined;

  next.blocks[String(slot)] = {
    type: "thinking",
    thinking:
      op.kind === "reasoning_text"
        ? `${cur?.type === "thinking" ? cur.thinking : ""}${op.delta}`
        : cur?.type === "thinking"
          ? cur.thinking
          : "",
    ...(summary !== undefined ? { summary } : {}),
  };
  return next;
}

function materializeAssistantContent(
  state: BufferedAssistantContent | undefined,
): OrchestrationAssistantContent {
  if (!state) {
    return [];
  }

  return Object.entries(state.blocks)
    .map(([key, block]) => [Number.parseInt(key, 10), block, key] as const)
    .filter(([key]) => Number.isFinite(key))
    .toSorted((left, right) => left[0] - right[0])
    .filter(([, block, key]) => {
      if (block.type === "text") {
        return block.text.length > 0;
      }
      if (block.type === "thinking") {
        return (
          block.thinking.length > 0 ||
          (block.summary?.length ?? 0) > 0 ||
          state.reservedThinkingSlots[key] === true
        );
      }
      if (block.type === "toolCall") {
        return true;
      }
      return false;
    })
    .map(([, block]) => block);
}

function orchestrationSessionStatusFromRuntimeState(
  state: "starting" | "running" | "waiting" | "ready" | "interrupted" | "stopped" | "error",
): "starting" | "running" | "ready" | "interrupted" | "stopped" | "error" {
  switch (state) {
    case "starting":
      return "starting";
    case "running":
    case "waiting":
      return "running";
    case "ready":
      return "ready";
    case "interrupted":
      return "interrupted";
    case "stopped":
      return "stopped";
    case "error":
      return "error";
  }
}

function requestKindFromCanonicalRequestType(
  requestType: string | undefined,
): "command" | "file-read" | "file-change" | undefined {
  switch (requestType) {
    case "command_execution_approval":
    case "exec_command_approval":
      return "command";
    case "file_read_approval":
      return "file-read";
    case "file_change_approval":
    case "apply_patch_approval":
      return "file-change";
    default:
      return undefined;
  }
}

function runtimeEventToActivities(
  event: ProviderRuntimeEvent,
): ReadonlyArray<OrchestrationThreadActivity> {
  const maybeSequence = (() => {
    const eventWithSequence = event as ProviderRuntimeEvent & { sessionSequence?: number };
    return eventWithSequence.sessionSequence !== undefined
      ? { sequence: eventWithSequence.sessionSequence }
      : {};
  })();
  switch (event.type) {
    case "request.opened": {
      if (event.payload.requestType === "tool_user_input") {
        return [];
      }
      const requestKind = requestKindFromCanonicalRequestType(event.payload.requestType);
      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: "approval",
          kind: "approval.requested",
          summary:
            requestKind === "command"
              ? "Command approval requested"
              : requestKind === "file-read"
                ? "File-read approval requested"
                : requestKind === "file-change"
                  ? "File-change approval requested"
                  : "Approval requested",
          payload: {
            requestId: toApprovalRequestId(event.requestId),
            ...(requestKind ? { requestKind } : {}),
            requestType: event.payload.requestType,
            ...(event.payload.detail ? { detail: truncateDetail(event.payload.detail) } : {}),
          },
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    case "request.resolved": {
      if (event.payload.requestType === "tool_user_input") {
        return [];
      }
      const requestKind = requestKindFromCanonicalRequestType(event.payload.requestType);
      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: "approval",
          kind: "approval.resolved",
          summary: "Approval resolved",
          payload: {
            requestId: toApprovalRequestId(event.requestId),
            ...(requestKind ? { requestKind } : {}),
            requestType: event.payload.requestType,
            ...(event.payload.decision ? { decision: event.payload.decision } : {}),
          },
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    case "account.rate-limits.updated": {
      return rate(event);
    }

    case "auth.status": {
      return auth(event);
    }

    case "config.warning": {
      return config(event);
    }

    case "runtime.error": {
      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: "error",
          kind: "runtime.error",
          summary: "Runtime error",
          payload: {
            message: truncateDetail(event.payload.message),
          },
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    case "runtime.warning": {
      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: "info",
          kind: "runtime.warning",
          summary: "Runtime warning",
          payload: {
            message: truncateDetail(event.payload.message),
            ...(event.payload.detail !== undefined ? { detail: event.payload.detail } : {}),
          },
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    case "turn.plan.updated": {
      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: "info",
          kind: "turn.plan.updated",
          summary: "Plan updated",
          payload: {
            plan: event.payload.plan,
            ...(event.payload.explanation !== undefined
              ? { explanation: event.payload.explanation }
              : {}),
          },
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    case "user-input.requested": {
      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: "info",
          kind: "user-input.requested",
          summary: "User input requested",
          payload: {
            ...(event.requestId ? { requestId: event.requestId } : {}),
            questions: event.payload.questions,
          },
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    case "user-input.resolved": {
      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: "info",
          kind: "user-input.resolved",
          summary: "User input submitted",
          payload: {
            ...(event.requestId ? { requestId: event.requestId } : {}),
            answers: event.payload.answers,
          },
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    case "task.started": {
      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: "info",
          kind: "task.started",
          summary:
            event.payload.taskType === "plan"
              ? "Plan task started"
              : event.payload.taskType
                ? `${event.payload.taskType} task started`
                : "Task started",
          payload: {
            taskId: event.payload.taskId,
            ...(event.payload.taskType ? { taskType: event.payload.taskType } : {}),
            ...(event.payload.description
              ? { detail: truncateDetail(event.payload.description) }
              : {}),
          },
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    case "task.progress": {
      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: "info",
          kind: "task.progress",
          summary: "Reasoning update",
          payload: {
            taskId: event.payload.taskId,
            detail: truncateDetail(event.payload.summary ?? event.payload.description),
            ...(event.payload.summary ? { summary: truncateDetail(event.payload.summary) } : {}),
            ...(event.payload.lastToolName ? { lastToolName: event.payload.lastToolName } : {}),
            ...(event.payload.usage !== undefined ? { usage: event.payload.usage } : {}),
          },
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    case "task.completed": {
      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: event.payload.status === "failed" ? "error" : "info",
          kind: "task.completed",
          summary:
            event.payload.status === "failed"
              ? "Task failed"
              : event.payload.status === "stopped"
                ? "Task stopped"
                : "Task completed",
          payload: {
            taskId: event.payload.taskId,
            status: event.payload.status,
            ...(event.payload.summary ? { detail: truncateDetail(event.payload.summary) } : {}),
            ...(event.payload.usage !== undefined ? { usage: event.payload.usage } : {}),
          },
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    case "thread.state.changed": {
      if (event.payload.state !== "compacted") {
        return [];
      }

      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: "info",
          kind: "context-compaction",
          summary: "Context compacted",
          payload: {
            state: event.payload.state,
            ...(event.payload.detail !== undefined ? { detail: event.payload.detail } : {}),
          },
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    case "thread.token-usage.updated": {
      const payload = buildContextWindowActivityPayload(event);
      if (!payload) {
        return [];
      }

      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: "info",
          kind: "context-window.updated",
          summary: "Context window updated",
          payload,
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    case "item.updated": {
      if (!isToolLifecycleItemType(event.payload.itemType)) {
        return [];
      }
      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: "tool",
          kind: "tool.updated",
          summary: event.payload.title ?? "Tool updated",
          payload: {
            itemType: event.payload.itemType,
            ...(event.payload.status ? { status: event.payload.status } : {}),
            ...(event.payload.detail ? { detail: truncateDetail(event.payload.detail) } : {}),
            ...(event.payload.data !== undefined ? { data: event.payload.data } : {}),
          },
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    case "item.completed": {
      if (!isToolLifecycleItemType(event.payload.itemType)) {
        return [];
      }
      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: "tool",
          kind: "tool.completed",
          summary: event.payload.title ?? "Tool",
          payload: {
            itemType: event.payload.itemType,
            ...(event.payload.detail ? { detail: truncateDetail(event.payload.detail) } : {}),
          },
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    case "item.started": {
      if (!isToolLifecycleItemType(event.payload.itemType)) {
        return [];
      }
      return [
        {
          id: event.eventId,
          createdAt: event.createdAt,
          tone: "tool",
          kind: "tool.started",
          summary: `${event.payload.title ?? "Tool"} started`,
          payload: {
            itemType: event.payload.itemType,
            ...(event.payload.detail ? { detail: truncateDetail(event.payload.detail) } : {}),
          },
          turnId: toTurnId(event.turnId) ?? null,
          ...maybeSequence,
        },
      ];
    }

    default:
      break;
  }

  return [];
}

const make = Effect.fn("make")(function* () {
  const orchestrationEngine = yield* OrchestrationEngineService;
  const providerService = yield* ProviderService;
  const projectionTurnRepository = yield* ProjectionTurnRepository;
  const serverSettingsService = yield* ServerSettingsService;

  const turnMessageIdsByTurnKey = yield* Cache.make<string, Set<MessageId>>({
    capacity: TURN_MESSAGE_IDS_BY_TURN_CACHE_CAPACITY,
    timeToLive: TURN_MESSAGE_IDS_BY_TURN_TTL,
    lookup: () => Effect.succeed(new Set<MessageId>()),
  });

  const bufferedAssistantTextByMessageId = yield* Cache.make<MessageId, string>({
    capacity: BUFFERED_MESSAGE_TEXT_BY_MESSAGE_ID_CACHE_CAPACITY,
    timeToLive: BUFFERED_MESSAGE_TEXT_BY_MESSAGE_ID_TTL,
    lookup: () => Effect.succeed(""),
  });

  const bufferedAssistantContentByMessageId = yield* Cache.make<
    MessageId,
    BufferedAssistantContent
  >({
    capacity: BUFFERED_MESSAGE_CONTENT_BY_MESSAGE_ID_CACHE_CAPACITY,
    timeToLive: BUFFERED_MESSAGE_CONTENT_BY_MESSAGE_ID_TTL,
    lookup: () => Effect.succeed(emptyAssistantContent()),
  });

  const bufferedProposedPlanById = yield* Cache.make<string, { text: string; createdAt: string }>({
    capacity: BUFFERED_PROPOSED_PLAN_BY_ID_CACHE_CAPACITY,
    timeToLive: BUFFERED_PROPOSED_PLAN_BY_ID_TTL,
    lookup: () => Effect.succeed({ text: "", createdAt: "" }),
  });

  const isGitRepoForThread = Effect.fn("isGitRepoForThread")(function* (threadId: ThreadId) {
    const readModel = yield* orchestrationEngine.getReadModel();
    const thread = readModel.threads.find((entry) => entry.id === threadId);
    if (!thread) {
      return false;
    }
    const workspaceCwd = resolveThreadWorkspaceCwd({
      thread,
      projects: readModel.projects,
    });
    if (!workspaceCwd) {
      return false;
    }
    return isGitRepository(workspaceCwd);
  });

  const rememberAssistantMessageId = (threadId: ThreadId, turnId: TurnId, messageId: MessageId) =>
    Cache.getOption(turnMessageIdsByTurnKey, providerTurnKey(threadId, turnId)).pipe(
      Effect.flatMap((existingIds) =>
        Cache.set(
          turnMessageIdsByTurnKey,
          providerTurnKey(threadId, turnId),
          Option.match(existingIds, {
            onNone: () => new Set([messageId]),
            onSome: (ids) => {
              const nextIds = new Set(ids);
              nextIds.add(messageId);
              return nextIds;
            },
          }),
        ),
      ),
    );

  const forgetAssistantMessageId = (threadId: ThreadId, turnId: TurnId, messageId: MessageId) =>
    Cache.getOption(turnMessageIdsByTurnKey, providerTurnKey(threadId, turnId)).pipe(
      Effect.flatMap((existingIds) =>
        Option.match(existingIds, {
          onNone: () => Effect.void,
          onSome: (ids) => {
            const nextIds = new Set(ids);
            nextIds.delete(messageId);
            if (nextIds.size === 0) {
              return Cache.invalidate(turnMessageIdsByTurnKey, providerTurnKey(threadId, turnId));
            }
            return Cache.set(turnMessageIdsByTurnKey, providerTurnKey(threadId, turnId), nextIds);
          },
        }),
      ),
    );

  const getAssistantMessageIdsForTurn = (threadId: ThreadId, turnId: TurnId) =>
    Cache.getOption(turnMessageIdsByTurnKey, providerTurnKey(threadId, turnId)).pipe(
      Effect.map((existingIds) =>
        Option.getOrElse(existingIds, (): Set<MessageId> => new Set<MessageId>()),
      ),
    );

  const clearAssistantMessageIdsForTurn = (threadId: ThreadId, turnId: TurnId) =>
    Cache.invalidate(turnMessageIdsByTurnKey, providerTurnKey(threadId, turnId));

  const appendBufferedAssistantText = (messageId: MessageId, delta: string) =>
    Cache.getOption(bufferedAssistantTextByMessageId, messageId).pipe(
      Effect.flatMap(
        Effect.fn("appendBufferedAssistantText")(function* (existingText) {
          const nextText = Option.match(existingText, {
            onNone: () => delta,
            onSome: (text) => `${text}${delta}`,
          });
          if (nextText.length <= MAX_BUFFERED_ASSISTANT_CHARS) {
            yield* Cache.set(bufferedAssistantTextByMessageId, messageId, nextText);
            return "";
          }

          // Safety valve: flush full buffered text as an assistant delta to cap memory.
          yield* Cache.invalidate(bufferedAssistantTextByMessageId, messageId);
          return nextText;
        }),
      ),
    );

  const takeBufferedAssistantText = (messageId: MessageId) =>
    Cache.getOption(bufferedAssistantTextByMessageId, messageId).pipe(
      Effect.flatMap((existingText) =>
        Cache.invalidate(bufferedAssistantTextByMessageId, messageId).pipe(
          Effect.as(Option.getOrElse(existingText, () => "")),
        ),
      ),
    );

  const clearBufferedAssistantText = (messageId: MessageId) =>
    Cache.invalidate(bufferedAssistantTextByMessageId, messageId);

  const applyBufferedAssistantContent = (messageId: MessageId, op: AssistantContentOp) =>
    Cache.getOption(bufferedAssistantContentByMessageId, messageId).pipe(
      Effect.flatMap((existing) => {
        const next = applyAssistantContent(Option.getOrElse(existing, emptyAssistantContent), op);
        return Cache.set(bufferedAssistantContentByMessageId, messageId, next).pipe(
          Effect.as(materializeAssistantContent(next)),
        );
      }),
    );

  const takeBufferedAssistantContent = (messageId: MessageId) =>
    Cache.getOption(bufferedAssistantContentByMessageId, messageId).pipe(
      Effect.flatMap((existing) =>
        Cache.invalidate(bufferedAssistantContentByMessageId, messageId).pipe(
          Effect.as(materializeAssistantContent(Option.getOrUndefined(existing))),
        ),
      ),
    );

  const clearBufferedAssistantContent = (messageId: MessageId) =>
    Cache.invalidate(bufferedAssistantContentByMessageId, messageId);

  const appendBufferedProposedPlan = (planId: string, delta: string, createdAt: string) =>
    Cache.getOption(bufferedProposedPlanById, planId).pipe(
      Effect.flatMap((existingEntry) => {
        const existing = Option.getOrUndefined(existingEntry);
        return Cache.set(bufferedProposedPlanById, planId, {
          text: `${existing?.text ?? ""}${delta}`,
          createdAt:
            existing?.createdAt && existing.createdAt.length > 0 ? existing.createdAt : createdAt,
        });
      }),
    );

  const takeBufferedProposedPlan = (planId: string) =>
    Cache.getOption(bufferedProposedPlanById, planId).pipe(
      Effect.flatMap((existingEntry) =>
        Cache.invalidate(bufferedProposedPlanById, planId).pipe(
          Effect.as(Option.getOrUndefined(existingEntry)),
        ),
      ),
    );

  const clearBufferedProposedPlan = (planId: string) =>
    Cache.invalidate(bufferedProposedPlanById, planId);

  const clearAssistantMessageState = (messageId: MessageId) =>
    Effect.all([
      clearBufferedAssistantText(messageId),
      clearBufferedAssistantContent(messageId),
    ]).pipe(Effect.asVoid);

  const finalizeAssistantMessage = Effect.fn("finalizeAssistantMessage")(function* (input: {
    event: ProviderRuntimeEvent;
    threadId: ThreadId;
    messageId: MessageId;
    turnId?: TurnId;
    createdAt: string;
    commandTag: string;
    finalDeltaCommandTag: string;
    fallbackText?: string;
  }) {
    const bufferedText = yield* takeBufferedAssistantText(input.messageId);
    const bufferedContent = yield* takeBufferedAssistantContent(input.messageId);
    const text =
      bufferedText.length > 0
        ? bufferedText
        : (input.fallbackText?.trim().length ?? 0) > 0
          ? input.fallbackText!
          : "";
    const content =
      bufferedContent.length > 0
        ? bufferedContent
        : text.length > 0
          ? ([{ type: "text", text }] satisfies OrchestrationAssistantContent)
          : [];

    if (text.length > 0 || content.length > 0) {
      yield* orchestrationEngine.dispatch({
        type: "thread.message.assistant.delta",
        commandId: providerCommandId(input.event, input.finalDeltaCommandTag),
        threadId: input.threadId,
        messageId: input.messageId,
        delta: text,
        ...(content.length > 0 ? { content } : {}),
        ...(input.turnId ? { turnId: input.turnId } : {}),
        createdAt: input.createdAt,
      });
    }

    yield* orchestrationEngine.dispatch({
      type: "thread.message.assistant.complete",
      commandId: providerCommandId(input.event, input.commandTag),
      threadId: input.threadId,
      messageId: input.messageId,
      ...(input.turnId ? { turnId: input.turnId } : {}),
      createdAt: input.createdAt,
    });
    yield* clearAssistantMessageState(input.messageId);
  });

  const upsertProposedPlan = Effect.fn("upsertProposedPlan")(function* (input: {
    event: ProviderRuntimeEvent;
    threadId: ThreadId;
    threadProposedPlans: ReadonlyArray<{
      id: string;
      createdAt: string;
      implementedAt: string | null;
      implementationThreadId: ThreadId | null;
    }>;
    planId: string;
    turnId?: TurnId;
    planMarkdown: string | undefined;
    createdAt: string;
    updatedAt: string;
  }) {
    const planMarkdown = normalizeProposedPlanMarkdown(input.planMarkdown);
    if (!planMarkdown) {
      return;
    }

    const existingPlan = input.threadProposedPlans.find((entry) => entry.id === input.planId);
    yield* orchestrationEngine.dispatch({
      type: "thread.proposed-plan.upsert",
      commandId: providerCommandId(input.event, "proposed-plan-upsert"),
      threadId: input.threadId,
      proposedPlan: {
        id: input.planId,
        turnId: input.turnId ?? null,
        planMarkdown,
        implementedAt: existingPlan?.implementedAt ?? null,
        implementationThreadId: existingPlan?.implementationThreadId ?? null,
        createdAt: existingPlan?.createdAt ?? input.createdAt,
        updatedAt: input.updatedAt,
      },
      createdAt: input.updatedAt,
    });
  });

  const finalizeBufferedProposedPlan = Effect.fn("finalizeBufferedProposedPlan")(function* (input: {
    event: ProviderRuntimeEvent;
    threadId: ThreadId;
    threadProposedPlans: ReadonlyArray<{
      id: string;
      createdAt: string;
      implementedAt: string | null;
      implementationThreadId: ThreadId | null;
    }>;
    planId: string;
    turnId?: TurnId;
    fallbackMarkdown?: string;
    updatedAt: string;
  }) {
    const bufferedPlan = yield* takeBufferedProposedPlan(input.planId);
    const bufferedMarkdown = normalizeProposedPlanMarkdown(bufferedPlan?.text);
    const fallbackMarkdown = normalizeProposedPlanMarkdown(input.fallbackMarkdown);
    const planMarkdown = bufferedMarkdown ?? fallbackMarkdown;
    if (!planMarkdown) {
      return;
    }

    yield* upsertProposedPlan({
      event: input.event,
      threadId: input.threadId,
      threadProposedPlans: input.threadProposedPlans,
      planId: input.planId,
      ...(input.turnId ? { turnId: input.turnId } : {}),
      planMarkdown,
      createdAt:
        bufferedPlan?.createdAt && bufferedPlan.createdAt.length > 0
          ? bufferedPlan.createdAt
          : input.updatedAt,
      updatedAt: input.updatedAt,
    });
    yield* clearBufferedProposedPlan(input.planId);
  });

  const clearTurnStateForSession = Effect.fn("clearTurnStateForSession")(function* (
    threadId: ThreadId,
  ) {
    const prefix = `${threadId}:`;
    const proposedPlanPrefix = `plan:${threadId}:`;
    const turnKeys = Array.from(yield* Cache.keys(turnMessageIdsByTurnKey));
    const proposedPlanKeys = Array.from(yield* Cache.keys(bufferedProposedPlanById));
    yield* Effect.forEach(
      turnKeys,
      Effect.fn(function* (key) {
        if (!key.startsWith(prefix)) {
          return;
        }

        const messageIds = yield* Cache.getOption(turnMessageIdsByTurnKey, key);
        if (Option.isSome(messageIds)) {
          yield* Effect.forEach(messageIds.value, clearAssistantMessageState, {
            concurrency: 1,
          }).pipe(Effect.asVoid);
        }

        yield* Cache.invalidate(turnMessageIdsByTurnKey, key);
      }),
      { concurrency: 1 },
    ).pipe(Effect.asVoid);
    yield* Effect.forEach(
      proposedPlanKeys,
      (key) =>
        key.startsWith(proposedPlanPrefix)
          ? Cache.invalidate(bufferedProposedPlanById, key)
          : Effect.void,
      { concurrency: 1 },
    ).pipe(Effect.asVoid);
  });

  const getSourceProposedPlanReferenceForPendingTurnStart = Effect.fn(
    "getSourceProposedPlanReferenceForPendingTurnStart",
  )(function* (threadId: ThreadId) {
    const pendingTurnStart = yield* projectionTurnRepository.getPendingTurnStartByThreadId({
      threadId,
    });
    if (Option.isNone(pendingTurnStart)) {
      return null;
    }

    const sourceThreadId = pendingTurnStart.value.sourceProposedPlanThreadId;
    const sourcePlanId = pendingTurnStart.value.sourceProposedPlanId;
    if (sourceThreadId === null || sourcePlanId === null) {
      return null;
    }

    return {
      sourceThreadId,
      sourcePlanId,
    } as const;
  });

  const getExpectedProviderTurnIdForThread = Effect.fn("getExpectedProviderTurnIdForThread")(
    function* (threadId: ThreadId) {
      const sessions = yield* providerService.listSessions();
      const session = sessions.find((entry) => entry.threadId === threadId);
      return session?.activeTurnId;
    },
  );

  const getSourceProposedPlanReferenceForAcceptedTurnStart = Effect.fn(
    "getSourceProposedPlanReferenceForAcceptedTurnStart",
  )(function* (threadId: ThreadId, eventTurnId: TurnId | undefined) {
    if (eventTurnId === undefined) {
      return null;
    }

    const expectedTurnId = yield* getExpectedProviderTurnIdForThread(threadId);
    if (!sameId(expectedTurnId, eventTurnId)) {
      return null;
    }

    return yield* getSourceProposedPlanReferenceForPendingTurnStart(threadId);
  });

  const markSourceProposedPlanImplemented = Effect.fn("markSourceProposedPlanImplemented")(
    function* (
      sourceThreadId: ThreadId,
      sourcePlanId: OrchestrationProposedPlanId,
      implementationThreadId: ThreadId,
      implementedAt: string,
    ) {
      const readModel = yield* orchestrationEngine.getReadModel();
      const sourceThread = readModel.threads.find((entry) => entry.id === sourceThreadId);
      const sourcePlan = sourceThread?.proposedPlans.find((entry) => entry.id === sourcePlanId);
      if (!sourceThread || !sourcePlan || sourcePlan.implementedAt !== null) {
        return;
      }

      yield* orchestrationEngine.dispatch({
        type: "thread.proposed-plan.upsert",
        commandId: CommandId.makeUnsafe(
          `provider:source-proposed-plan-implemented:${implementationThreadId}:${crypto.randomUUID()}`,
        ),
        threadId: sourceThread.id,
        proposedPlan: {
          ...sourcePlan,
          implementedAt,
          implementationThreadId,
          updatedAt: implementedAt,
        },
        createdAt: implementedAt,
      });
    },
  );

  const processRuntimeEvent = Effect.fn("processRuntimeEvent")(function* (
    event: ProviderRuntimeEvent,
  ) {
    const readModel = yield* orchestrationEngine.getReadModel();
    const thread = readModel.threads.find((entry) => entry.id === event.threadId);
    if (!thread) return;

    const now = event.createdAt;
    const eventTurnId = toTurnId(event.turnId);
    const activeTurnId = thread.session?.activeTurnId ?? null;

    const conflictsWithActiveTurn =
      activeTurnId !== null && eventTurnId !== undefined && !sameId(activeTurnId, eventTurnId);
    const missingTurnForActiveTurn = activeTurnId !== null && eventTurnId === undefined;

    const shouldApplyThreadLifecycle = (() => {
      if (!STRICT_PROVIDER_LIFECYCLE_GUARD) {
        return true;
      }
      switch (event.type) {
        case "session.exited":
          return true;
        case "session.started":
        case "thread.started":
          return true;
        case "turn.started":
          return !conflictsWithActiveTurn;
        case "turn.completed":
          if (conflictsWithActiveTurn || missingTurnForActiveTurn) {
            return false;
          }
          // Only the active turn may close the lifecycle state.
          if (activeTurnId !== null && eventTurnId !== undefined) {
            return sameId(activeTurnId, eventTurnId);
          }
          // If no active turn is tracked, accept completion scoped to this thread.
          return true;
        default:
          return true;
      }
    })();
    const acceptedTurnStartedSourcePlan =
      event.type === "turn.started" && shouldApplyThreadLifecycle
        ? yield* getSourceProposedPlanReferenceForAcceptedTurnStart(thread.id, eventTurnId)
        : null;

    if (
      event.type === "session.started" ||
      event.type === "session.state.changed" ||
      event.type === "session.exited" ||
      event.type === "thread.started" ||
      event.type === "turn.started" ||
      event.type === "turn.completed"
    ) {
      const nextActiveTurnId =
        event.type === "turn.started"
          ? (eventTurnId ?? null)
          : event.type === "turn.completed" || event.type === "session.exited"
            ? null
            : activeTurnId;
      const status = (() => {
        switch (event.type) {
          case "session.state.changed":
            return orchestrationSessionStatusFromRuntimeState(event.payload.state);
          case "turn.started":
            return "running";
          case "session.exited":
            return "stopped";
          case "turn.completed":
            return normalizeRuntimeTurnState(event.payload.state) === "failed" ? "error" : "ready";
          case "session.started":
          case "thread.started":
            // Provider thread/session start notifications can arrive during an
            // active turn; preserve turn-running state in that case.
            return activeTurnId !== null ? "running" : "ready";
        }
      })();
      const lastError =
        event.type === "session.state.changed" && event.payload.state === "error"
          ? (event.payload.reason ?? thread.session?.lastError ?? "Provider session error")
          : event.type === "turn.completed" &&
              normalizeRuntimeTurnState(event.payload.state) === "failed"
            ? (event.payload.errorMessage ?? thread.session?.lastError ?? "Turn failed")
            : status === "ready"
              ? null
              : (thread.session?.lastError ?? null);

      if (shouldApplyThreadLifecycle) {
        if (event.type === "turn.started" && acceptedTurnStartedSourcePlan !== null) {
          yield* markSourceProposedPlanImplemented(
            acceptedTurnStartedSourcePlan.sourceThreadId,
            acceptedTurnStartedSourcePlan.sourcePlanId,
            thread.id,
            now,
          ).pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("provider runtime ingestion failed to mark source proposed plan", {
                eventId: event.eventId,
                eventType: event.type,
                cause: Cause.pretty(cause),
              }),
            ),
          );
        }

        yield* orchestrationEngine.dispatch({
          type: "thread.session.set",
          commandId: providerCommandId(event, "thread-session-set"),
          threadId: thread.id,
          session: {
            threadId: thread.id,
            status,
            providerName: event.provider,
            runtimeMode: thread.session?.runtimeMode ?? "full-access",
            activeTurnId: nextActiveTurnId,
            lastError,
            updatedAt: now,
          },
          createdAt: now,
        });
      }
    }

    const assistantStream =
      event.type === "content.delta" &&
      (event.payload.streamKind === "assistant_text" ||
        event.payload.streamKind === "reasoning_text" ||
        event.payload.streamKind === "reasoning_summary_text")
        ? event.payload
        : undefined;
    const proposedPlanDelta =
      event.type === "turn.proposed.delta" ? event.payload.delta : undefined;

    if (
      assistantStream &&
      (assistantStream.delta.length > 0 || assistantStream.streamKind === "reasoning_text")
    ) {
      const assistantMessage = assistantMessageId(event);
      const turnId = toTurnId(event.turnId);
      if (turnId) {
        yield* rememberAssistantMessageId(thread.id, turnId, assistantMessage);
      }

      const op: AssistantContentOp =
        assistantStream.delta.length === 0 && assistantStream.streamKind === "reasoning_text"
          ? {
              kind: "reserve_thinking",
              ...(assistantStream.contentIndex !== undefined
                ? { contentIndex: assistantStream.contentIndex }
                : {}),
            }
          : {
              kind:
                assistantStream.streamKind === "assistant_text"
                  ? "assistant_text"
                  : assistantStream.streamKind === "reasoning_text"
                    ? "reasoning_text"
                    : "reasoning_summary_text",
              delta: assistantStream.delta,
              ...(assistantStream.contentIndex !== undefined
                ? { contentIndex: assistantStream.contentIndex }
                : {}),
              ...(assistantStream.summaryIndex !== undefined
                ? { summaryIndex: assistantStream.summaryIndex }
                : {}),
            };
      const content = yield* applyBufferedAssistantContent(assistantMessage, op);

      let delta = "";
      let tag = "assistant-delta";
      if (assistantStream.streamKind === "assistant_text") {
        const assistantDeliveryMode: AssistantDeliveryMode = yield* Effect.map(
          serverSettingsService.getSettings,
          (settings) => (settings.enableAssistantStreaming ? "streaming" : "buffered"),
        );
        if (assistantDeliveryMode === "buffered") {
          delta = yield* appendBufferedAssistantText(assistantMessage, assistantStream.delta);
          tag = "assistant-delta-buffer-spill";
        } else {
          delta = assistantStream.delta;
        }
      }

      if (delta.length > 0 || content.length > 0) {
        yield* orchestrationEngine.dispatch({
          type: "thread.message.assistant.delta",
          commandId: providerCommandId(event, tag),
          threadId: thread.id,
          messageId: assistantMessage,
          delta,
          ...(content.length > 0 ? { content } : {}),
          ...(turnId ? { turnId } : {}),
          createdAt: now,
        });
      }
    }

    if (proposedPlanDelta && proposedPlanDelta.length > 0) {
      const planId = proposedPlanIdFromEvent(event, thread.id);
      yield* appendBufferedProposedPlan(planId, proposedPlanDelta, now);
    }

    const isTool =
      (event.type === "item.started" ||
        event.type === "item.updated" ||
        event.type === "item.completed") &&
      isToolLifecycleItemType(event.payload.itemType);

    if (isTool) {
      const id = String(event.itemId ?? event.eventId);
      const assistantMessage = assistantMessageId(event);
      const turnId = toTurnId(event.turnId);
      if (turnId) {
        yield* rememberAssistantMessageId(thread.id, turnId, assistantMessage);
      }

      const name = toolName(event.payload.data, {
        ...(event.payload.title ? { title: event.payload.title } : {}),
        itemType: event.payload.itemType,
      });
      const args = toolArgs(event.payload.data);

      const content = yield* applyBufferedAssistantContent(assistantMessage, {
        kind: "tool_call",
        itemId: id,
        name,
        ...(args !== undefined ? { arguments: args } : {}),
      });

      yield* orchestrationEngine.dispatch({
        type: "thread.message.assistant.delta",
        commandId: providerCommandId(event, "tool-call-delta"),
        threadId: thread.id,
        messageId: assistantMessage,
        delta: "",
        content,
        ...(turnId ? { turnId } : {}),
        createdAt: now,
      });

      if (event.type === "item.completed") {
        const { text, details } = toolResult(event.payload.data);
        yield* orchestrationEngine.dispatch({
          type: "thread.message.tool-result.append",
          commandId: providerCommandId(event, "tool-result-append"),
          threadId: thread.id,
          messageId: MessageId.makeUnsafe(`toolResult:${id}`),
          toolCallId: id,
          toolName: name,
          ...(text.length > 0
            ? {
                content: [{ type: "text", text }] as OrchestrationAssistantContent,
                text,
              }
            : {}),
          isError: event.payload.status === "failed",
          ...(details !== undefined ? { details } : {}),
          ...(turnId ? { turnId } : {}),
          createdAt: now,
        });
      }
    }

    const assistantCompletion =
      event.type === "item.completed" && event.payload.itemType === "assistant_message"
        ? {
            messageId: assistantMessageId(event),
            fallbackText: event.payload.detail,
          }
        : undefined;
    const proposedPlanCompletion =
      event.type === "turn.proposed.completed"
        ? {
            planId: proposedPlanIdFromEvent(event, thread.id),
            turnId: toTurnId(event.turnId),
            planMarkdown: event.payload.planMarkdown,
          }
        : undefined;

    if (assistantCompletion) {
      const assistantMessageId = assistantCompletion.messageId;
      const turnId = toTurnId(event.turnId);
      const existingAssistantMessage = thread.messages.find(
        (entry) => entry.id === assistantMessageId,
      );
      const shouldApplyFallbackCompletionText =
        !existingAssistantMessage || existingAssistantMessage.text.length === 0;
      if (turnId) {
        yield* rememberAssistantMessageId(thread.id, turnId, assistantMessageId);
      }

      yield* finalizeAssistantMessage({
        event,
        threadId: thread.id,
        messageId: assistantMessageId,
        ...(turnId ? { turnId } : {}),
        createdAt: now,
        commandTag: "assistant-complete",
        finalDeltaCommandTag: "assistant-delta-finalize",
        ...(assistantCompletion.fallbackText !== undefined && shouldApplyFallbackCompletionText
          ? { fallbackText: assistantCompletion.fallbackText }
          : {}),
      });

      if (turnId) {
        yield* forgetAssistantMessageId(thread.id, turnId, assistantMessageId);
      }
    }

    if (proposedPlanCompletion) {
      yield* finalizeBufferedProposedPlan({
        event,
        threadId: thread.id,
        threadProposedPlans: thread.proposedPlans,
        planId: proposedPlanCompletion.planId,
        ...(proposedPlanCompletion.turnId ? { turnId: proposedPlanCompletion.turnId } : {}),
        fallbackMarkdown: proposedPlanCompletion.planMarkdown,
        updatedAt: now,
      });
    }

    if (event.type === "turn.completed") {
      const turnId = toTurnId(event.turnId);
      if (turnId) {
        const assistantMessageIds = yield* getAssistantMessageIdsForTurn(thread.id, turnId);
        yield* Effect.forEach(
          assistantMessageIds,
          (assistantMessageId) =>
            finalizeAssistantMessage({
              event,
              threadId: thread.id,
              messageId: assistantMessageId,
              turnId,
              createdAt: now,
              commandTag: "assistant-complete-finalize",
              finalDeltaCommandTag: "assistant-delta-finalize-fallback",
            }),
          { concurrency: 1 },
        ).pipe(Effect.asVoid);
        yield* clearAssistantMessageIdsForTurn(thread.id, turnId);

        yield* finalizeBufferedProposedPlan({
          event,
          threadId: thread.id,
          threadProposedPlans: thread.proposedPlans,
          planId: proposedPlanIdForTurn(thread.id, turnId),
          turnId,
          updatedAt: now,
        });
      }
    }

    if (event.type === "session.exited") {
      yield* clearTurnStateForSession(thread.id);
    }

    if (event.type === "runtime.error") {
      const runtimeErrorMessage = event.payload.message;

      const shouldApplyRuntimeError = !STRICT_PROVIDER_LIFECYCLE_GUARD
        ? true
        : activeTurnId === null || eventTurnId === undefined || sameId(activeTurnId, eventTurnId);

      if (shouldApplyRuntimeError) {
        yield* orchestrationEngine.dispatch({
          type: "thread.session.set",
          commandId: providerCommandId(event, "runtime-error-session-set"),
          threadId: thread.id,
          session: {
            threadId: thread.id,
            status: "error",
            providerName: event.provider,
            runtimeMode: thread.session?.runtimeMode ?? "full-access",
            activeTurnId: eventTurnId ?? null,
            lastError: runtimeErrorMessage,
            updatedAt: now,
          },
          createdAt: now,
        });
      }
    }

    if (event.type === "thread.metadata.updated" && event.payload.name) {
      yield* orchestrationEngine.dispatch({
        type: "thread.meta.update",
        commandId: providerCommandId(event, "thread-meta-update"),
        threadId: thread.id,
        title: event.payload.name,
      });
    }

    if (event.type === "turn.diff.updated") {
      const turnId = toTurnId(event.turnId);
      if (turnId && (yield* isGitRepoForThread(thread.id))) {
        // Skip if a checkpoint already exists for this turn. A real
        // (non-placeholder) capture from CheckpointReactor should not
        // be clobbered, and dispatching a duplicate placeholder for the
        // same turnId would produce an unstable checkpointTurnCount.
        if (thread.checkpoints.some((c) => c.turnId === turnId)) {
          // Already tracked; no-op.
        } else {
          const assistantMessageId = MessageId.makeUnsafe(
            `assistant:${event.itemId ?? event.turnId ?? event.eventId}`,
          );
          const maxTurnCount = thread.checkpoints.reduce(
            (max, c) => Math.max(max, c.checkpointTurnCount),
            0,
          );
          yield* orchestrationEngine.dispatch({
            type: "thread.turn.diff.complete",
            commandId: providerCommandId(event, "thread-turn-diff-complete"),
            threadId: thread.id,
            turnId,
            completedAt: now,
            checkpointRef: CheckpointRef.makeUnsafe(`provider-diff:${event.eventId}`),
            status: "missing",
            files: [],
            assistantMessageId,
            checkpointTurnCount: maxTurnCount + 1,
            createdAt: now,
          });
        }
      }
    }

    const activities = runtimeEventToActivities(event);
    yield* Effect.forEach(activities, (activity) =>
      orchestrationEngine.dispatch({
        type: "thread.activity.append",
        commandId: providerCommandId(event, "thread-activity-append"),
        threadId: thread.id,
        activity,
        createdAt: activity.createdAt,
      }),
    ).pipe(Effect.asVoid);
  });

  const processDomainEvent = (_event: TurnStartRequestedDomainEvent) => Effect.void;

  const processInput = (input: RuntimeIngestionInput) =>
    input.source === "runtime" ? processRuntimeEvent(input.event) : processDomainEvent(input.event);

  const processInputSafely = (input: RuntimeIngestionInput) =>
    processInput(input).pipe(
      Effect.catchCause((cause) => {
        if (Cause.hasInterruptsOnly(cause)) {
          return Effect.failCause(cause);
        }
        return Effect.logWarning("provider runtime ingestion failed to process event", {
          source: input.source,
          eventId: input.event.eventId,
          eventType: input.event.type,
          cause: Cause.pretty(cause),
        });
      }),
    );

  const worker = yield* makeDrainableWorker(processInputSafely);

  const start: ProviderRuntimeIngestionShape["start"] = Effect.fn("start")(function* () {
    yield* Effect.forkScoped(
      Stream.runForEach(providerService.streamEvents, (event) =>
        worker.enqueue({ source: "runtime", event }),
      ),
    );
    yield* Effect.forkScoped(
      Stream.runForEach(orchestrationEngine.streamDomainEvents, (event) => {
        if (event.type !== "thread.turn-start-requested") {
          return Effect.void;
        }
        return worker.enqueue({ source: "domain", event });
      }),
    );
  });

  return {
    start,
    drain: worker.drain,
  } satisfies ProviderRuntimeIngestionShape;
});

export const ProviderRuntimeIngestionLive = Layer.effect(
  ProviderRuntimeIngestionService,
  make(),
).pipe(Layer.provide(ProjectionTurnRepositoryLive));
