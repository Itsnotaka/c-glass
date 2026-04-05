import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import type {
  Api,
  AssistantMessage,
  AssistantMessageEventStream,
  Context,
  ImageContent,
  Model,
  OAuthCredentials,
  OAuthLoginCallbacks,
  SimpleStreamOptions,
  TextContent,
} from "@mariozechner/pi-ai";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionFactory, ModelRegistry } from "@mariozechner/pi-coding-agent";

type ProviderInput = Parameters<ModelRegistry["registerProvider"]>[1];

type Def = {
  id: string;
  name: string;
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
};

type ProviderModel = {
  id: string;
  name: string;
  reasoning: boolean;
  input: Array<"text" | "image">;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
};

type Reasoning = "minimal" | "low" | "medium" | "high" | "xhigh";

type Variants = {
  default: string;
  minimal?: string;
  low?: string;
  medium?: string;
  high?: string;
  xhigh?: string;
};

const CURSOR = "cursor";
const API = "cursor-agent" as Api;
const CLI = process.env["CURSOR_AGENT_PATH"] ?? process.env["AGENT_PATH"] ?? "agent";
const LOGIN = "https://cursor.com/loginDeepControl";
const NEVER = 253402300799000;
const ANSI = new RegExp(String.raw`\u001B\[[0-9;?]*[ -/]*[@-~]`, "g");
const COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

