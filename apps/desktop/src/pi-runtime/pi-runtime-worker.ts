import type { ExtensionContext, ToolDefinition } from "@mariozechner/pi-coding-agent";
import { setCursorSessionCwd } from "../cursor-provider";
import { loadPi } from "../pi-imports";
import { PiConfigService } from "../pi-config-service";

const other = "Type your own answer";
const done = "Done selecting";

type AskInput = {
  questions: Array<{
    id: string;
    question: string;
    options: Array<{ label: string }>;
    multi?: boolean;
    recommended?: number;
  }>;
  timeout?: number;
};

type AskPick = {
  selectedOptions: string[];
  customInput?: string;
  cancelled: boolean;
};

type AskResult = {
  id: string;
  question: string;
  options: string[];
  multi: boolean;
  selectedOptions: string[];
  customInput?: string;
  timedOut: boolean;
};

const ask = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      description: "Questions to ask",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "Question ID" },
          question: { type: "string", description: "Question text" },
          options: {
            type: "array",
            description: "Available options",
            minItems: 2,
            maxItems: 8,
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "Display label" },
              },
              required: ["label"],
              additionalProperties: false,
            },
          },
          multi: { type: "boolean", description: "Allow multiple selections" },
          recommended: { type: "number", description: "Recommended option index" },
        },
        required: ["id", "question", "options"],
        additionalProperties: false,
      },
    },
    timeout: { type: "number", description: "Timeout in seconds (0 = disabled)" },
  },
  required: ["questions"],
  additionalProperties: false,
} as never as ToolDefinition["parameters"];

function readArg(args: string[], key: string) {
  const i = args.indexOf(key);
  if (i < 0) return null;
  const next = args[i + 1];
  if (!next || next.startsWith("--")) {
    throw new Error(`Missing value for ${key}`);
  }
  return next;
}

function parseArgv(args: string[]) {
  const cwd = readArg(args, "--cwd") ?? process.cwd();
  const session = readArg(args, "--session");
  return { cwd, session };
}

function ms(value: number | undefined) {
  if (typeof value !== "number") return undefined;
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.floor(value * 1000);
}

function uiOpts(signal: AbortSignal | undefined, timeout: number | undefined) {
  return {
    ...(signal ? { signal } : {}),
    ...(timeout !== undefined ? { timeout } : {}),
  };
}

async function pickOne(
  ctx: ExtensionContext,
  title: string,
  options: string[],
  signal: AbortSignal | undefined,
  timeout: number | undefined,
): Promise<AskPick> {
  const pick = await ctx.ui.select(title, [...options, other], uiOpts(signal, timeout));
  if (pick === undefined) {
    return { selectedOptions: [], cancelled: true };
  }
  if (pick !== other) {
    return { selectedOptions: [pick], cancelled: false };
  }

  const input = (await ctx.ui.input(title, "Type your answer", uiOpts(signal, timeout)))?.trim();
  if (!input) {
    return { selectedOptions: [], cancelled: true };
  }
  return { selectedOptions: [], customInput: input, cancelled: false };
}

async function pickMany(
  ctx: ExtensionContext,
  title: string,
  options: string[],
  signal: AbortSignal | undefined,
  timeout: number | undefined,
): Promise<AskPick> {
  const selected = new Set<string>();

  while (true) {
    const head = selected.size > 0 ? `${title}\n\nSelected: ${[...selected].join(", ")}` : title;
    const pick = await ctx.ui.select(head, [...options, done, other], uiOpts(signal, timeout));
    if (pick === undefined) {
      return { selectedOptions: [], cancelled: true };
    }
    if (pick === done) {
      return { selectedOptions: [...selected], cancelled: false };
    }
    if (pick === other) {
      const input = (
        await ctx.ui.input(title, "Type your answer", uiOpts(signal, timeout))
      )?.trim();
      if (!input) {
        return { selectedOptions: [], cancelled: true };
      }
      return {
        selectedOptions: [...selected],
        customInput: input,
        cancelled: false,
      };
    }
    if (selected.has(pick)) {
      selected.delete(pick);
      continue;
    }
    selected.add(pick);
  }
}

function format(item: AskResult) {
  if (item.customInput !== undefined) {
    return `${item.id}: "${item.customInput}"`;
  }
  if (item.selectedOptions.length > 0) {
    if (item.multi) {
      return `${item.id}: [${item.selectedOptions.join(", ")}]`;
    }
    return `${item.id}: ${item.selectedOptions[0] ?? ""}`;
  }
  return `${item.id}: (cancelled)`;
}

function askTool(): ToolDefinition {
  return {
    name: "ask",
    label: "Ask",
    description:
      "Ask the user questions for quick clarification during execution. " +
      "Supports single or multiple questions with multi-select, recommended options, " +
      "and custom text input. Use this to gather preferences, clarify ambiguous instructions, " +
      "or get decisions on implementation choices.",
    parameters: ask,

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (!ctx.hasUI) {
        return {
          content: [{ type: "text", text: "Error: ask tool requires interactive mode" }],
          details: { ok: false, reason: "no_ui" },
          isError: true,
        };
      }

      const input = params as AskInput;
      const timeout = ms(input.timeout);
      const results = [] as AskResult[];

      for (const item of input.questions) {
        const options = item.options.map((opt) => opt.label);
        const pick = item.multi
          ? await pickMany(ctx, item.question, options, signal, timeout)
          : await pickOne(ctx, item.question, options, signal, timeout);

        if (pick.cancelled) {
          return {
            content: [{ type: "text", text: "Cancelled by user." }],
            details: { ok: false, cancelled: true },
            isError: true,
          };
        }

        results.push({
          id: item.id,
          question: item.question,
          options,
          multi: item.multi ?? false,
          selectedOptions: pick.selectedOptions,
          ...(pick.customInput !== undefined ? { customInput: pick.customInput } : {}),
          timedOut: false,
        });
      }

      if (results.length === 1 && results[0]) {
        const result = results[0];
        const text =
          result.customInput !== undefined
            ? `User provided custom input: ${result.customInput}`
            : result.selectedOptions.length > 0
              ? result.multi
                ? `User selected: ${result.selectedOptions.join(", ")}`
                : `User selected: ${result.selectedOptions[0] ?? ""}`
              : "User cancelled the selection";

        return {
          content: [{ type: "text", text }],
          details: { ok: true, result },
        };
      }

      return {
        content: [{ type: "text", text: `User answers:\n${results.map(format).join("\n")}` }],
        details: { ok: true, results },
      };
    },
  };
}

async function run() {
  const argv = parseArgv(process.argv.slice(2));
  const cfg = new PiConfigService();
  cfg.sync();
  await cfg.cursorSync();
  cfg.sync();

  const pi = await loadPi();
  const settings = cfg.settings(argv.cwd);
  const loader = new pi.DefaultResourceLoader({
    cwd: argv.cwd,
    agentDir: cfg.paths(argv.cwd).agent,
    settingsManager: settings,
  });
  await loader.reload();

  const mgr = argv.session
    ? pi.SessionManager.open(argv.session)
    : pi.SessionManager.create(argv.cwd);
  const out = await pi.createAgentSession({
    cwd: argv.cwd,
    authStorage: cfg.auth,
    modelRegistry: cfg.reg,
    resourceLoader: loader,
    sessionManager: mgr,
    settingsManager: settings,
    customTools: [askTool()],
  });

  setCursorSessionCwd(out.session.sessionId, out.session.sessionManager.getCwd());
  await pi.runRpcMode(out.session);
}

void run().catch((err) => {
  const text = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  process.stderr.write(`${text}\n`);
  process.exit(1);
});
