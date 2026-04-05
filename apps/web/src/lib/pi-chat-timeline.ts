import type { PiBlock, PiSessionItem, PiToolCallBlock } from "@glass/contracts";

const tag = /<file\s+name="([^"]+)"\s*>([\s\S]*?)<\/file>/g;
const imgs = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

export type PiUserAttachment =
  | {
      kind: "file";
      name: string;
      path: string;
      note: string;
    }
  | {
      kind: "image";
      name: string;
      path: string | null;
      note: string;
      mimeType: string | null;
      data?: string;
    };

export type PiRow =
  | {
      id: string;
      kind: "user";
      text: string;
      attachments: PiUserAttachment[];
    }
  | {
      id: string;
      kind: "assistant";
      text: string;
    }
  | {
      id: string;
      kind: "assistantError";
      text: string;
    }
  | {
      id: string;
      kind: "thinking";
      text: string;
    }
  | {
      id: string;
      kind: "tool";
      name: string;
      args: string;
      result: string;
      error: boolean;
      call: PiToolCallBlock | null;
      details: Record<string, unknown> | null;
    }
  | {
      id: string;
      kind: "custom";
      name: string;
      text: string;
    }
  | {
      id: string;
      kind: "compaction";
      summary: string;
      tokens: number;
    }
  | {
      id: string;
      kind: "branch";
      summary: string;
    }
  | {
      id: string;
      kind: "bash";
      command: string;
      output: string;
      code: number | null;
      cancelled: boolean;
      truncated: boolean;
      path: string | null;
      exclude: boolean;
    }
  | {
      id: string;
      kind: "system";
      text: string;
    }
  | {
      id: string;
      kind: "explored";
      reads: number;
      searches: number;
      tools: Array<Extract<PiRow, { kind: "tool" }>>;
    }
  | {
      id: string;
      kind: "other";
      role: string;
      text: string;
    };

type ToolRow = Extract<PiRow, { kind: "tool" }>;

const reads = new Set(["read", "ls", "list_files", "list_dir", "web_fetch", "file_search"]);
const searches = new Set([
  "grep",
  "find",
  "glob",
  "glob_file_search",
  "search",
  "semantic_search",
  "web_search",
  "codebase_search",
]);
const explored = new Set([...reads, ...searches]);

function group(rows: PiRow[]): PiRow[] {
  const out: PiRow[] = [];
  let buf: ToolRow[] = [];

  const flush = () => {
    if (buf.length < 2) {
      out.push(...buf);
    } else {
      let r = 0;
      let s = 0;
      for (const t of buf) {
        if (reads.has(t.name.toLowerCase())) r += 1;
        else s += 1;
      }
      out.push({ id: buf[0]!.id, kind: "explored", reads: r, searches: s, tools: buf });
    }
    buf = [];
  };

  for (const row of rows) {
    if (row.kind === "tool" && explored.has(row.name.toLowerCase())) {
      buf.push(row);
    } else {
      flush();
      out.push(row);
    }
  }
  flush();
  return out;
}

function list(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    if (typeof (item as { type?: unknown }).type !== "string") return [];
    return [item as PiBlock];
  });
}

