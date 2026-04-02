import { statSync, watch as fsWatch, type FSWatcher } from "node:fs";
import * as Path from "node:path";

import * as Effect from "effect/Effect";
import type {
  PiBlock,
  PiMessage,
  PiSessionEntry,
  PiSessionActiveEvent,
  PiSessionBridgeEvent,
  PiSessionDelta,
  PiSessionEvent,
  PiSessionMeta,
  PiSessionPending,
  PiSessionSnapshot,
  PiSessionSummary,
  PiSessionSummaryEvent,
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
      ...(typeof item.stopReason === "string" ? { stopReason: item.stopReason } : {}),
      ...(typeof item.errorMessage === "string" ? { errorMessage: item.errorMessage } : {}),
    };
  }
  if (role === "toolResult") {
    return {
      role,
      ...(typeof item.toolCallId === "string" ? { toolCallId: item.toolCallId } : {}),
      content: Array.isArray(item.content) ? content(item.content) : [],
      ...(typeof item.toolName === "string" ? { toolName: item.toolName } : {}),
      ...(typeof item.isError === "boolean" ? { isError: item.isError } : {}),
    };
  }
  if (role === "custom") {
    return {
      role,
      customType: String(item.customType ?? "custom"),
      content: content(item.content),
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

function all(messages: readonly unknown[]) {
  return messages
    .map((item) => preview(item as Record<string, unknown>))
    .filter(Boolean)
    .join("\n\n");
}

function summaryEvent(event: Event) {
  return (
    event.type === "agent_start" ||
    event.type === "agent_end" ||
    event.type === "message_start" ||
    event.type === "message_end" ||
    event.type === "model_change" ||
    event.type === "thinking_level_change" ||
    event.type === "session_info"
  );
}

function same(left: PiSessionSummary | undefined, right: PiSessionSummary) {
  if (!left) return false;
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

type Session = Awaited<ReturnType<typeof createAgentSession>>["session"];
type Event = PiSessionEvent;

export class PiSessionService {
  private cfg: PiConfigService;
  private shell: ShellService;
  private items = new Map<string, { session: Session }>();
  private listeners = new Set<(event: PiSessionBridgeEvent) => void>();
  private refs = new Map<string, number>();
  private sums = new Map<string, PiSessionSummary>();
  private root: FSWatcher | null = null;
  private dir: FSWatcher | null = null;
  private cwd: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(cfg: PiConfigService, shell: ShellService) {
    this.cfg = cfg;
    this.shell = shell;
  }

  listen(fn: (event: PiSessionBridgeEvent) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(event: PiSessionBridgeEvent) {
    for (const fn of this.listeners) fn(event);
  }

  private pending(session: Session): PiSessionPending {
    return {
      steering: [...session.getSteeringMessages()],
      followUp: [...session.getFollowUpMessages()],
    };
  }

  private meta(session: Session): PiSessionMeta {
    return {
      model: session.model
        ? {
            provider: session.model.provider,
            id: session.model.id,
            name: session.model.name ?? session.model.id,
            reasoning: Boolean(session.model.reasoning),
          }
        : null,
      thinkingLevel: session.thinkingLevel,
      isStreaming: session.isStreaming,
      pending: this.pending(session),
    };
  }

  private full(session: Session): PiSessionSummary {
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
      allMessagesText: all(session.messages),
      isStreaming: session.isStreaming,
    };
  }

  private live(session: Session, event: Event): PiSessionSummary {
    const cur = this.sums.get(session.sessionId);
    if (!cur) return this.full(session);

    const first = cur.firstMessage || preview(session.messages[0] ?? {});
    const next = {
      ...cur,
      path: session.sessionFile ?? cur.path,
      cwd: session.sessionManager.getCwd(),
      name: session.sessionName ?? cur.name,
      modifiedAt: new Date().toISOString(),
      messageCount: session.messages.length,
      firstMessage: first,
      isStreaming: session.isStreaming,
    } satisfies PiSessionSummary;

    if (event.type === "message_end" || event.type === "agent_end") {
      return {
        ...next,
        allMessagesText: all(session.messages),
      };
    }

    return next;
  }

  private snapshot(session: Session): PiSessionSnapshot {
    const ctx = session.sessionManager.buildSessionContext();
    return {
      id: session.sessionId,
      file: session.sessionFile ?? null,
      cwd: session.sessionManager.getCwd(),
      name: session.sessionName ?? null,
      model: this.meta(session).model,
      thinkingLevel: this.meta(session).thinkingLevel,
      messages: ctx.messages.map((item) => message(item)),
      tree: session.sessionManager.getTree().flatMap((item) => {
        const next = tree(item);
        return next ? [next] : [];
      }),
      isStreaming: this.meta(session).isStreaming,
      pending: this.pending(session),
    };
  }

  private delta(session: Session, event: Event): PiSessionDelta {
    const meta = this.meta(session);
    const value = message((event as { message?: unknown }).message);

    if (event.type === "message_start") {
      return { type: "append", message: value, meta };
    }
    if (event.type === "message_update" || event.type === "message_end") {
      return { type: "replace", message: value, meta };
    }
    return { type: "meta", meta };
  }

  private pushSummary(session: Session, event?: Event) {
    if (session.sessionManager.getCwd() !== this.shell.cwd) return;
    if (event && !summaryEvent(event)) return;

    const next = event ? this.live(session, event) : this.full(session);
    const cur = this.sums.get(session.sessionId);
    if (same(cur, next)) return;
    this.sums.set(session.sessionId, next);
    this.emit({
      lane: "summary",
      type: "upsert",
      sessionId: session.sessionId,
      summary: next,
      ...(event ? { event } : {}),
    } satisfies PiSessionSummaryEvent);
  }

  private pushActive(session: Session, event: Event) {
    if (session.sessionManager.getCwd() !== this.shell.cwd) return;
    if ((this.refs.get(session.sessionId) ?? 0) < 1) return;

    this.emit({
      lane: "active",
      sessionId: session.sessionId,
      delta: this.delta(session, event),
      event,
    } satisfies PiSessionActiveEvent);
  }

  private push(session: Session, event: Event) {
    this.pushSummary(session, event);
    this.pushActive(session, event);
  }

  private close() {
    this.root?.close();
    this.root = null;
    this.dir?.close();
    this.dir = null;
  }

  private bind(path: string) {
    return Effect.runSync(
      Effect.match(
        Effect.sync(() =>
          fsWatch(path, () => {
            this.bump();
          }),
        ),
        {
          onFailure: () => null,
          onSuccess: (watcher) => watcher,
        },
      ),
    );
  }

  private ensure() {
    if (this.cwd === this.shell.cwd) return;

    this.cwd = this.shell.cwd;
    this.close();
    this.sums.clear();

    const dir = SessionManager.create(this.shell.cwd).getSessionDir();
    this.root = this.bind(Path.dirname(dir));
    this.dir = this.bind(dir);
  }

  private bump() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.resync();
    }, 100);
    this.timer.unref();
  }

  private async scan() {
    this.ensure();

    const items = await SessionManager.list(this.shell.cwd);
    return items.map((item) => {
      const cur = this.items.get(item.id)?.session;
      if (cur && cur.sessionManager.getCwd() === this.shell.cwd) {
        return this.full(cur);
      }
      return {
        id: item.id,
        path: item.path,
        cwd: item.cwd,
        name: item.name ?? null,
        createdAt: item.created.toISOString(),
        modifiedAt: item.modified.toISOString(),
        messageCount: item.messageCount,
        firstMessage: item.firstMessage,
        allMessagesText: item.allMessagesText,
        isStreaming: false,
      } satisfies PiSessionSummary;
    });
  }

  private async resync() {
    const cwd = this.shell.cwd;
    const items = await Effect.runPromise(
      Effect.match(
        Effect.tryPromise({
          try: () => this.scan(),
          catch: () => null,
        }),
        {
          onFailure: () => null,
          onSuccess: (items) => items,
        },
      ),
    );
    if (!items) return;
    if (cwd !== this.shell.cwd) return;

    const prev = this.sums;
    const next = new Map(items.map((item) => [item.id, item]));
    this.sums = next;

    for (const item of items) {
      if (same(prev.get(item.id), item)) continue;
      this.emit({
        lane: "summary",
        type: "upsert",
        sessionId: item.id,
        summary: item,
      } satisfies PiSessionSummaryEvent);
    }

    for (const id of prev.keys()) {
      if (next.has(id)) continue;
      this.emit({
        lane: "summary",
        type: "remove",
        sessionId: id,
      } satisfies PiSessionSummaryEvent);
    }
  }

  private load(mgr: SessionManager) {
    return Effect.tryPromise({
      try: async () => {
        this.ensure();
        this.cfg.sync();
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
          this.push(session, event as Event);
        });
        return session;
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  create(): Effect.Effect<PiSessionSnapshot, Error> {
    return this.load(SessionManager.create(this.shell.cwd)).pipe(
      Effect.map((session) => {
        this.pushSummary(session);
        return this.snapshot(session);
      }),
    );
  }

  list(): Effect.Effect<PiSessionSummary[], Error> {
    return Effect.tryPromise({
      try: async () => {
        const items = await this.scan();
        this.sums = new Map(items.map((item) => [item.id, item]));
        return items;
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  private open(sessionId: string) {
    const cur = this.items.get(sessionId)?.session;
    if (cur && cur.sessionManager.getCwd() === this.shell.cwd) return Effect.succeed(cur);
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
    const opened = this.open(sessionId);
    return opened.pipe(Effect.map((session) => this.snapshot(session)));
  }

  watch(sessionId: string): Effect.Effect<PiSessionSnapshot, Error> {
    const bump = Effect.sync(() => {
      this.refs.set(sessionId, (this.refs.get(sessionId) ?? 0) + 1);
    });
    return bump.pipe(Effect.flatMap(() => this.get(sessionId)));
  }

  unwatch(sessionId: string) {
    return Effect.sync(() => {
      const cur = this.refs.get(sessionId) ?? 0;
      if (cur <= 1) {
        this.refs.delete(sessionId);
        return;
      }
      this.refs.set(sessionId, cur - 1);
    });
  }

  prompt(sessionId: string, text: string) {
    return this.open(sessionId).pipe(
      Effect.flatMap((session) =>
        Effect.tryPromise({
          try: () => {
            this.cfg.sync();
            return session.prompt(text);
          },
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
        Effect.tryPromise({
          try: async () => {
            this.cfg.sync();
            const next = this.cfg.reg.find(provider, model);
            if (!next) throw new Error(`Unknown model: ${provider}/${model}`);
            return next;
          },
          catch: (err) => (err instanceof Error ? err : new Error(String(err))),
        }).pipe(
          Effect.flatMap((next) =>
            Effect.tryPromise({
              try: async () => {
                await session.setModel(next);
                this.push(session, {
                  type: "model_change",
                  provider: next.provider,
                  modelId: next.id,
                });
              },
              catch: (err) => (err instanceof Error ? err : new Error(String(err))),
            }),
          ),
        ),
      ),
    );
  }

  dispose() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.close();
    for (const item of this.items.values()) {
      item.session.dispose();
    }
    this.items.clear();
    this.refs.clear();
    this.sums.clear();
  }
}
