import { statSync } from "node:fs";
import * as Path from "node:path";

import type {
  PiBlock,
  PiMessage,
  PiModelRef,
  PiSessionDelta,
  PiSessionEvent,
  PiSessionItem,
  PiSessionMeta,
  PiSessionPending,
  PiSessionSnapshot,
  PiSessionSummary,
  PiSessionSummaryEvent,
  PiThinkingLevel,
} from "@glass/contracts";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { PiRuntimeEvent } from "./pi-runtime-normalizer";

const levels: PiThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"];
const fileTag = /<file\s+name="([^"]+)"\s*>([\s\S]*?)<\/file>/g;

type ApplyOut = {
  event: PiSessionEvent;
  delta: PiSessionDelta | null;
  summary: PiSessionSummaryEvent | null;
};

function level(value: unknown): PiThinkingLevel {
  if (typeof value !== "string") return "off";
  return levels.includes(value as PiThinkingLevel) ? (value as PiThinkingLevel) : "off";
}

function model(value: unknown): PiModelRef | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.provider !== "string" || typeof item.id !== "string") return null;
  return {
    provider: item.provider,
    id: item.id,
    ...(typeof item.name === "string" ? { name: item.name } : {}),
    ...(typeof item.reasoning === "boolean" ? { reasoning: item.reasoning } : {}),
  };
}

function tidy(text: string) {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function files(text: string) {
  const out = [] as Array<{ path: string; note: string }>;
  let body = "";
  let last = 0;

  for (const hit of text.matchAll(fileTag)) {
    const path = hit[1] ?? "";
    const note = (hit[2] ?? "").trim();
    const pos = hit.index ?? 0;
    body += text.slice(last, pos);
    last = pos + hit[0].length;
    out.push({ path, note });
  }

  body += text.slice(last);
  return { text: tidy(body), files: out };
}

function summary(value: unknown): {
  text: string;
  files: Array<{ path: string; note: string }>;
  imgs: number;
} {
  if (typeof value === "string") {
    const out = files(value);
    return { ...out, imgs: 0 };
  }
  if (!Array.isArray(value)) {
    return { text: "", files: [] as Array<{ path: string; note: string }>, imgs: 0 };
  }

  return value.reduce(
    (state, item) => {
      if (!item || typeof item !== "object") return state;
      const block = item as Record<string, unknown>;
      if (block.type === "text") {
        const next = files(String(block.text ?? ""));
        return {
          text: `${state.text}${state.text && next.text ? "\n" : ""}${next.text}`,
          files: [...state.files, ...next.files],
          imgs: state.imgs,
        };
      }
      if (block.type === "thinking") {
        return {
          text: `${state.text}${state.text ? "\n" : ""}${String(block.thinking ?? "")}`,
          files: state.files,
          imgs: state.imgs,
        };
      }
      if (block.type === "toolCall") {
        return {
          text: `${state.text}${state.text ? "\n" : ""}[${String(block.name ?? "tool")}]`,
          files: state.files,
          imgs: state.imgs,
        };
      }
      if (block.type === "image") {
        return { text: state.text, files: state.files, imgs: state.imgs + 1 };
      }
      return state;
    },
    { text: "", files: [] as Array<{ path: string; note: string }>, imgs: 0 },
  );
}

function blocks(content: unknown[]) {
  const out = summary(content);
  const names = out.files.map((item) => `[${Path.basename(item.path) || item.path}]`);
  const imgs = Array.from({ length: out.imgs }, () => "[image]");
  return [tidy(out.text), ...names, ...imgs].filter(Boolean).join("\n");
}

function preview(message: {
  role?: unknown;
  content?: unknown;
  toolName?: unknown;
  errorMessage?: unknown;
}) {
  if (message.role === "user" || message.role === "user-with-attachments") {
    if (typeof message.content === "string") {
      const out = summary(message.content);
      return [out.text, ...out.files.map((item) => `[${Path.basename(item.path) || item.path}]`)]
        .filter(Boolean)
        .join("\n");
    }
    if (Array.isArray(message.content)) return blocks(message.content);
    return "";
  }
  if (message.role === "assistant") {
    const body = Array.isArray(message.content) ? blocks(message.content) : "";
    if (typeof message.errorMessage === "string" && message.errorMessage.trim()) {
      return `${body}${body ? "\n" : ""}(${message.errorMessage})`;
    }
    return body;
  }
  if (message.role === "toolResult") {
    if (Array.isArray(message.content)) {
      const body = blocks(message.content);
      if (body) return body;
    }
    return typeof message.toolName === "string" ? `[${message.toolName}]` : "";
  }
  return "";
}

function toBlock(value: unknown): PiBlock | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.type !== "string") return null;
  if (item.type === "text") {
    return { type: "text", text: String(item.text ?? "") };
  }
  if (item.type === "thinking") {
    return { type: "thinking", thinking: String(item.thinking ?? "") };
  }
  if (item.type === "image") {
    return {
      type: "image",
      ...(typeof item.mimeType === "string" ? { mimeType: item.mimeType } : {}),
      ...(typeof item.data === "string" ? { data: item.data } : {}),
    };
  }
  if (item.type === "toolCall") {
    return { ...item, type: "toolCall", name: String(item.name ?? "") };
  }
  return { ...item, type: item.type };
}

