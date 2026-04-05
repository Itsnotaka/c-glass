import type { PiAskReply, PiAskState } from "@glass/contracts";
import type { AskOpt, AskQ } from "@glass/shared/glass-ext";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";

const other = "__other__";
const picks = ["a", "b", "c", "d", "e", "f", "g", "h"];

const optItem = Type.Object({
  label: Type.String({ description: "Display label" }),
});

const qItem = Type.Object({
  id: Type.String({ description: "Question ID, e.g. 'auth', 'cache'" }),
  question: Type.String({ description: "Question text" }),
  options: Type.Array(optItem, {
    description: "Available options",
    minItems: 2,
    maxItems: 8,
  }),
  multi: Type.Optional(Type.Boolean({ description: "Allow multiple selections" })),
  recommended: Type.Optional(
    Type.Number({ description: "Index of recommended option (0-indexed)" }),
  ),
});

const askSchema = Type.Object({
  questions: Type.Array(qItem, {
    description: "Questions to ask",
    minItems: 1,
    maxItems: 4,
  }),
  timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (0 = disabled)" })),
});

type RawQ = {
  id: string;
  question: string;
  options: { label: string }[];
  multi?: boolean;
  recommended?: number;
};

type AskOut = {
  id: string;
  question: string;
  options: string[];
  multi: boolean;
  selectedOptions: string[];
  customInput?: string;
  timedOut?: boolean;
};

type Pending = {
  state: PiAskState;
  done: (value: { reply: PiAskReply; timedOut: boolean }) => void;
  timer: ReturnType<typeof setTimeout> | null;
  stop: (() => void) | null;
};

function slug(text: string, i: number) {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `option-${i + 1}`;
}

function prep(raw: RawQ[]): AskQ[] {
  return raw.map((q) => ({
    id: q.id,
    text: q.question,
    ...(q.multi ? { multi: true } : {}),
    options: [
      ...q.options.map((item, i) => ({
        id: slug(item.label, i),
        label: item.label,
        ...(picks[i] ? { shortcut: picks[i] } : {}),
        ...(q.recommended === i ? { recommended: true } : {}),
      })),
      {
        id: other,
        label: "Type your own answer",
        ...(picks[q.options.length] ? { shortcut: picks[q.options.length] } : {}),
        other: true,
      },
    ],
  }));
}

function err(text: string, details: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    details,
    isError: true,
  };
}

