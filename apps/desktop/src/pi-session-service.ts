import { statSync } from "node:fs";

import * as Effect from "effect/Effect";
import type {
  PiBlock,
  PiMessage,
  PiSessionEntry,
  PiSessionEventEnvelope,
  PiSessionSnapshot,
  PiSessionSummary,
  PiSessionTreeNode,
} from "@glass/contracts";
import { SessionManager, createAgentSession } from "@mariozechner/pi-coding-agent";
import { PiConfigService } from "./pi-config-service";
import { ShellService } from "./shell-service";

function blocks(content: unknown[]) {
  return content
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      if ((item as { type?: unknown }).type === "text") {
        return [String((item as { text?: unknown }).text ?? "")];
      }
      if ((item as { type?: unknown }).type === "thinking") {
        return [String((item as { thinking?: unknown }).thinking ?? "")];
      }
      if ((item as { type?: unknown }).type === "toolCall") {
        return [`[${String((item as { name?: unknown }).name ?? "tool")}]`];
      }
      return [];
    })
    .join("");
}

function preview(message: {
  role?: unknown;
  content?: unknown;
  toolName?: unknown;
  errorMessage?: unknown;
}) {
  if (message.role === "user" || message.role === "user-with-attachments") {
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) return blocks(message.content);
    return "";
  }
  if (message.role === "assistant") {
    const body = Array.isArray(message.content) ? blocks(message.content) : "";
    if (typeof message.errorMessage === "string" && message.errorMessage.trim()) {
      return `${body}\n(${message.errorMessage})`;
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

function block(value: unknown): PiBlock | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.type !== "string") return null;
  if (item.type === "text") {
    return { type: "text", text: String(item.text ?? "") };
  }
  if (item.type === "thinking") {
    return { type: "thinking", thinking: String(item.thinking ?? "") };
  }
  if (item.type === "toolCall") {
    return { ...item, type: "toolCall", name: String(item.name ?? "") };
  }
  return { ...item, type: item.type };
}

function content(value: unknown) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const next = block(item);
    return next ? [next] : [];
  });
}

function message(value: unknown): PiMessage {
  if (!value || typeof value !== "object") {
    return { role: "unknown", value };
  }
  const item = value as Record<string, unknown>;
  const role = typeof item.role === "string" ? item.role : "unknown";
  if (role === "user") {
    return { role, content: content(item.content) };
  }
  if (role === "user-with-attachments") {
    return { role, content: content(item.content) };
  }
  if (role === "assistant") {
    return {
      role,
      content: Array.isArray(item.content) ? content(item.content) : [],
      ...(typeof item.errorMessage === "string" ? { errorMessage: item.errorMessage } : {}),
    };
  }
  if (role === "toolResult") {
    return {
      role,
      content: Array.isArray(item.content) ? content(item.content) : [],
      ...(typeof item.toolName === "string" ? { toolName: item.toolName } : {}),
      ...(typeof item.isError === "boolean" ? { isError: item.isError } : {}),
    };
  }
  if (role === "system") {
    return { role, content: content(item.content) };
  }
  return { ...item, role };
}

function base(value: Record<string, unknown>) {
  return {
    id: String(value.id ?? ""),
    parentId: typeof value.parentId === "string" ? value.parentId : null,
    timestamp: typeof value.timestamp === "string" ? value.timestamp : "",
  };
}

