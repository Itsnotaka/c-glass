import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import * as Path from "node:path";

import * as Effect from "effect/Effect";
import type {
  PiAskEvent,
  PiAskReply,
  PiAskState,
  PiPromptAttachment,
  PiPromptInput,
  PiSessionActiveEvent,
  PiSessionBridgeEvent,
  PiSessionSnapshot,
  PiSessionSummary,
  PiSlashCommand,
  PiThinkingLevel,
} from "@glass/contracts";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import type { ExtUiReply, ExtUiReq } from "../ext-ui-bridge";
import { image, resolveFile, text as textFile } from "../files";
import type { ShellService } from "../shell-service";
import { normalizePiRpcIntake } from "./pi-runtime-normalizer";
import { PiRpcClient } from "./pi-rpc-client";
import { PiRuntimeStore } from "./pi-runtime-store";

const mention = /(^|[\s=])@("([^"]+)"|([^\s"=]+))/g;
const other = "__other__";

type UiPending = {
  sessionId: string;
  method: ExtUiReq["type"];
  map: Map<string, string>;
};

type UiNotify = {
  message: string;
  type: "info" | "warning" | "error";
};

type UiSetEditor = {
  text: string;
};

type AskBuilt = {
  state: PiAskState;
  map: Map<string, string>;
};

function pic(mimeType: string, data: string) {
  return { type: "image" as const, mimeType, data };
}

function createRun(id: string, client: PiRpcClient, store: PiRuntimeStore) {
  return {
    id,
    client,
    store,
    refs: 0,
    off: () => {},
  };
}