function ok(text: string, details: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

function fmt(item: AskOut) {
  if (item.customInput !== undefined) return `${item.id}: "${item.customInput}"`;
  if (item.selectedOptions.length > 0) {
    return item.multi
      ? `${item.id}: [${item.selectedOptions.join(", ")}]`
      : `${item.id}: ${item.selectedOptions[0]}`;
  }
  return `${item.id}: (cancelled)`;
}

function done(reply: PiAskReply) {
  if (reply.type === "abort") return false;
  if (reply.type === "back") return true;
  if (reply.type === "skip") return true;
  return true;
}

function auto(q: AskQ, state: PiAskState) {
  const cur = state.values[q.id] ?? [];
  const text = state.custom[q.id]?.trim() ?? "";
  if (text) {
    return {
      reply: { type: "next", questionId: q.id, values: cur, custom: text } satisfies PiAskReply,
      timedOut: true,
    };
  }
  if (cur.length > 0) {
    return {
      reply: { type: "next", questionId: q.id, values: cur } satisfies PiAskReply,
      timedOut: true,
    };
  }

  const next =
    q.options.find((item) => !item.other && item.recommended) ??
    q.options.find((item) => !item.other);
  return {
    reply: {
      type: "next",
      questionId: q.id,
      values: next ? [next.id] : [],
    } satisfies PiAskReply,
    timedOut: true,
  };
}

function save(store: Record<string, string[]>, key: string, vals: string[] | undefined) {
  if (!vals || vals.length === 0) {
    delete store[key];
    return;
  }
  store[key] = vals;
}

function saveText(store: Record<string, string>, key: string, text: string | undefined) {
  const val = text?.trim() ?? "";
  if (!val) {
    delete store[key];
    return;
  }
  store[key] = val;
}

function out(
  raw: RawQ[],
  qs: AskQ[],
  values: Record<string, string[]>,
  custom: Record<string, string>,
  timed: Set<string>,
) {
  return raw.map((q, i) => {
    const map = new Map(
      qs[i]?.options.filter((item) => !item.other).map((item) => [item.id, item.label]),
    );
    const pick = (values[q.id] ?? []).flatMap((id) => {
      const val = map.get(id);
      return val ? [val] : [];
    });
    const text = custom[q.id]?.trim();
    return {
      id: q.id,
      question: q.question,
      options: q.options.map((item) => item.label),
      multi: Boolean(q.multi),
      selectedOptions: pick,
      ...(text ? { customInput: text } : {}),
      ...(timed.has(q.id) ? { timedOut: true } : {}),
    } satisfies AskOut;
  });
}

function validate(raw: RawQ[]) {
  const errs: string[] = [];
  if (raw.length === 0) errs.push("No questions provided.");
  if (raw.length > 4) errs.push(`Too many questions (${raw.length}). Max is 4.`);
  for (let i = 0; i < raw.length; i += 1) {
    const q = raw[i]!;
    if (!q.id.trim()) errs.push(`Question ${i + 1} must have an id.`);
    if (q.options.length < 2) errs.push(`Question ${i + 1} needs at least 2 options.`);
    if (q.options.length > 8) errs.push(`Question ${i + 1} has too many options (max 8).`);
    if (q.recommended === undefined) continue;
    if (q.recommended < 0 || q.recommended >= q.options.length) {
      errs.push(`Question ${i + 1} has invalid recommended index.`);
    }
  }
  return errs;
}

export class AskHub {
  private items = new Map<string, Pending>();
  private listeners = new Set<(event: { sessionId: string; state: PiAskState | null }) => void>();

  listen(fn: (event: { sessionId: string; state: PiAskState | null }) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  read(sessionId: string) {
    return this.items.get(sessionId)?.state ?? null;
  }

  private emit(sessionId: string, state: PiAskState | null) {
    for (const fn of this.listeners) fn({ sessionId, state });
  }

  answer(sessionId: string, reply: PiAskReply) {
    const item = this.items.get(sessionId);
    if (!item) return;
    if (item.timer) clearTimeout(item.timer);
    item.stop?.();
    this.items.delete(sessionId);
    this.emit(sessionId, null);
    item.done({ reply, timedOut: false });
  }

  async wait(
    sessionId: string,
    state: PiAskState,
    timeout: number | undefined,
    signal: AbortSignal | undefined,
  ) {
    return new Promise<{ reply: PiAskReply; timedOut: boolean }>((resolve) => {
      const prev = this.items.get(sessionId);
      if (prev) {
        if (prev.timer) clearTimeout(prev.timer);
        prev.stop?.();
        this.items.delete(sessionId);
        this.emit(sessionId, null);
        prev.done({ reply: { type: "abort" }, timedOut: false });
      }

      const item: Pending = {
        state,
        done: resolve,
        timer: null,
        stop: null,
      };

      if (timeout && timeout > 0) {
        item.timer = setTimeout(() => {
          if (this.items.get(sessionId) !== item) return;
          this.items.delete(sessionId);
          this.emit(sessionId, null);
          resolve(auto(state.questions[state.current - 1]!, state));
        }, timeout);
        item.timer.unref?.();
      }

      if (signal) {
        const stop = () => {
          if (this.items.get(sessionId) !== item) return;
          if (item.timer) clearTimeout(item.timer);
          this.items.delete(sessionId);
          this.emit(sessionId, null);
          resolve({ reply: { type: "abort" }, timedOut: false });
        };
        signal.addEventListener("abort", stop, { once: true });
        item.stop = () => signal.removeEventListener("abort", stop);
      }

      this.items.set(sessionId, item);
      this.emit(sessionId, state);
    });
  }
}

export function createAskTool(hub: AskHub): ToolDefinition<typeof askSchema> {
  return {
    name: "ask",
    label: "Ask",
    description:
      'Ask the user questions for quick clarification during execution. Supports single or multiple questions with multi-select, recommended options, and custom text input. Use this to gather preferences, clarify ambiguous instructions, or get decisions on implementation choices. A "Type your own answer" option is added automatically — do not include catch-all options.',
    parameters: askSchema,
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const raw = params.questions as RawQ[];
      const errs = validate(raw);
      if (errs.length > 0) {
        return err(`Invalid questions:\n- ${errs.join("\n- ")}`, {
          ok: false,
          reason: "invalid_format",
          errors: errs,
        });
      }

      const sessionId = ctx.sessionManager.getSessionId();
      const qs = prep(raw);
      const values = {} as Record<string, string[]>;
      const custom = {} as Record<string, string>;
      const timed = new Set<string>();
      const timeout = params.timeout && params.timeout > 0 ? params.timeout * 1000 : undefined;
      let i = 0;

      while (i < qs.length) {
        const q = qs[i]!;
        const state = {
          sessionId,
          toolCallId,
          questions: qs,
          current: i + 1,
          values: { ...values },
          custom: { ...custom },
        } satisfies PiAskState;
        const res = await hub.wait(sessionId, state, timeout, signal);
        const rep = res.reply;

        if (rep.type === "abort") {
          return err("Cancelled by user.", { ok: false, cancelled: true });
        }

        if (res.timedOut) timed.add(q.id);
        if (!done(rep)) {
          return err("Cancelled by user.", { ok: false, cancelled: true });
        }

        save(values, q.id, "values" in rep ? rep.values : undefined);
        saveText(custom, q.id, "custom" in rep ? rep.custom : undefined);

        if (rep.type === "back") {
          i = Math.max(0, i - 1);
          continue;
        }

        i += 1;
      }

      const results = out(raw, qs, values, custom, timed);
      if (results.length === 1) {
        const cur = results[0]!;
        const parts: string[] = [];
        if (cur.selectedOptions.length > 0) {
          parts.push(
            cur.multi
              ? `User selected: ${cur.selectedOptions.join(", ")}`
              : `User selected: ${cur.selectedOptions[0]}`,
          );
        }
        if (cur.customInput !== undefined) {
          parts.push(
            cur.customInput.includes("\n")
              ? `User provided custom input:\n${cur.customInput
                  .split("\n")
                  .map((line) => `  ${line}`)
                  .join("\n")}`
              : `User provided custom input: ${cur.customInput}`,
          );
        }
        return ok(parts.join("\n") || "User cancelled the selection", { ok: true, result: cur });
      }

      return ok(`User answers:\n${results.map(fmt).join("\n")}`, { ok: true, results });
    },
  };
}