function entry(value: unknown): PiSessionEntry | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item.type === "message") {
    return { type: "message", ...base(item), message: message(item.message) };
  }
  if (item.type === "thinking_level_change") {
    return {
      type: "thinking_level_change",
      ...base(item),
      thinkingLevel: String(item.thinkingLevel ?? ""),
    };
  }
  if (item.type === "model_change") {
    return {
      type: "model_change",
      ...base(item),
      provider: String(item.provider ?? ""),
      modelId: String(item.modelId ?? ""),
    };
  }
  if (item.type === "compaction") {
    return {
      type: "compaction",
      ...base(item),
      summary: String(item.summary ?? ""),
      firstKeptEntryId: String(item.firstKeptEntryId ?? ""),
      tokensBefore: Number(item.tokensBefore ?? 0),
      ...(item.details !== undefined ? { details: item.details } : {}),
      ...(typeof item.fromHook === "boolean" ? { fromHook: item.fromHook } : {}),
    };
  }
  if (item.type === "branch_summary") {
    return {
      type: "branch_summary",
      ...base(item),
      fromId: String(item.fromId ?? ""),
      summary: String(item.summary ?? ""),
      ...(item.details !== undefined ? { details: item.details } : {}),
      ...(typeof item.fromHook === "boolean" ? { fromHook: item.fromHook } : {}),
    };
  }
  if (item.type === "custom") {
    return {
      type: "custom",
      ...base(item),
      customType: String(item.customType ?? "custom"),
      ...(item.data !== undefined ? { data: item.data } : {}),
    };
  }
  if (item.type === "custom_message") {
    return {
      type: "custom_message",
      ...base(item),
      customType: String(item.customType ?? "custom"),
      content: content(item.content),
      display: Boolean(item.display),
      ...(item.details !== undefined ? { details: item.details } : {}),
    };
  }
  if (item.type === "label") {
    return {
      type: "label",
      ...base(item),
      targetId: String(item.targetId ?? ""),
      label: typeof item.label === "string" ? item.label : undefined,
    };
  }
  if (item.type === "session_info") {
    return {
      type: "session_info",
      ...base(item),
      ...(typeof item.name === "string" ? { name: item.name } : {}),
    };
  }
  return null;
}

function tree(value: unknown): PiSessionTreeNode | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const cur = entry(item.entry);
  if (!cur) return null;
  return {
    entry: cur,
    children: Array.isArray(item.children)
      ? item.children.flatMap((child) => {
          const next = tree(child);
          return next ? [next] : [];
        })
      : [],
    ...(typeof item.label === "string" ? { label: item.label } : {}),
  };
}

function fileTimes(file: string | undefined) {
  if (!file) {
    const now = new Date().toISOString();
    return { createdAt: now, modifiedAt: now };
  }
  try {
    const stat = statSync(file);
    return {
      createdAt: stat.birthtime.toISOString(),
      modifiedAt: stat.mtime.toISOString(),
    };
  } catch {
    const now = new Date().toISOString();
    return { createdAt: now, modifiedAt: now };
  }
}

export class PiSessionService {
  private cfg: PiConfigService;
  private shell: ShellService;
  private items = new Map<
    string,
    { session: Awaited<ReturnType<typeof createAgentSession>>["session"] }
  >();
  private listeners = new Set<(event: PiSessionEventEnvelope) => void>();

  constructor(cfg: PiConfigService, shell: ShellService) {
    this.cfg = cfg;
    this.shell = shell;
  }