function toContent(value: unknown) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const next = toBlock(item);
    return next ? [next] : [];
  });
}

function toMessage(value: unknown): PiMessage {
  if (!value || typeof value !== "object") {
    return { role: "unknown", value };
  }

  const item = value as Record<string, unknown>;
  const role = typeof item.role === "string" ? item.role : "unknown";
  if (role === "user") {
    return { role, content: toContent(item.content) };
  }
  if (role === "user-with-attachments") {
    return { role, content: toContent(item.content) };
  }
  if (role === "assistant") {
    return {
      role,
      content: Array.isArray(item.content) ? toContent(item.content) : [],
      ...(typeof item.stopReason === "string" ? { stopReason: item.stopReason } : {}),
      ...(typeof item.errorMessage === "string" ? { errorMessage: item.errorMessage } : {}),
    };
  }
  if (role === "toolResult") {
    return {
      role,
      ...(typeof item.toolCallId === "string" ? { toolCallId: item.toolCallId } : {}),
      content: Array.isArray(item.content) ? toContent(item.content) : [],
      ...(typeof item.toolName === "string" ? { toolName: item.toolName } : {}),
      ...(typeof item.isError === "boolean" ? { isError: item.isError } : {}),
      ...(item.details !== undefined ? { details: item.details as Record<string, unknown> } : {}),
    };
  }
  if (role === "custom") {
    return {
      role,
      customType: String(item.customType ?? "custom"),
      content: toContent(item.content),
      display: Boolean(item.display),
      ...(item.details !== undefined ? { details: item.details } : {}),
    };
  }
  if (role === "branchSummary") {
    return {
      role,
      fromId: String(item.fromId ?? ""),
      summary: String(item.summary ?? ""),
    };
  }
  if (role === "compactionSummary") {
    return {
      role,
      summary: String(item.summary ?? ""),
      tokensBefore: Number(item.tokensBefore ?? 0),
    };
  }
  if (role === "bashExecution") {
    return {
      role,
      command: String(item.command ?? ""),
      output: String(item.output ?? ""),
      ...(typeof item.exitCode === "number" ? { exitCode: item.exitCode } : {}),
      cancelled: Boolean(item.cancelled),
      truncated: Boolean(item.truncated),
      ...(typeof item.fullOutputPath === "string" ? { fullOutputPath: item.fullOutputPath } : {}),
      ...(typeof item.excludeFromContext === "boolean"
        ? { excludeFromContext: item.excludeFromContext }
        : {}),
    };
  }
  if (role === "system") {
    return { role, content: toContent(item.content) };
  }
  return { ...item, role };
}

function msgId(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const item = value as Record<string, unknown>;
  const role = typeof item.role === "string" ? item.role : "unknown";
  if (role === "toolResult" && typeof item.toolCallId === "string" && item.toolCallId) {
    return `tool:${item.toolCallId}`;
  }
  const stamp = item.timestamp;
  if (typeof stamp === "number" || typeof stamp === "string") {
    const id = String(stamp);
    if (id) return `${role}:${id}`;
  }
  return fallback;
}

function times(file: string | undefined) {
  if (!file) {
    const now = new Date().toISOString();
    return { createdAt: now, modifiedAt: now };
  }
  try {
    const item = statSync(file);
    return {
      createdAt: item.birthtime.toISOString(),
      modifiedAt: item.mtime.toISOString(),
    };
  } catch {
    const now = new Date().toISOString();
    return { createdAt: now, modifiedAt: now };
  }
}

function textAll(messages: PiSessionItem[]) {
  return messages
    .map((item) => preview(item.message as Record<string, unknown>))
    .filter(Boolean)
    .join("\n\n");
}

function sameSummary(left: PiSessionSummary, right: PiSessionSummary) {
  return (
    left.id === right.id &&
    left.path === right.path &&
    left.cwd === right.cwd &&
    left.name === right.name &&
    left.createdAt === right.createdAt &&
    left.modifiedAt === right.modifiedAt &&
    left.messageCount === right.messageCount &&
    left.firstMessage === right.firstMessage &&
    left.allMessagesText === right.allMessagesText &&
    left.isStreaming === right.isStreaming
  );
}

function toPending(): PiSessionPending {
  return { steering: [], followUp: [] };
}

