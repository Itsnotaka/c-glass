import type { PiBlock, PiMessage, PiToolCallBlock } from "@glass/contracts";

export type PiRow =
  | {
      kind: "user";
      text: string;
    }
  | {
      kind: "assistant";
      text: string;
    }
  | {
      kind: "tool";
      name: string;
      args: string;
      result: string;
      error: boolean;
      key: string;
      call: PiToolCallBlock | null;
    }
  | {
      kind: "custom";
      name: string;
      text: string;
    }
  | {
      kind: "compaction";
      summary: string;
      tokens: number;
    }
  | {
      kind: "branch";
      summary: string;
    }
  | {
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
      kind: "system";
      text: string;
    }
  | {
      kind: "other";
      role: string;
      text: string;
    };

function list(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    if (typeof (item as { type?: unknown }).type !== "string") return [];
    return [item as PiBlock];
  });
}

function body(value: unknown) {
  return list(value)
    .flatMap((item) => {
      if (item.type === "text") return [item.text];
      if (item.type === "thinking") return [item.thinking];
      return [];
    })
    .join("");
}

function flat(value: unknown) {
  return list(value)
    .flatMap((item) => {
      if (item.type === "text") return [item.text];
      if (item.type === "thinking") return [item.thinking];
      if (item.type === "toolCall") return [`[${item.name}]`];
      return [`[${item.type}]`];
    })
    .join("");
}

function text(value: unknown) {
  if (typeof value === "string") return value;
  return flat(value);
}

function pretty(value: unknown) {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  const out = JSON.stringify(value, null, 2);
  return typeof out === "string" ? out : String(value);
}

export function buildPiRows(messages: PiMessage[]) {
  const rows: PiRow[] = [];
  const map = new Map<string, number>();

  for (const item of messages) {
    const msg = item as Record<string, unknown>;
    const role = typeof msg.role === "string" ? msg.role : "unknown";

    if (role === "user" || role === "user-with-attachments") {
      rows.push({ kind: "user", text: text(msg.content) });
      continue;
    }

    if (role === "assistant") {
      const items = list(msg.content);
      const call = items.some((part) => part.type === "toolCall");
      const err = typeof msg.errorMessage === "string" && msg.errorMessage.trim();
      const out = body(items);
      const full = err ? `${out}${out ? "\n" : ""}${msg.errorMessage}` : out;
      if (full.trim()) {
        rows.push({ kind: "assistant", text: full });
      }
      for (const part of items) {
        if (part.type !== "toolCall") continue;
        const key = typeof part.id === "string" ? part.id : `${rows.length}`;
        const pos = rows.length;
        rows.push({
          kind: "tool",
          name: String(part.name ?? "tool"),
          args: pretty(part.arguments),
          result: "",
          error: false,
          key,
          call: part as PiToolCallBlock,
        });
        map.set(key, pos);
      }
      if (!call && !full.trim()) {
        rows.push({ kind: "assistant", text: "..." });
      }
      continue;
    }

    if (role === "toolResult") {
      const key = typeof msg.toolCallId === "string" ? msg.toolCallId : "";
      const out = flat(msg.content);
      const pos = key ? map.get(key) : undefined;
      if (typeof pos === "number") {
        const row = rows[pos];
        if (row?.kind !== "tool") continue;
        rows[pos] = {
          ...row,
          name: typeof msg.toolName === "string" ? msg.toolName : row.name,
          result: out,
          error: Boolean(msg.isError),
        };
        continue;
      }
      rows.push({
        kind: "tool",
        name: typeof msg.toolName === "string" ? msg.toolName : "tool",
        args: "",
        result: out,
        error: Boolean(msg.isError),
        key: `${rows.length}`,
        call: null,
      });
      continue;
    }

    if (role === "custom") {
      if (!msg.display) continue;
      rows.push({
        kind: "custom",
        name: String(msg.customType ?? "custom"),
        text: text(msg.content),
      });
      continue;
    }

    if (role === "compactionSummary") {
      rows.push({
        kind: "compaction",
        summary: String(msg.summary ?? ""),
        tokens: Number(msg.tokensBefore ?? 0),
      });
      continue;
    }

    if (role === "branchSummary") {
      rows.push({ kind: "branch", summary: String(msg.summary ?? "") });
      continue;
    }

    if (role === "bashExecution") {
      rows.push({
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
      rows.push({ kind: "system", text: text(msg.content) });
      continue;
    }

    rows.push({ kind: "other", role, text: text(msg.content) });
  }

  return rows;
}