const FALLBACK: Def[] = [
  { id: "auto", name: "Auto", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  {
    id: "composer-2-fast",
    name: "Composer 2 Fast",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "composer-2",
    name: "Composer 2",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "composer-1.5",
    name: "Composer 1.5",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "claude-4.6-opus-high",
    name: "Opus 4.6 1M",
    reasoning: false,
    contextWindow: 1000000,
    maxTokens: 32000,
  },
  {
    id: "claude-4.6-opus-high-thinking",
    name: "Opus 4.6 1M Thinking",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 32000,
  },
  {
    id: "claude-4.6-opus-max",
    name: "Opus 4.6 1M Max",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 32000,
  },
  {
    id: "claude-4.6-opus-max-thinking",
    name: "Opus 4.6 1M Max Thinking",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 32000,
  },
  {
    id: "claude-4.6-sonnet-medium",
    name: "Sonnet 4.6 1M",
    reasoning: false,
    contextWindow: 1000000,
    maxTokens: 32000,
  },
  {
    id: "claude-4.6-sonnet-medium-thinking",
    name: "Sonnet 4.6 1M Thinking",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 32000,
  },
  {
    id: "claude-4.5-opus-high",
    name: "Opus 4.5",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32000,
  },
  {
    id: "claude-4.5-opus-high-thinking",
    name: "Opus 4.5 Thinking",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32000,
  },
  {
    id: "claude-4.5-sonnet",
    name: "Sonnet 4.5 1M",
    reasoning: false,
    contextWindow: 1000000,
    maxTokens: 32000,
  },
  {
    id: "claude-4.5-sonnet-thinking",
    name: "Sonnet 4.5 1M Thinking",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 32000,
  },
  {
    id: "gpt-5.4-low",
    name: "GPT-5.4 1M Low",
    reasoning: false,
    contextWindow: 1000000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.4-medium",
    name: "GPT-5.4 1M",
    reasoning: false,
    contextWindow: 1000000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.4-high",
    name: "GPT-5.4 1M High",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.4-xhigh",
    name: "GPT-5.4 1M Extra High",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.4-medium-fast",
    name: "GPT-5.4 Fast",
    reasoning: false,
    contextWindow: 1000000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.4-high-fast",
    name: "GPT-5.4 High Fast",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.4-xhigh-fast",
    name: "GPT-5.4 Extra High Fast",
    reasoning: true,
    contextWindow: 1000000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.3-codex-low",
    name: "GPT-5.3 Codex Low",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.3-codex-low-fast",
    name: "GPT-5.3 Codex Low Fast",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.3-codex",
    name: "GPT-5.3 Codex",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.3-codex-fast",
    name: "GPT-5.3 Codex Fast",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.3-codex-high",
    name: "GPT-5.3 Codex High",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.3-codex-high-fast",
    name: "GPT-5.3 Codex High Fast",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.3-codex-xhigh",
    name: "GPT-5.3 Codex Extra High",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.3-codex-xhigh-fast",
    name: "GPT-5.3 Codex Extra High Fast",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.2-low",
    name: "GPT-5.2 Low",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.2-low-fast",
    name: "GPT-5.2 Low Fast",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  { id: "gpt-5.2", name: "GPT-5.2", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  {
    id: "gpt-5.2-fast",
    name: "GPT-5.2 Fast",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.2-high",
    name: "GPT-5.2 High",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.2-high-fast",
    name: "GPT-5.2 High Fast",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.2-xhigh",
    name: "GPT-5.2 Extra High",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.2-xhigh-fast",
    name: "GPT-5.2 Extra High Fast",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.2-codex-low",
    name: "GPT-5.2 Codex Low",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.2-codex-low-fast",
    name: "GPT-5.2 Codex Low Fast",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.2-codex",
    name: "GPT-5.2 Codex",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.2-codex-fast",
    name: "GPT-5.2 Codex Fast",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.2-codex-high",
    name: "GPT-5.2 Codex High",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.2-codex-high-fast",
    name: "GPT-5.2 Codex High Fast",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.2-codex-xhigh",
    name: "GPT-5.2 Codex Extra High",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.2-codex-xhigh-fast",
    name: "GPT-5.2 Codex Extra High Fast",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.1-low",
    name: "GPT-5.1 Low",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  { id: "gpt-5.1", name: "GPT-5.1", reasoning: false, contextWindow: 200000, maxTokens: 32768 },
  {
    id: "gpt-5.1-high",
    name: "GPT-5.1 High",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.1-codex-max-low",
    name: "GPT-5.1 Codex Max Low",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.1-codex-max-low-fast",
    name: "GPT-5.1 Codex Max Low Fast",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.1-codex-max-medium",
    name: "GPT-5.1 Codex Max",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.1-codex-max-medium-fast",
    name: "GPT-5.1 Codex Max Medium Fast",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.1-codex-max-high",
    name: "GPT-5.1 Codex Max High",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.1-codex-max-high-fast",
    name: "GPT-5.1 Codex Max High Fast",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.1-codex-max-xhigh",
    name: "GPT-5.1 Codex Max Extra High",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.1-codex-max-xhigh-fast",
    name: "GPT-5.1 Codex Max Extra High Fast",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.1-codex-mini-low",
    name: "GPT-5.1 Codex Mini Low",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.1-codex-mini",
    name: "GPT-5.1 Codex Mini",
    reasoning: false,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gpt-5.1-codex-mini-high",
    name: "GPT-5.1 Codex Mini High",
    reasoning: true,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    id: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    reasoning: false,
    contextWindow: 1000000,
    maxTokens: 65536,
  },
  {
    id: "gemini-3-flash",
    name: "Gemini 3 Flash",
    reasoning: false,
    contextWindow: 1000000,
    maxTokens: 65536,
  },
  { id: "grok-4-20", name: "Grok 4.20", reasoning: false, contextWindow: 131072, maxTokens: 32768 },
  {
    id: "grok-4-20-thinking",
    name: "Grok 4.20 Thinking",
    reasoning: true,
    contextWindow: 131072,
    maxTokens: 32768,
  },
  { id: "kimi-k2.5", name: "Kimi K2.5", reasoning: false, contextWindow: 128000, maxTokens: 32768 },
];

const MAP: Record<string, Variants> = {
  "claude-sonnet-4-5": {
    default: "claude-4.5-sonnet",
    minimal: "claude-4.5-sonnet-thinking",
    low: "claude-4.5-sonnet-thinking",
    medium: "claude-4.5-sonnet-thinking",
    high: "claude-4.5-sonnet-thinking",
    xhigh: "claude-4.5-sonnet-thinking",
  },
  "claude-sonnet-4-6": {
    default: "claude-4.6-sonnet-medium",
    minimal: "claude-4.6-sonnet-medium-thinking",
    low: "claude-4.6-sonnet-medium-thinking",
    medium: "claude-4.6-sonnet-medium-thinking",
    high: "claude-4.6-sonnet-medium-thinking",
    xhigh: "claude-4.6-sonnet-medium-thinking",
  },
  "claude-opus-4-5": {
    default: "claude-4.5-opus-high",
    minimal: "claude-4.5-opus-high-thinking",
    low: "claude-4.5-opus-high-thinking",
    medium: "claude-4.5-opus-high-thinking",
    high: "claude-4.5-opus-high-thinking",
    xhigh: "claude-4.5-opus-high-thinking",
  },
  "claude-opus-4-6": {
    default: "claude-4.6-opus-high",
    minimal: "claude-4.6-opus-high-thinking",
    low: "claude-4.6-opus-high-thinking",
    medium: "claude-4.6-opus-high-thinking",
    high: "claude-4.6-opus-max-thinking",
    xhigh: "claude-4.6-opus-max-thinking",
  },
  "gpt-5.4": {
    default: "gpt-5.4-medium",
    minimal: "gpt-5.4-low",
    low: "gpt-5.4-low",
    high: "gpt-5.4-high",
    xhigh: "gpt-5.4-xhigh",
  },
  "gpt-5.4-fast": {
    default: "gpt-5.4-medium-fast",
    high: "gpt-5.4-high-fast",
    xhigh: "gpt-5.4-xhigh-fast",
  },
  "gpt-5.3-codex": {
    default: "gpt-5.3-codex",
    minimal: "gpt-5.3-codex-low",
    low: "gpt-5.3-codex-low",
    high: "gpt-5.3-codex-high",
    xhigh: "gpt-5.3-codex-xhigh",
  },
  "gpt-5.3-codex-fast": {
    default: "gpt-5.3-codex-fast",
    minimal: "gpt-5.3-codex-low-fast",
    low: "gpt-5.3-codex-low-fast",
    high: "gpt-5.3-codex-high-fast",
    xhigh: "gpt-5.3-codex-xhigh-fast",
  },
  "gpt-5.2": {
    default: "gpt-5.2",
    minimal: "gpt-5.2-low",
    low: "gpt-5.2-low",
    high: "gpt-5.2-high",
    xhigh: "gpt-5.2-xhigh",
  },
  "gpt-5.2-fast": {
    default: "gpt-5.2-fast",
    minimal: "gpt-5.2-low-fast",
    low: "gpt-5.2-low-fast",
    high: "gpt-5.2-high-fast",
    xhigh: "gpt-5.2-xhigh-fast",
  },
  "gpt-5.2-codex": {
    default: "gpt-5.2-codex",
    minimal: "gpt-5.2-codex-low",
    low: "gpt-5.2-codex-low",
    high: "gpt-5.2-codex-high",
    xhigh: "gpt-5.2-codex-xhigh",
  },
  "gpt-5.2-codex-fast": {
    default: "gpt-5.2-codex-fast",
    minimal: "gpt-5.2-codex-low-fast",
    low: "gpt-5.2-codex-low-fast",
    high: "gpt-5.2-codex-high-fast",
    xhigh: "gpt-5.2-codex-xhigh-fast",
  },
  "gpt-5.1": {
    default: "gpt-5.1",
    minimal: "gpt-5.1-low",
    low: "gpt-5.1-low",
    high: "gpt-5.1-high",
    xhigh: "gpt-5.1-high",
  },
  "gpt-5.1-codex-max": {
    default: "gpt-5.1-codex-max-medium",
    minimal: "gpt-5.1-codex-max-low",
    low: "gpt-5.1-codex-max-low",
    medium: "gpt-5.1-codex-max-medium",
    high: "gpt-5.1-codex-max-high",
    xhigh: "gpt-5.1-codex-max-xhigh",
  },
  "gpt-5.1-codex-max-fast": {
    default: "gpt-5.1-codex-max-medium-fast",
    minimal: "gpt-5.1-codex-max-low-fast",
    low: "gpt-5.1-codex-max-low-fast",
    medium: "gpt-5.1-codex-max-medium-fast",
    high: "gpt-5.1-codex-max-high-fast",
    xhigh: "gpt-5.1-codex-max-xhigh-fast",
  },
  "gpt-5.1-codex-mini": {
    default: "gpt-5.1-codex-mini",
    minimal: "gpt-5.1-codex-mini-low",
    low: "gpt-5.1-codex-mini-low",
    high: "gpt-5.1-codex-mini-high",
    xhigh: "gpt-5.1-codex-mini-high",
  },
  "gemini-3.1-pro": { default: "gemini-3.1-pro" },
  "gemini-3-flash": { default: "gemini-3-flash" },
  "grok-4-20": {
    default: "grok-4-20",
    high: "grok-4-20-thinking",
    xhigh: "grok-4-20-thinking",
  },
};

const fallback = new Map(FALLBACK.map((item) => [item.id, item]));
const canon = new Map<string, string>();
const mapped = new Set<string>();
const dirs = new Map<string, string>();

for (const [id, vars] of Object.entries(MAP)) {
  canon.set(vars.default, id);
  for (const value of Object.values(vars)) {
    if (value) mapped.add(value);
  }
}

function make(input: Def): ProviderModel {
  return {
    id: input.id,
    name: input.name,
    reasoning: input.reasoning,
    input: ["text"],
    cost: COST,
    contextWindow: input.contextWindow,
    maxTokens: input.maxTokens,
  };
}

function clean(text: string) {
  const next = text.replaceAll("\r", "").replace(ANSI, "");
  if (!next) return "";
  return next.trim();
}

function toCanonical(id: string): string | null {
  const hit = canon.get(id);
  if (hit) return hit;
  if (mapped.has(id)) return null;
  return id;
}

function toCursor(id: string, level?: string) {
  const vars = MAP[id];
  if (!vars) return id;
  const key = level as Reasoning | undefined;
  if (!key) return vars.default;
  return vars[key] ?? vars.default;
}

function usage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function resolveCwd(opts?: SimpleStreamOptions) {
  const id = typeof opts?.sessionId === "string" ? opts.sessionId : "";
  return dirs.get(id) ?? process.cwd();
}

function contentText(block: TextContent | ImageContent) {
  if (block.type === "text") return block.text;
  const size = Math.round((block.data.length * 3) / 4);
  return `[Image: ${block.mimeType}, ~${size} bytes - Cursor Agent CLI print mode cannot pass image contents]`;
}

function serialize(ctx: Context) {
  const out: string[] = [];

  if (ctx.systemPrompt) out.push(`[System]\n${ctx.systemPrompt}\n`);

  for (const msg of ctx.messages) {
    if (msg.role === "user") {
      const text =
        typeof msg.content === "string" ? msg.content : msg.content.map(contentText).join("\n");
      out.push(`[User]\n${text}`);
      continue;
    }

    if (msg.role === "assistant") {
      const text = msg.content
        .filter((item): item is TextContent => item.type === "text")
        .map((item) => item.text)
        .join("\n");
      if (text.trim()) out.push(`[Assistant]\n${text}`);
      continue;
    }

    const text = msg.content.map(contentText).join("\n");
    if (text.trim()) out.push(`[Tool result: ${msg.toolName}]\n${text}`);
  }

  return out.join("\n\n");
}

function parseAgentModels(text: string) {
  const line =
    /^([a-zA-Z0-9][a-zA-Z0-9._-]*)\s+-\s+(.+?)(?:\s+\((?:current|default|current,\s*default)\))?$/;
  const out: Def[] = [];

  for (const raw of clean(text).split("\n")) {
    const row = raw.trim();
    if (!row || row.startsWith("Available") || row.startsWith("Tip:")) continue;
    const hit = line.exec(row);
    if (!hit) continue;

    const rawId = hit[1]?.trim() ?? "";
    const rawName = hit[2]?.trim() ?? rawId;
    if (!rawId) continue;

    const id = toCanonical(rawId);
    if (id == null) continue;
    if (out.some((item) => item.id === id)) continue;

    const base = fallback.get(rawId) ?? fallback.get(id);
    out.push({
      id,
      name: rawName,
      reasoning: base?.reasoning ?? /(-thinking|-high|-xhigh|-max)$/.test(rawId),
      contextWindow: base?.contextWindow ?? 200000,
      maxTokens: base?.maxTokens ?? 32768,
    });
  }

  return out.map(make);
}

function runAgentModels(apiKey?: string | null) {
  return new Promise<ProviderModel[]>((ok, bad) => {
    const args = ["models"];
    const key = typeof apiKey === "string" ? apiKey.trim() : "";
    if (key) args.unshift("--api-key", key);

    let out = "";
    let err = "";
    const child = spawn(CLI, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    child.stdout?.on("data", (chunk: Buffer) => {
      out += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      err += chunk.toString();
    });
    child.on("error", bad);
    child.on("close", (code) => {
      if (code !== 0) {
        bad(new Error(clean(err) || `agent models exited with code ${code}`));
        return;
      }

      const items = parseAgentModels(out);
      if (!items.length) {
        bad(new Error("agent models returned no models"));
        return;
      }
      ok(items);
    });
  });
}

function extractLoginUrl(text: string) {
  const start = text.indexOf(LOGIN);
  if (start === -1) return undefined;

  const tail = text.slice(start);
  const end = tail.search(/\n\s*\n/);
  const url = end === -1 ? tail : tail.slice(0, end);
  return url.replace(/\s+/g, "");
}

function loginError(text: string, code: number | null) {
  const out = clean(text);
  if (out) return out;
  return `agent login exited with code ${code}`;
}

export async function loginCursor(cb: OAuthLoginCallbacks): Promise<OAuthCredentials> {
  cb.onProgress?.("Starting Cursor CLI login...");

  return new Promise((ok, bad) => {
    let out = "";
    let shown = false;
    const child = spawn(CLI, ["login"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NO_OPEN_BROWSER: "1" },
    });

    const stop = () => {
      child.kill("SIGTERM");
      bad(new Error("Cursor login aborted"));
    };

    cb.signal?.addEventListener("abort", stop, { once: true });

    const done = () => {
      cb.signal?.removeEventListener("abort", stop);
    };

    const read = (chunk: Buffer) => {
      out += chunk.toString();
      if (shown) return;

      const url = extractLoginUrl(clean(out));
      if (!url) return;
      shown = true;
      cb.onAuth({
        url,
        instructions:
          "Complete the Cursor login in your browser. Pi will wait for the Cursor CLI to finish.",
      });
      cb.onProgress?.("Waiting for Cursor CLI authentication...");
    };

    child.stdout?.on("data", read);
    child.stderr?.on("data", read);
    child.on("error", (err) => {
      done();
      bad(err);
    });
    child.on("close", (code) => {
      done();
      if (code === 0) {
        ok({
          access: "cursor-cli-session",
          refresh: "cursor-cli-session",
          expires: NEVER,
          mode: "cli",
        });
        return;
      }
      bad(new Error(loginError(out, code)));
    });
  });
}

export async function refreshCursor(credentials: OAuthCredentials): Promise<OAuthCredentials> {
  return {
    ...credentials,
    expires: NEVER,
  };
}

function zero(model: Model<Api>): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: usage(),
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

function applyUsage(
  out: AssistantMessage,
  input?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  },
) {
  out.usage.input = input?.inputTokens ?? 0;
  out.usage.output = input?.outputTokens ?? 0;
  out.usage.cacheRead = input?.cacheReadTokens ?? 0;
  out.usage.cacheWrite = input?.cacheWriteTokens ?? 0;
  out.usage.totalTokens =
    out.usage.input + out.usage.output + out.usage.cacheRead + out.usage.cacheWrite;
}

type CursorEvent =
  | {
      type: "assistant";
      message: { role: "assistant"; content: Array<{ type: "text"; text: string }> };
    }
  | { type: "thinking"; subtype: "delta" | "completed"; text?: string }
  | {
      type: "tool_call";
      subtype: "started" | "completed";
      tool_call: Record<string, { args?: Record<string, unknown> }>;
    }
  | {
      type: "result";
      subtype: string;
      is_error?: boolean;
      request_id?: string;
      result?: string;
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
        cacheReadTokens?: number;
        cacheWriteTokens?: number;
      };
    };

function parseLine(line: string): CursorEvent | null {
  const text = line.trim();
  if (!text) return null;

  try {
    const event = JSON.parse(text) as { type?: string };
    if (event.type === "assistant") return event as CursorEvent;
    if (event.type === "thinking") return event as CursorEvent;
    if (event.type === "tool_call") return event as CursorEvent;
    if (event.type === "result") return event as CursorEvent;
    return null;
  } catch {
    return null;
  }
}

const toolName: Record<string, string> = {
  deleteToolCall: "Delete",
  editToolCall: "Edit",
  findToolCall: "Find",
  globToolCall: "Glob",
  grepToolCall: "Grep",
  lsToolCall: "Ls",
  readToolCall: "Read",
  shellToolCall: "Shell",
  todoToolCall: "Todo",
  updateTodosToolCall: "UpdateTodos",
  webFetchToolCall: "WebFetch",
  webSearchToolCall: "WebSearch",
  writeToolCall: "Write",
};

function showTool(id: string) {
  const hit = toolName[id];
  if (hit) return hit;
  return id.replace(/ToolCall$/, "");
}

export function streamCursor(
  model: Model<Api>,
  ctx: Context,
  opts?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();

  void (async () => {
    let txt = -1;
    let think = -1;
    let block = "";
    let memo = "";
    let result:
      | {
          is_error?: boolean;
          request_id?: string;
          result?: string;
          usage?: {
            inputTokens?: number;
            outputTokens?: number;
            cacheReadTokens?: number;
            cacheWriteTokens?: number;
          };
        }
      | undefined;

    const out = zero(model);

    try {
      const key =
        typeof opts?.apiKey === "string" && opts.apiKey.trim()
          ? opts.apiKey.trim()
          : (process.env["CURSOR_API_KEY"]?.trim() ?? "");
      const args = [
        "--print",
        "--output-format",
        "stream-json",
        "--model",
        toCursor(model.id, opts?.reasoning),
        "--trust",
        "--workspace",
        resolveCwd(opts),
        serialize(ctx),
      ];

      if (key) args.unshift("--api-key", key);

      stream.push({ type: "start", partial: out });

      const child = spawn(CLI, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });

      const stop = () => {
        child.kill("SIGTERM");
      };
      opts?.signal?.addEventListener("abort", stop, { once: true });

      const errs: string[] = [];
      child.stderr?.on("data", (chunk: Buffer) => {
        errs.push(chunk.toString());
      });

      const rl = createInterface({ input: child.stdout!, crlfDelay: Infinity });
      rl.on("line", (line) => {
        const event = parseLine(line);
        if (!event) return;

        if (event.type === "assistant") {
          for (const part of event.message.content) {
            if (part.type !== "text" || !part.text.trim()) continue;
            if (txt === -1) {
              out.content.push({ type: "text", text: "" });
              txt = out.content.length - 1;
              block = "";
              stream.push({ type: "text_start", contentIndex: txt, partial: out });
            }
            const item = out.content[txt];
            if (item?.type !== "text") continue;
            item.text += part.text;
            block += part.text;
            stream.push({ type: "text_delta", contentIndex: txt, delta: part.text, partial: out });
          }
          return;
        }

        if (event.type === "thinking") {
          if (event.subtype === "delta" && event.text) {
            if (think === -1) {
              out.content.push({ type: "thinking", thinking: "" });
              think = out.content.length - 1;
              memo = "";
              stream.push({ type: "thinking_start", contentIndex: think, partial: out });
            }
            const item = out.content[think];
            if (item?.type !== "thinking") return;
            item.thinking += event.text;
            memo += event.text;
            stream.push({
              type: "thinking_delta",
              contentIndex: think,
              delta: event.text,
              partial: out,
            });
          }
          if (event.subtype === "completed" && think !== -1) {
            stream.push({ type: "thinking_end", contentIndex: think, content: memo, partial: out });
            think = -1;
            memo = "";
          }
          return;
        }

        if (event.type === "tool_call" && event.subtype === "started") {
          const key = Object.keys(event.tool_call)[0];
          if (!key) return;
          const args = JSON.stringify(event.tool_call[key]?.args ?? {});
          const note = `\n[Cursor ${showTool(key)}] ${args.length > 120 ? `${args.slice(0, 120)}...` : args}\n`;
          if (txt === -1) {
            out.content.push({ type: "text", text: "" });
            txt = out.content.length - 1;
            block = "";
            stream.push({ type: "text_start", contentIndex: txt, partial: out });
          }
          const item = out.content[txt];
          if (item?.type !== "text") return;
          item.text += note;
          block += note;
          stream.push({ type: "text_delta", contentIndex: txt, delta: note, partial: out });
          return;
        }

        if (event.type !== "result") return;
        result = event;
        if (event.request_id) out.responseId = event.request_id;
        applyUsage(out, event.usage);
      });

      await new Promise<void>((ok) => {
        child.on("close", (code) => {
          opts?.signal?.removeEventListener("abort", stop);

          if (think !== -1) {
            stream.push({ type: "thinking_end", contentIndex: think, content: memo, partial: out });
            think = -1;
            memo = "";
          }

          if (txt !== -1) {
            stream.push({ type: "text_end", contentIndex: txt, content: block, partial: out });
            txt = -1;
            block = "";
          }

          if (!out.content.length && result?.result?.trim()) {
            out.content.push({ type: "text", text: result.result.trim() });
          }

          if (opts?.signal?.aborted) {
            out.stopReason = "aborted";
            out.errorMessage = "Cursor request aborted";
            stream.push({ type: "error", reason: "aborted", error: out });
            stream.end();
            ok();
            return;
          }

          if (result?.is_error) {
            out.stopReason = "error";
            out.errorMessage =
              clean(result.result ?? errs.join("\n")) || "Cursor CLI returned an error";
            stream.push({ type: "error", reason: "error", error: out });
            stream.end();
            ok();
            return;
          }

          if (code !== 0 && !out.content.length) {
            out.stopReason = "error";
            out.errorMessage = clean(errs.join("\n")) || `Cursor CLI exited with code ${code}`;
            stream.push({ type: "error", reason: "error", error: out });
            stream.end();
            ok();
            return;
          }

          stream.push({ type: "done", reason: "stop", message: out });
          stream.end();
          ok();
        });

        child.on("error", (err) => {
          opts?.signal?.removeEventListener("abort", stop);
          out.stopReason = "error";
          out.errorMessage = err.message;
          stream.push({ type: "error", reason: "error", error: out });
          stream.end();
          ok();
        });
      });
    } catch (err) {
      out.stopReason = opts?.signal?.aborted ? "aborted" : "error";
      out.errorMessage = err instanceof Error ? err.message : String(err);
      stream.push({ type: "error", reason: out.stopReason, error: out });
      stream.end();
    }
  })();

  return stream;
}

export async function listCursorModels(apiKey?: string | null) {
  try {
    return await runAgentModels(apiKey);
  } catch {
    return FALLBACK.map(make);
  }
}

export function createCursorProvider(items?: ProviderModel[]): ProviderInput {
  return {
    baseUrl: "cli://cursor-agent",
    api: API,
    models:
      items?.map((item) => ({
        id: item.id,
        name: item.name,
        reasoning: item.reasoning,
        input: item.input,
        cost: item.cost,
        contextWindow: item.contextWindow,
        maxTokens: item.maxTokens,
      })) ?? FALLBACK.map(make),
    oauth: {
      name: "Cursor",
      login: loginCursor,
      refreshToken: refreshCursor,
      getApiKey: () => "",
    },
    streamSimple: streamCursor,
  };
}

export function registerCursorProvider(reg: ModelRegistry, items?: ProviderModel[]) {
  reg.registerProvider(CURSOR, createCursorProvider(items));
}

export async function syncCursorProvider(reg: ModelRegistry, apiKey?: string | null) {
  registerCursorProvider(reg, await listCursorModels(apiKey));
}

export function setCursorSessionCwd(id: string, cwd: string) {
  dirs.set(id, cwd);
}

export function clearCursorSessionCwd(id: string) {
  dirs.delete(id);
}

export const cursorExtension: ExtensionFactory = function (pi: ExtensionAPI) {
  pi.registerProvider(CURSOR, createCursorProvider());
};