function toMeta(snap: PiSessionSnapshot): PiSessionMeta {
  return {
    model: snap.model,
    thinkingLevel: snap.thinkingLevel,
    isStreaming: snap.isStreaming,
    pending: snap.pending,
  };
}

function bridge(evt: PiRuntimeEvent): PiSessionEvent {
  return {
    type: evt.type,
    rawType: evt.rawType,
    source: evt.source,
    at: evt.at,
  };
}

export class PiRuntimeStore {
  private snap: PiSessionSnapshot;
  private sum: PiSessionSummary;

  constructor(opts: { id: string; cwd: string; file: string | null }) {
    this.snap = {
      id: opts.id,
      file: opts.file,
      cwd: opts.cwd,
      name: null,
      model: null,
      thinkingLevel: "off",
      messages: [],
      live: null,
      tree: [],
      isStreaming: false,
      pending: toPending(),
    };
    this.sum = this.makeSummary();
  }

  snapshot() {
    return this.snap;
  }

  summary() {
    return this.sum;
  }

  apply(evt: PiRuntimeEvent): ApplyOut {
    const event = bridge(evt);
    let delta: PiSessionDelta | null = null;

    if (evt.type === "session.started") {
      this.snap = { ...this.snap, isStreaming: true };
      delta = { type: "meta", meta: toMeta(this.snap) };
    }

    if (evt.type === "session.state.changed") {
      this.snap = {
        ...this.snap,
        ...(evt.state.sessionFile !== undefined ? { file: evt.state.sessionFile } : {}),
        ...(evt.state.sessionName !== undefined ? { name: evt.state.sessionName ?? null } : {}),
        ...(evt.state.model !== undefined ? { model: model(evt.state.model) } : {}),
        ...(evt.state.thinkingLevel !== undefined
          ? { thinkingLevel: level(evt.state.thinkingLevel) }
          : {}),
        ...(evt.state.isStreaming !== undefined ? { isStreaming: evt.state.isStreaming } : {}),
      };
      delta = { type: "meta", meta: toMeta(this.snap) };
    }

    if (evt.type === "session.messages.loaded") {
      this.snap = {
        ...this.snap,
        messages: evt.messages.map((item, i) => ({
          id: msgId(item, `${this.snap.id}:${i + 1}`),
          message: toMessage(item),
        })),
        live: null,
      };
      delta = { type: "sync", snapshot: this.snap };
    }

    if (evt.type === "content.delta") {
      if (evt.event.type === "message_start") {
        const role = (evt.event.message as { role?: unknown }).role;
        if (role === "assistant") {
          this.snap = {
            ...this.snap,
            live: {
              id: msgId(evt.event.message, `${this.snap.id}:live`),
              message: toMessage(evt.event.message),
            },
          };
          delta = { type: "live", item: this.snap.live, meta: toMeta(this.snap) };
        } else {
          delta = { type: "meta", meta: toMeta(this.snap) };
        }
      }

      if (evt.event.type === "message_update") {
        this.snap = {
          ...this.snap,
          live: {
            id: msgId(evt.event.message, `${this.snap.id}:live`),
            message: toMessage(evt.event.message),
          },
        };
        delta = { type: "live", item: this.snap.live, meta: toMeta(this.snap) };
      }

      if (evt.event.type === "message_end") {
        const item = {
          id: msgId(evt.event.message, `${this.snap.id}:${this.snap.messages.length + 1}`),
          message: toMessage(evt.event.message),
        } satisfies PiSessionItem;
        this.snap = {
          ...this.snap,
          messages: [...this.snap.messages, item],
          live: null,
        };
        delta = { type: "commit", item, meta: toMeta(this.snap) };
      }
    }

    if (evt.type === "turn.completed" && this.snap.isStreaming) {
      this.snap = { ...this.snap, isStreaming: false, live: null };
      if (!delta) delta = { type: "meta", meta: toMeta(this.snap) };
    }

    const next = this.makeSummary();
    if (sameSummary(this.sum, next)) {
      return { event, delta, summary: null };
    }

    this.sum = next;
    return {
      event,
      delta,
      summary: {
        lane: "summary",
        type: "upsert",
        sessionId: this.snap.id,
        summary: this.sum,
        event,
      },
    };
  }

  private makeSummary(): PiSessionSummary {
    const time = times(this.snap.file ?? undefined);
    return {
      id: this.snap.id,
      path: this.snap.file ?? "",
      cwd: this.snap.cwd,
      name: this.snap.name,
      createdAt: time.createdAt,
      modifiedAt: time.modifiedAt,
      messageCount: this.snap.messages.length,
      firstMessage: preview(this.snap.messages[0]?.message as Record<string, unknown>),
      allMessagesText: textAll(this.snap.messages),
      isStreaming: this.snap.isStreaming,
    };
  }
}
