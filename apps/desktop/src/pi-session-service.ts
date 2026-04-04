import { readFileSync, statSync, watch as fsWatch, type FSWatcher } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import * as Path from "node:path";

import * as Effect from "effect/Effect";
import type {
  PiBlock,
  PiMessage,
  PiPromptAttachment,
  PiPromptInput,
  PiSessionActiveEvent,
  PiSessionBridgeEvent,
  PiSessionDelta,
  PiSessionEntry,
  PiSessionEvent,
  PiSessionItem,
  PiSessionMeta,
  PiSessionPending,
  PiSessionSnapshot,
  PiSessionSummary,
  PiSessionSummaryEvent,
  PiSessionTreeNode,
  PiSlashCommand,
  PiThinkingLevel,
} from "@glass/contracts";
import {
  DefaultResourceLoader,
  SessionManager,
  createAgentSession,
} from "@mariozechner/pi-coding-agent";
import { cursorExtension } from "./cursor-provider";
import { image, resolveFile, text as textFile } from "./files";
import { PiConfigService } from "./pi-config-service";
import { ShellService } from "./shell-service";

const tag = /<file\s+name="([^"]+)"\s*>([\s\S]*?)<\/file>/g;

type Img = {
  type: "image";
  mimeType: string;
  data: string;
};

type Session = Awaited<ReturnType<typeof createAgentSession>>["session"];
type Event = PiSessionEvent;

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

  for (const hit of text.matchAll(tag)) {
    const raw = hit[1] ?? "";
    const note = (hit[2] ?? "").trim();
    const pos = hit.index ?? 0;
    body += text.slice(last, pos);
    last = pos + hit[0].length;
    out.push({ path: raw, note });
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
  const seen = out.files.filter((item) => image(item.path)).length;
  const more = Math.max(0, out.imgs - seen);
  const list = [
    ...out.files.map((item) => `[${Path.basename(item.path) || item.path}]`),
    ...Array.from({ length: more }, () => "[image]"),
  ];
  return [tidy(out.text), ...list].filter(Boolean).join("\n");
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
      ...(item.details !== undefined ? { details: item.details as Record<string, unknown> } : {}),
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

function mid(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const item = value as Record<string, unknown>;
  const role = typeof item.role === "string" ? item.role : "unknown";

  if (role === "toolResult" && typeof item.toolCallId === "string" && item.toolCallId) {
    return `tool:${item.toolCallId}`;
  }

  const stamp = item.timestamp;
  if (typeof stamp === "number" || typeof stamp === "string") {
    const key = String(stamp);
    if (key) return `${role}:${key}`;
  }

  return fallback;
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

function rows(mgr: SessionManager): PiSessionItem[] {
  const entries = mgr.getEntries();
  const by = new Map(entries.map((entry) => [entry.id, entry]));
  const leaf = mgr.getLeafId();

  if (leaf === null) return [];

  const last = leaf ? by.get(leaf) : entries.at(-1);
  if (!last) return [];

  const path = [] as typeof entries;
  let cur: (typeof entries)[number] | undefined = last;
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? by.get(cur.parentId) : undefined;
  }

  const pick = (entry: (typeof entries)[number]): PiSessionItem[] => {
    if (entry.type === "message") {
      return [{ id: mid(entry.message, entry.id), message: message(entry.message) }];
    }

    if (entry.type === "custom_message") {
      return [
        {
          id: entry.id,
          message: message({
            role: "custom",
            customType: entry.customType,
            content: entry.content,
            display: entry.display,
            ...(entry.details !== undefined ? { details: entry.details } : {}),
          }),
        },
      ];
    }

    if (entry.type === "branch_summary") {
      return [
        {
          id: entry.id,
          message: message({
            role: "branchSummary",
            fromId: entry.fromId,
            summary: entry.summary,
          }),
        },
      ];
    }

    if (entry.type === "compaction") {
      return [
        {
          id: entry.id,
          message: message({
            role: "compactionSummary",
            summary: entry.summary,
            tokensBefore: entry.tokensBefore,
          }),
        },
      ];
    }

    return [];
  };

  const cut = path.findLast(
    (entry): entry is Extract<(typeof entries)[number], { type: "compaction" }> =>
      entry.type === "compaction",
  );

  if (!cut) {
    return path.flatMap((entry) => pick(entry));
  }

  const pos = path.findIndex((entry) => entry.id === cut.id);
  const kept = path.slice(0, pos).reduce(
    (state, entry) => {
      const on = state.on || entry.id === cut.firstKeptEntryId;
      if (!on) return state;
      return { on, out: [...state.out, ...pick(entry)] };
    },
    { on: false, out: [] as PiSessionItem[] },
  ).out;

  return [pick(cut), kept, path.slice(pos + 1).flatMap((entry) => pick(entry))]
    .flatMap((part) => part)
    .filter(Boolean);
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

function parseArgs(text: string) {
  const out = [] as string[];
  let cur = "";
  let quote: string | null = null;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] ?? "";
    if (quote) {
      if (char === quote) {
        quote = null;
        continue;
      }
      cur += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === " " || char === "\t") {
      if (!cur) continue;
      out.push(cur);
      cur = "";
      continue;
    }
    cur += char;
  }

  if (cur) out.push(cur);
  return out;
}