function tidy(text: string) {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseMentions(text: string) {
  const paths = [] as string[];
  let out = "";
  let last = 0;
  for (const hit of text.matchAll(mention)) {
    const lead = hit[1] ?? "";
    const raw = hit[3] ?? hit[4] ?? "";
    if (!raw) continue;
    const pos = hit.index ?? 0;
    out += text.slice(last, pos + lead.length);
    last = pos + hit[0].length;
    paths.push(raw);
  }
  out += text.slice(last);
  return { text: tidy(out), paths };
}

async function attach(cwd: string, att: PiPromptAttachment) {
  if (att.type === "inline") {
    const buf = Buffer.from(att.data, "base64");
    if (att.mimeType.startsWith("image/")) {
      return {
        text: `<file name="${att.name}"></file>`,
        images: [pic(att.mimeType, att.data)],
      };
    }
    if (!textFile(att.name, buf, att.mimeType)) {
      throw new Error(`Unsupported inline attachment: ${att.name}`);
    }
    return {
      text: `<file name="${att.name}">\n${buf.toString("utf8")}\n</file>`,
      images: [],
    };
  }

  const file = resolveFile(att.path, cwd);
  const info = await stat(file).catch(() => null);
  if (!info) throw new Error(`File not found: ${att.path}`);
  if (!info.isFile()) throw new Error(`Cannot attach directory: ${att.path}`);
  if (info.size === 0) return { text: "", images: [] };

  const buf = await readFile(file);
  const type = image(file, buf);
  if (type) {
    return {
      text: `<file name="${file}"></file>`,
      images: [pic(type, buf.toString("base64"))],
    };
  }
  if (!textFile(file, buf)) {
    throw new Error(`Unsupported file attachment: ${att.path}`);
  }
  return {
    text: `<file name="${file}">\n${buf.toString("utf8")}\n</file>`,
    images: [],
  };
}

async function buildInput(cwd: string, input: string | PiPromptInput) {
  const base = typeof input === "string" ? { text: input, attachments: [] } : input;
  const found = parseMentions(base.text ?? "");
  const files = [
    ...found.paths.map((path) => ({ type: "path", path }) satisfies PiPromptAttachment),
    ...(base.attachments ?? []),
  ];

  const seen = new Set<string>();
  const list = files.filter((item) => {
    if (item.type !== "path") return true;
    const key = resolveFile(item.path, cwd);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const parts = await Promise.all(list.map((item) => attach(cwd, item)));
  const text = [
    tidy(found.text),
    parts
      .map((item) => item.text)
      .filter(Boolean)
      .join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    text,
    images: parts.flatMap((item) => item.images),
  };
}

function thinking(value: unknown): PiThinkingLevel {
  if (value === "off") return "off";
  if (value === "minimal") return "minimal";
  if (value === "low") return "low";
  if (value === "medium") return "medium";
  if (value === "high") return "high";
  if (value === "xhigh") return "xhigh";
  return "off";
}

function slug(text: string, i: number) {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `option-${i + 1}`;
}

function toReq(raw: {
  id: string;
  method: string;
  title?: string;
  options?: string[];
  timeout?: number;
  message?: string;
  placeholder?: string;
  prefill?: string;
}): Exclude<ExtUiReq, { type: "get-editor" }> | null {
  if (raw.method === "select" && Array.isArray(raw.options) && typeof raw.title === "string") {
    return {
      id: raw.id,
      type: "select",
      title: raw.title,
      options: raw.options,
      ...(typeof raw.timeout === "number" ? { timeout: raw.timeout } : {}),
    };
  }
  if (
    raw.method === "confirm" &&
    typeof raw.title === "string" &&
    typeof raw.message === "string"
  ) {
    return {
      id: raw.id,
      type: "confirm",
      title: raw.title,
      message: raw.message,
      ...(typeof raw.timeout === "number" ? { timeout: raw.timeout } : {}),
    };
  }
  if (raw.method === "input" && typeof raw.title === "string") {
    return {
      id: raw.id,
      type: "input",
      title: raw.title,
      ...(typeof raw.placeholder === "string" ? { placeholder: raw.placeholder } : {}),
      ...(typeof raw.timeout === "number" ? { timeout: raw.timeout } : {}),
    };
  }
  if (raw.method === "editor" && typeof raw.title === "string") {
    return {
      id: raw.id,
      type: "editor",
      title: raw.title,
      ...(typeof raw.prefill === "string" ? { prefill: raw.prefill } : {}),
      ...(typeof raw.timeout === "number" ? { timeout: raw.timeout } : {}),
    };
  }
  return null;
}

function summary(item: {
  id: string;
  path: string;
  cwd: string;
  name?: string;
  created: Date;
  modified: Date;
  messageCount: number;
  firstMessage: string;
  allMessagesText: string;
}): PiSessionSummary {
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
  };
}

function byTime(items: PiSessionSummary[]) {
  return items.toSorted((left, right) =>
    left.modifiedAt < right.modifiedAt ? 1 : left.modifiedAt > right.modifiedAt ? -1 : 0,
  );
}

function askState(sessionId: string, req: Exclude<ExtUiReq, { type: "get-editor" }>): AskBuilt {
  const map = new Map<string, string>();
  if (req.type === "select") {
    const options = req.options.map((label, i) => {
      const id = slug(label, i);
      map.set(id, label);
      return { id, label };
    });
    return {
      map,
      state: {
        sessionId,
        toolCallId: req.id,
        questions: [{ id: req.id, text: req.title, options }],
        current: 1,
        values: {},
        custom: {},
      },
    };
  }

  if (req.type === "confirm") {
    map.set("yes", "yes");
    map.set("no", "no");
    return {
      map,
      state: {
        sessionId,
        toolCallId: req.id,
        questions: [
          {
            id: req.id,
            text: `${req.title}\n\n${req.message}`,
            options: [
              { id: "yes", label: "Yes", recommended: true },
              { id: "no", label: "No" },
            ],
          },
        ],
        current: 1,
        values: {},
        custom: {},
      },
    };
  }

  map.set(other, other);
  return {
    map,
    state: {
      sessionId,
      toolCallId: req.id,
      questions: [
        {
          id: req.id,
          text: req.title,
          options: [
            { id: "submit", label: "Submit" },
            { id: other, label: "Type your own answer", other: true, recommended: true },
          ],
        },
      ],
      current: 1,
      values: {},
      custom: {},
    },
  };
}

export class PiRuntimeService {
  private runs = new Map<string, ReturnType<typeof createRun>>();
  private sums = new Map<string, PiSessionSummary>();
  private listeners = new Set<(event: PiSessionBridgeEvent) => void>();
  private askListeners = new Set<(event: PiAskEvent) => void>();
  private uiReq = new Set<(req: ExtUiReq) => void>();
  private uiNotify = new Set<(item: UiNotify) => void>();
  private uiSetEditor = new Set<(item: UiSetEditor) => void>();
  private asks = new Map<string, PiAskState | null>();
  private pend = new Map<string, UiPending>();

  constructor(private shell: ShellService) {}

  listen(fn: (event: PiSessionBridgeEvent) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  listenAsk(fn: (event: PiAskEvent) => void) {
    this.askListeners.add(fn);
    return () => {
      this.askListeners.delete(fn);
    };
  }

  listenUiRequest(fn: (req: ExtUiReq) => void) {
    this.uiReq.add(fn);
    return () => {
      this.uiReq.delete(fn);
    };
  }

  listenUiNotify(fn: (item: UiNotify) => void) {
    this.uiNotify.add(fn);
    return () => {
      this.uiNotify.delete(fn);
    };
  }

  listenUiSetEditor(fn: (item: UiSetEditor) => void) {
    this.uiSetEditor.add(fn);
    return () => {
      this.uiSetEditor.delete(fn);
    };
  }

  setComposerDraft(_text: string) {}

  readAsk(sessionId: string) {
    return this.asks.get(sessionId) ?? null;
  }

  answerAsk(sessionId: string, reply: PiAskReply) {
    return Effect.tryPromise({
      try: async () => {
        const ask = this.asks.get(sessionId);
        if (!ask) return;
        const pending = this.pend.get(ask.toolCallId);
        if (!pending) return;

        if (reply.type === "abort") {
          await Effect.runPromise(
            this.replyUi({
              id: ask.toolCallId,
              cancelled: true,
            }),
          );
          return;
        }

        if (pending.method === "confirm") {
          const pick =
            reply.type === "next" || reply.type === "back" ? (reply.values[0] ?? "") : "";
          await Effect.runPromise(
            this.replyUi({
              id: ask.toolCallId,
              value: pick === "yes",
            }),
          );
          return;
        }

        if (pending.method === "input" || pending.method === "editor") {
          const text =
            reply.type === "next" || reply.type === "back" ? (reply.custom ?? "").trim() : "";
          if (!text) {
            await Effect.runPromise(
              this.replyUi({
                id: ask.toolCallId,
                cancelled: true,
              }),
            );
            return;
          }
          await Effect.runPromise(
            this.replyUi({
              id: ask.toolCallId,
              value: text,
            }),
          );
          return;
        }

        const key = reply.type === "next" || reply.type === "back" ? (reply.values[0] ?? "") : "";
        const value = pending.map.get(key);
        await Effect.runPromise(
          this.replyUi(
            value
              ? {
                  id: ask.toolCallId,
                  value,
                }
              : {
                  id: ask.toolCallId,
                  cancelled: true,
                },
          ),
        );
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  replyUi(reply: ExtUiReply) {
    return Effect.tryPromise({
      try: async () => {
        const pending = this.pend.get(reply.id);
        if (!pending) return;
        const run = this.runs.get(pending.sessionId);
        if (!run) return;

        if (reply.cancelled) {
          await Effect.runPromise(
            run.client.sendUiResponse({
              type: "extension_ui_response",
              id: reply.id,
              cancelled: true,
            }),
          );
        } else if (pending.method === "confirm") {
          await Effect.runPromise(
            run.client.sendUiResponse({
              type: "extension_ui_response",
              id: reply.id,
              confirmed: reply.value === true,
            }),
          );
        } else {
          await Effect.runPromise(
            run.client.sendUiResponse({
              type: "extension_ui_response",
              id: reply.id,
              value: typeof reply.value === "string" ? reply.value : "",
            }),
          );
        }

        this.pend.delete(reply.id);
        this.asks.set(pending.sessionId, null);
        this.emitAsk(pending.sessionId, null);
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  peek() {
    return byTime([...this.sums.values()]);
  }

  create() {
    return this.openRun().pipe(Effect.map((run) => run.store.snapshot()));
  }

  list() {
    return Effect.tryPromise({
      try: async () => {
        const rows = await SessionManager.list(this.shell.cwd);
        return this.merge(rows.map((item) => summary(item)));
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  listAll() {
    return Effect.tryPromise({
      try: async () => {
        const rows = await SessionManager.listAll();
        return this.merge(rows.map((item) => summary(item)));
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  read(sessionId: string): PiSessionSnapshot | null {
    const run = this.runs.get(sessionId);
    if (run) return run.store.snapshot();

    const item = this.sums.get(sessionId);
    if (!item) return null;
    return {
      id: item.id,
      file: item.path,
      cwd: item.cwd,
      name: item.name,
      model: null,
      thinkingLevel: "off",
      messages: [],
      live: null,
      tree: [],
      isStreaming: item.isStreaming,
      pending: { steering: [], followUp: [] },
    };
  }

  get(sessionId: string) {
    return this.ensure(sessionId).pipe(Effect.map((run) => run.store.snapshot()));
  }

  watch(sessionId: string) {
    return this.ensure(sessionId).pipe(
      Effect.map((run) => {
        run.refs += 1;
        return run.store.snapshot();
      }),
    );
  }

  unwatch(sessionId: string) {
    return Effect.sync(() => {
      const run = this.runs.get(sessionId);
      if (!run) return;
      run.refs = Math.max(0, run.refs - 1);
    });
  }

  prompt(sessionId: string, input: string | PiPromptInput) {
    return this.ensure(sessionId).pipe(
      Effect.flatMap((run) =>
        Effect.tryPromise({
          try: async () => {
            const out = await buildInput(run.store.snapshot().cwd, input);
            await Effect.runPromise(run.client.prompt(out.text, out.images));
          },
          catch: (err) => (err instanceof Error ? err : new Error(String(err))),
        }),
      ),
    );
  }

  commands(sessionId: string) {
    return this.ensure(sessionId).pipe(
      Effect.flatMap((run) => run.client.getCommands()),
      Effect.map(
        (items) =>
          items
            .map((item) => ({
              name: item.name,
              source: item.source,
              ...(item.description ? { description: item.description } : {}),
            }))
            .toSorted((left, right) =>
              left.name.localeCompare(right.name),
            ) satisfies PiSlashCommand[],
      ),
    );
  }

  abort(sessionId: string) {
    return this.ensure(sessionId).pipe(Effect.flatMap((run) => run.client.abort()));
  }

  setModel(sessionId: string, provider: string, model: string) {
    return this.ensure(sessionId).pipe(
      Effect.flatMap((run) => run.client.setModel(provider, model)),
    );
  }

  setThinkingLevel(sessionId: string, next: PiThinkingLevel) {
    return this.ensure(sessionId).pipe(
      Effect.flatMap((run) => run.client.setThinkingLevel(thinking(next))),
    );
  }

  dispose() {
    for (const run of this.runs.values()) {
      run.off();
      void Effect.runPromise(run.client.stop());
    }
    this.runs.clear();
    this.sums.clear();
    this.pend.clear();
    this.asks.clear();
  }

  private workerPath() {
    const dirs = [
      Path.join(__dirname, "pi-runtime", "pi-runtime-worker.js"),
      Path.join(__dirname, "pi-runtime-worker.js"),
    ];
    const hit = dirs.find((item) => existsSync(item));
    if (!hit) throw new Error("pi-runtime worker bundle is missing");
    return hit;
  }

  private ensure(sessionId: string) {
    return Effect.tryPromise({
      try: async () => {
        const run = this.runs.get(sessionId);
        if (run) return run;

        const sum =
          this.sums.get(sessionId) ??
          (await Effect.runPromise(this.listAll())).find((item) => item.id === sessionId);
        if (!sum || !sum.path) throw new Error(`Unknown session: ${sessionId}`);
        return Effect.runPromise(this.openRun(sum.path));
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  private openRun(sessionPath?: string) {
    return Effect.tryPromise({
      try: async () => {
        const client = new PiRpcClient({
          workerPath: this.workerPath(),
          cwd: this.shell.cwd,
          ...(sessionPath ? { sessionPath } : {}),
        });
        await Effect.runPromise(client.start());
        const state = await Effect.runPromise(client.getState());
        const messages = await Effect.runPromise(client.getMessages());
        const id = state.sessionId;

        const existing = this.runs.get(id);
        if (existing) {
          await Effect.runPromise(client.stop());
          return existing;
        }

        const store = new PiRuntimeStore({
          id,
          cwd: this.shell.cwd,
          file: state.sessionFile ?? sessionPath ?? null,
        });
        store.apply({
          type: "session.state.changed",
          source: "pi-rpc",
          rawType: "bootstrap",
          rawPayload: state,
          at: new Date().toISOString(),
          state,
        });
        store.apply({
          type: "session.messages.loaded",
          source: "pi-rpc",
          rawType: "bootstrap",
          rawPayload: messages,
          at: new Date().toISOString(),
          messages,
        });

        const run = createRun(id, client, store);
        run.off = client.onIntake((intake) => {
          this.consume(run, intake);
        });
        this.runs.set(id, run);
        this.sums.set(id, store.summary());
        this.emit({
          lane: "summary",
          type: "upsert",
          sessionId: id,
          summary: store.summary(),
        });
        return run;
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  private merge(list: PiSessionSummary[]) {
    const map = new Map(list.map((item) => [item.id, item]));
    for (const run of this.runs.values()) {
      map.set(run.id, run.store.summary());
    }
    this.sums = map;
    return byTime([...map.values()]);
  }

  private consume(
    run: ReturnType<typeof createRun>,
    intake: Parameters<typeof normalizePiRpcIntake>[0],
  ) {
    const list = normalizePiRpcIntake(intake);
    for (const evt of list) {
      if (evt.type === "user-input.requested") {
        this.handleUiRequest(run.id, evt.request);
      }
      const out = run.store.apply(evt);
      if (out.summary) {
        if (out.summary.type === "upsert") {
          this.sums.set(run.id, out.summary.summary);
        }
        this.emit(out.summary);
      }
      if (out.delta && run.refs > 0) {
        this.emit({
          lane: "active",
          sessionId: run.id,
          delta: out.delta,
          event: out.event,
        } satisfies PiSessionActiveEvent);
      }
    }
  }

  private handleUiRequest(
    sessionId: string,
    req: {
      id: string;
      method: string;
      title?: string;
      options?: string[];
      timeout?: number;
      message?: string;
      placeholder?: string;
      prefill?: string;
      notifyType?: "info" | "warning" | "error";
      text?: string;
    },
  ) {
    if (req.method === "notify" && typeof req.message === "string") {
      const item = { message: req.message, type: req.notifyType ?? "info" } satisfies UiNotify;
      for (const fn of this.uiNotify) fn(item);
      return;
    }

    if (req.method === "set_editor_text" && typeof req.text === "string") {
      const item = { text: req.text } satisfies UiSetEditor;
      for (const fn of this.uiSetEditor) fn(item);
      return;
    }

    if (req.method === "setStatus" || req.method === "setWidget" || req.method === "setTitle") {
      return;
    }

    const next = toReq(req);
    if (!next) return;

    this.pend.set(req.id, { sessionId, method: next.type, map: new Map() });
    if (
      next.type === "input" ||
      next.type === "editor" ||
      next.type === "select" ||
      next.type === "confirm"
    ) {
      const built = askState(sessionId, next);
      this.pend.set(req.id, { sessionId, method: next.type, map: built.map });
      this.asks.set(sessionId, built.state);
      this.emitAsk(sessionId, built.state);
    }
    for (const fn of this.uiReq) fn(next);
  }

  private emit(event: PiSessionBridgeEvent) {
    for (const fn of this.listeners) fn(event);
  }

  private emitAsk(sessionId: string, state: PiAskState | null) {
    for (const fn of this.askListeners) fn({ sessionId, state });
  }
}