  listen(fn: (event: PiSessionEventEnvelope) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private summary(
    session: Awaited<ReturnType<typeof createAgentSession>>["session"],
  ): PiSessionSummary {
    const time = fileTimes(session.sessionFile);
    return {
      id: session.sessionId,
      path: session.sessionFile ?? "",
      cwd: session.sessionManager.getCwd(),
      name: session.sessionName ?? null,
      createdAt: time.createdAt,
      modifiedAt: time.modifiedAt,
      messageCount: session.messages.length,
      firstMessage: preview(session.messages[0] ?? {}),
      allMessagesText: session.messages
        .map((message) => preview(message))
        .filter(Boolean)
        .join("\n\n"),
      isStreaming: session.isStreaming,
    };
  }

  private snapshot(
    session: Awaited<ReturnType<typeof createAgentSession>>["session"],
  ): PiSessionSnapshot {
    return {
      id: session.sessionId,
      file: session.sessionFile ?? null,
      cwd: session.sessionManager.getCwd(),
      name: session.sessionName ?? null,
      model: session.model
        ? {
            provider: session.model.provider,
            id: session.model.id,
            name: session.model.name ?? session.model.id,
            reasoning: Boolean(session.model.reasoning),
          }
        : null,
      thinkingLevel: session.thinkingLevel,
      messages: session.messages.map((item) => message(item)),
      tree: session.sessionManager.getTree().flatMap((item) => {
        const next = tree(item);
        return next ? [next] : [];
      }),
      isStreaming: session.isStreaming,
      pending: {
        steering: [...session.getSteeringMessages()],
        followUp: [...session.getFollowUpMessages()],
      },
    };
  }

  private emit(
    session: Awaited<ReturnType<typeof createAgentSession>>["session"],
    event: PiSessionEventEnvelope["event"],
  ) {
    const next = {
      sessionId: session.sessionId,
      summary: this.summary(session),
      snapshot: this.snapshot(session),
      event,
    };
    for (const fn of this.listeners) fn(next);
  }

  private load(mgr: SessionManager) {
    return Effect.tryPromise({
      try: async () => {
        const result = await createAgentSession({
          cwd: this.shell.cwd,
          authStorage: this.cfg.auth,
          modelRegistry: this.cfg.reg,
          sessionManager: mgr,
          settingsManager: this.cfg.settings(this.shell.cwd),
        });
        const session = result.session;
        this.items.set(session.sessionId, { session });
        session.subscribe((event) => {
          this.emit(session, event);
        });
        return session;
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  create(): Effect.Effect<PiSessionSnapshot, Error> {
    return this.load(SessionManager.create(this.shell.cwd)).pipe(
      Effect.map((session) => this.snapshot(session)),
    );
  }

  list(): Effect.Effect<PiSessionSummary[], Error> {
    return Effect.tryPromise({
      try: async () => {
        const items = await SessionManager.list(this.shell.cwd);
        return items.map((item) => ({
          id: item.id,
          path: item.path,
          cwd: item.cwd,
          name: item.name ?? null,
          createdAt: item.created.toISOString(),
          modifiedAt: item.modified.toISOString(),
          messageCount: item.messageCount,
          firstMessage: item.firstMessage,
          allMessagesText: item.allMessagesText,
          isStreaming: this.items.get(item.id)?.session.isStreaming ?? false,
        }));
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  private open(sessionId: string) {
    const cur = this.items.get(sessionId)?.session;
    if (cur) return Effect.succeed(cur);
    return this.list().pipe(
      Effect.flatMap((list) => {
        const hit = list.find((item) => item.id === sessionId);
        if (!hit) {
          return Effect.fail(new Error(`Unknown session: ${sessionId}`));
        }
        return this.load(SessionManager.open(hit.path));
      }),
    );
  }

  get(sessionId: string): Effect.Effect<PiSessionSnapshot, Error> {
    return this.open(sessionId).pipe(Effect.map((session) => this.snapshot(session)));
  }

  prompt(sessionId: string, text: string) {
    return this.open(sessionId).pipe(
      Effect.flatMap((session) =>
        Effect.tryPromise({
          try: () => session.prompt(text),
          catch: (err) => (err instanceof Error ? err : new Error(String(err))),
        }),
      ),
    );
  }

  abort(sessionId: string) {
    return this.open(sessionId).pipe(
      Effect.flatMap((session) =>
        Effect.tryPromise({
          try: () => session.abort(),
          catch: (err) => (err instanceof Error ? err : new Error(String(err))),
        }),
      ),
    );
  }

  setModel(sessionId: string, provider: string, model: string) {
    return this.open(sessionId).pipe(
      Effect.flatMap((session) =>
        Effect.sync(() => {
          this.cfg.reg.refresh();
          const next = this.cfg.reg.find(provider, model);
          if (!next) throw new Error(`Unknown model: ${provider}/${model}`);
          return next;
        }).pipe(
          Effect.flatMap((next) =>
            Effect.tryPromise({
              try: () => session.setModel(next),
              catch: (err) => (err instanceof Error ? err : new Error(String(err))),
            }),
          ),
        ),
      ),
    );
  }

  dispose() {
    for (const item of this.items.values()) {
      item.session.dispose();
    }
    this.items.clear();
  }
}