function sub(text: string, args: string[]) {
  let out = text.replace(/\$(\d+)/g, (_, num: string) => args[Number(num) - 1] ?? "");
  out = out.replace(/\$\{@:(\d+)(?::(\d+))?\}/g, (_, raw: string, len?: string) => {
    let from = Number(raw) - 1;
    if (from < 0) from = 0;
    if (!len) return args.slice(from).join(" ");
    return args.slice(from, from + Number(len)).join(" ");
  });
  const joined = args.join(" ");
  return out.replace(/\$ARGUMENTS/g, joined).replace(/\$@/g, joined);
}

function strip(text: string) {
  if (!text.startsWith("---\n")) return text;
  const cut = text.indexOf("\n---\n", 4);
  if (cut < 0) return text;
  return text.slice(cut + 5);
}

function command(text: string) {
  if (!text.startsWith("/")) return null;
  const cut = text.indexOf(" ");
  if (cut < 0) return { name: text.slice(1), args: "" };
  return { name: text.slice(1, cut), args: text.slice(cut + 1).trim() };
}

function mentions(text: string) {
  const paths = [] as string[];
  const exp = /(^|[\s=])@("([^"]+)"|([^\s"=]+))/g;
  let out = "";
  let last = 0;

  for (const hit of text.matchAll(exp)) {
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
        images: [{ type: "image", mimeType: att.mimeType, data: att.data }] as Img[],
      };
    }
    if (!textFile(att.name, buf, att.mimeType)) {
      throw new Error(`Unsupported inline attachment: ${att.name}`);
    }
    return {
      text: `<file name="${att.name}">\n${buf.toString("utf8")}\n</file>`,
      images: [] as Img[],
    };
  }

  const file = resolveFile(att.path, cwd);
  const info = await stat(file).catch(() => null);
  if (!info) throw new Error(`File not found: ${att.path}`);
  if (!info.isFile()) throw new Error(`Cannot attach directory: ${att.path}`);
  if (info.size === 0) return { text: "", images: [] as Img[] };

  const buf = await readFile(file);
  const type = image(file, buf);
  if (type) {
    return {
      text: `<file name="${file}"></file>`,
      images: [{ type: "image", mimeType: type, data: buf.toString("base64") }] as Img[],
    };
  }
  if (!textFile(file, buf)) {
    throw new Error(`Unsupported file attachment: ${att.path}`);
  }
  return {
    text: `<file name="${file}">\n${buf.toString("utf8")}\n</file>`,
    images: [] as Img[],
  };
}

async function buildInput(session: Session, input: string | PiPromptInput, cwd: string) {
  const base = typeof input === "string" ? { text: input, attachments: [] } : input;
  const found = mentions(base.text ?? "");
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

  const hasFiles = list.length > 0;
  let text = tidy(found.text);
  let expand = true;

  if (hasFiles && text.startsWith("/skill:")) {
    const cut = text.indexOf(" ");
    const raw = cut < 0 ? text.slice(7) : text.slice(7, cut);
    const args = cut < 0 ? "" : text.slice(cut + 1).trim();
    const skill = session.resourceLoader.getSkills().skills.find((item) => item.name === raw);
    if (!skill) {
      throw new Error(`Unknown skill: ${raw}`);
    }
    const body = strip(readFileSync(skill.filePath, "utf8")).trim();
    const block = `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${skill.baseDir}.\n\n${body}\n</skill>`;
    text = args ? `${block}\n\n${args}` : block;
    expand = false;
  }

  if (hasFiles) {
    const cmd = command(text);
    if (cmd) {
      const prompt = session.promptTemplates.find((item) => item.name === cmd.name);
      if (prompt) {
        text = sub(prompt.content, parseArgs(cmd.args));
        expand = false;
      } else if (session.extensionRunner?.getCommand(cmd.name)) {
        throw new Error(`Attachments are not supported with /${cmd.name}`);
      } else {
        throw new Error(`Attachments are not supported with /${cmd.name}`);
      }
    }
  }

  const parts = await Promise.all(list.map((item) => attach(cwd, item)));
  const tail = parts
    .map((item) => item.text)
    .filter(Boolean)
    .join("\n");
  const body = [text, tail].filter(Boolean).join(text && tail ? "\n\n" : "");
  return {
    text: body,
    images: parts.flatMap((item) => item.images),
    expand,
  };
}