function clean(text: string) {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parts(text: string) {
  const files = [] as Array<{ path: string; note: string }>;
  let body = "";
  let last = 0;

  for (const hit of text.matchAll(tag)) {
    const pos = hit.index ?? 0;
    body += text.slice(last, pos);
    last = pos + hit[0].length;
    files.push({ path: hit[1] ?? "", note: (hit[2] ?? "").trim() });
  }

  body += text.slice(last);
  return { text: clean(body), files };
}

function plain(value: unknown) {
  if (typeof value === "string") return clean(value);
  return list(value)
    .flatMap((item) => {
      if (item.type === "text") return [item.text];
      if (item.type === "thinking") return [item.thinking];
      if (item.type === "image") return ["[image]"];
      if (item.type === "toolCall") return [`[${item.name}]`];
      return [`[${item.type}]`];
    })
    .join("");
}

function user(value: unknown) {
  if (typeof value === "string") {
    const next = parts(value);
    return {
      text: next.text,
      attachments: next.files.map((item) => ({
        kind: "file" as const,
        name: item.path.split(/[\\/]/).at(-1) ?? item.path,
        path: item.path,
        note: item.note,
      })),
    };
  }

  const blocks = list(value);
  const text = blocks
    .flatMap((item) => {
      if (item.type === "text") return [item.text];
      if (item.type === "thinking") return [item.thinking];
      return [];
    })
    .join("");
  const next = parts(text);
  const raw = next.files;
  const pics = raw.filter((item) => imgs.test(item.path));
  const rest = raw.filter((item) => !imgs.test(item.path));
  const used = [] as boolean[];
  let img = 0;

  const attachments = [] as PiUserAttachment[];

  for (const item of blocks) {
    if (item.type !== "image") continue;
    const meta = pics[img] ?? null;
    if (meta) used[img] = true;
    attachments.push({
      kind: "image",
      name: meta?.path.split(/[\\/]/).at(-1) ?? `Image ${img + 1}`,
      path: meta?.path ?? null,
      note: meta?.note ?? "",
      mimeType: typeof item.mimeType === "string" ? item.mimeType : null,
      ...(typeof item.data === "string" ? { data: item.data } : {}),
    });
    img += 1;
  }

  for (const item of rest) {
    attachments.push({
      kind: "file",
      name: item.path.split(/[\\/]/).at(-1) ?? item.path,
      path: item.path,
      note: item.note,
    });
  }

  for (const [i, item] of pics.entries()) {
    if (used[i]) continue;
    attachments.push({
      kind: "file",
      name: item.path.split(/[\\/]/).at(-1) ?? item.path,
      path: item.path,
      note: item.note,
    });
  }

  return {
    text: next.text,
    attachments,
  };
}

function pretty(value: unknown) {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  const out = JSON.stringify(value, null, 2);
  return typeof out === "string" ? out : String(value);
}

export function buildPiRows(items: PiSessionItem[]) {
  const rows: PiRow[] = [];
  const map = new Map<string, number>();

  for (const entry of items) {
    const msg = entry.message as Record<string, unknown>;
    const role = typeof msg.role === "string" ? msg.role : "unknown";

    if (role === "user" || role === "user-with-attachments") {
      const out = user(msg.content);
      rows.push({ id: entry.id, kind: "user", text: out.text, attachments: out.attachments });
      continue;
    }

    if (role === "assistant") {
      const items = list(msg.content);
      const call = items.some((part) => part.type === "toolCall");
      const errText =
        typeof msg.errorMessage === "string" && msg.errorMessage.trim()
          ? String(msg.errorMessage)
          : "";

      let acc = "";
      const flush = () => {
        if (!acc.trim()) return;
        rows.push({ id: `${entry.id}:a:${rows.length}`, kind: "assistant", text: clean(acc) });
        acc = "";
      };

      for (const part of items) {
        if (part.type === "thinking") {
          flush();
          const raw = typeof part.thinking === "string" ? part.thinking : "";
          const t = clean(raw);
          if (t)
            rows.push({ id: `${entry.id}:thinking:${rows.length}`, kind: "thinking", text: t });
          continue;
        }
        if (part.type === "text") {
          acc += typeof part.text === "string" ? part.text : "";
          continue;
        }
        if (part.type === "toolCall") {
          flush();
          const key = typeof part.id === "string" ? part.id : `${rows.length}`;
          rows.push({
            id: `${entry.id}:tool:${key}`,
            kind: "tool",
            name: String(part.name ?? "tool"),
            args: pretty(part.arguments),
            result: "",
            error: false,
            call: part as PiToolCallBlock,
            details: null,
          });
          map.set(key, rows.length - 1);
          continue;
        }
      }
      flush();

      if (errText) {
        rows.push({ id: `${entry.id}:a:err`, kind: "assistantError", text: errText });
      }

      const hadContent = items.some(
        (part) =>
          part.type === "thinking" ||
          (part.type === "text" && String((part as { text?: string }).text).trim()),
      );
      if (!call && !hadContent && !errText) {
        rows.push({ id: entry.id, kind: "assistant", text: "..." });
      }
      continue;
    }

    if (role === "toolResult") {
      const key = typeof msg.toolCallId === "string" ? msg.toolCallId : "";
      const out = plain(msg.content);
      const pos = key ? map.get(key) : undefined;
      if (typeof pos === "number") {
        const row = rows[pos];
        if (row?.kind !== "tool") continue;
        rows[pos] = {
          ...row,
          name: typeof msg.toolName === "string" ? msg.toolName : row.name,
          result: out,
          error: Boolean(msg.isError),
          details: msg.details === undefined ? null : (msg.details as Record<string, unknown>),
        };
        continue;
      }
      rows.push({
        id: entry.id,
        kind: "tool",
        name: typeof msg.toolName === "string" ? msg.toolName : "tool",
        args: "",
        result: out,
        error: Boolean(msg.isError),
        call: null,
        details: msg.details === undefined ? null : (msg.details as Record<string, unknown>),
      });
      continue;
    }

    if (role === "custom") {
      if (!msg.display) continue;
      rows.push({
        id: entry.id,
        kind: "custom",
        name: String(msg.customType ?? "custom"),
        text: plain(msg.content),
      });
      continue;
    }

    if (role === "compactionSummary") {
      rows.push({
        id: entry.id,
        kind: "compaction",
        summary: String(msg.summary ?? ""),
        tokens: Number(msg.tokensBefore ?? 0),
      });
      continue;
    }

    if (role === "branchSummary") {
      rows.push({ id: entry.id, kind: "branch", summary: String(msg.summary ?? "") });
      continue;
    }

    if (role === "bashExecution") {
      rows.push({
        id: entry.id,
        kind: "bash",
        command: String(msg.command ?? ""),
        output: String(msg.output ?? ""),
        code: typeof msg.exitCode === "number" ? msg.exitCode : null,
        cancelled: Boolean(msg.cancelled),
        truncated: Boolean(msg.truncated),
        path: typeof msg.fullOutputPath === "string" ? msg.fullOutputPath : null,
        exclude: Boolean(msg.excludeFromContext),
      });
      continue;
    }

    if (role === "system") {
      rows.push({ id: entry.id, kind: "system", text: plain(msg.content) });
      continue;
    }

    rows.push({ id: entry.id, kind: "other", role, text: plain(msg.content) });
  }

  return group(rows);
}