function commands(session: Session) {
  const map = new Map<string, PiSlashCommand>();
  const add = (item: PiSlashCommand) => {
    if (map.has(item.name)) return;
    map.set(item.name, item);
  };

  for (const item of session.promptTemplates) {
    add({
      name: item.name,
      source: "prompt",
      ...(item.description ? { description: item.description } : {}),
    });
  }
  for (const item of session.extensionRunner?.getRegisteredCommands() ?? []) {
    add({
      name: item.name,
      source: "extension",
      ...(item.description ? { description: item.description } : {}),
    });
  }
  for (const item of session.resourceLoader.getSkills().skills) {
    add({
      name: `skill:${item.name}`,
      source: "skill",
      ...(item.description ? { description: item.description } : {}),
    });
  }

  return [...map.values()].toSorted((left, right) => left.name.localeCompare(right.name));
}

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
    return {
      id: session.sessionId,
      file: session.sessionFile ?? null,
      cwd: session.sessionManager.getCwd(),
      name: session.sessionName ?? null,
      model: this.meta(session).model,
      thinkingLevel: this.meta(session).thinkingLevel,
      messages: rows(session.sessionManager),
      live: null,
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
    const value = (event as { message?: unknown }).message;

    if (event.type === "message_start") {
      if ((value as { role?: unknown })?.role !== "assistant") {
        return { type: "meta", meta };
      }
      return {
        type: "live",
        item: { id: mid(value, `${session.sessionId}:live`), message: message(value) },
        meta,
      };
    }
    if (event.type === "message_update") {
      return {
        type: "live",
        item: { id: mid(value, `${session.sessionId}:live`), message: message(value) },
        meta,
      };
    }
    if (event.type === "message_end") {
      return {
        type: "commit",
        item: {
          id: mid(value, `${session.sessionId}:${session.messages.length}`),
          message: message(value),
        },
        meta,
      };
    }
    return { type: "meta", meta };
  }

  private pushSummary(session: Session, event?: Event) {
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

  private async scan(all = false) {
    this.ensure();

    const items = all ? await SessionManager.listAll() : await SessionManager.list(this.shell.cwd);
    return items.map((item) => {
      const cur = this.items.get(item.id)?.session;
      if (cur) {
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
          try: () => this.scan(true),
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
        const settings = this.cfg.settings(this.shell.cwd);
        const loader = new DefaultResourceLoader({
          cwd: this.shell.cwd,
          agentDir: this.cfg.paths(this.shell.cwd).agent,
          settingsManager: settings,
          extensionFactories: [cursorExtension],
        });
        await loader.reload();
        const result = await createAgentSession({
          cwd: this.shell.cwd,
          authStorage: this.cfg.auth,
          modelRegistry: this.cfg.reg,
          resourceLoader: loader,
          sessionManager: mgr,
          settingsManager: settings,
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

  listAll(): Effect.Effect<PiSessionSummary[], Error> {
    return Effect.tryPromise({
      try: async () => {
        const items = await this.scan(true);
        this.sums = new Map(items.map((item) => [item.id, item]));
        return items;
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  peek() {
    return [...this.sums.values()].toSorted((left, right) =>
      left.modifiedAt < right.modifiedAt ? 1 : left.modifiedAt > right.modifiedAt ? -1 : 0,
    );
  }

  private open(sessionId: string) {
    const cur = this.items.get(sessionId)?.session;
    if (cur) return Effect.succeed(cur);
    return this.listAll().pipe(
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
    return Effect.gen(
      function* (this: PiSessionService) {
        const session: Session = yield* this.open(sessionId);
        return this.snapshot(session);
      }.bind(this),
    );
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

  prompt(sessionId: string, input: string | PiPromptInput) {
    return this.open(sessionId).pipe(
      Effect.flatMap((session) =>
        Effect.tryPromise({
          try: async () => {
            this.cfg.sync();
            const next = await buildInput(session, input, session.sessionManager.getCwd());
            return session.prompt(next.text, {
              images: next.images,
              ...(next.expand ? {} : { expandPromptTemplates: false }),
            });
          },
          catch: (err) => (err instanceof Error ? err : new Error(String(err))),
        }),
      ),
    );
  }

  commands(sessionId: string) {
    return Effect.gen(
      function* (this: PiSessionService) {
        const session: Session = yield* this.open(sessionId);
        return commands(session);
      }.bind(this),
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

  setThinkingLevel(sessionId: string, level: PiThinkingLevel) {
    return this.open(sessionId).pipe(
      Effect.flatMap((session) =>
        Effect.tryPromise({
          try: async () => {
            session.setThinkingLevel(level);
          },
          catch: (err) => (err instanceof Error ? err : new Error(String(err))),
        }),
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
