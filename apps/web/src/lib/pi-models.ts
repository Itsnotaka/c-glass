import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import { getModels, getProviders, modelsAreEqual, type Model } from "@mariozechner/pi-ai";
import type { AppStorage } from "@mariozechner/pi-web-ui";
import { ensurePiGlassStorage } from "./pi-glass-storage";
import { PI_GLASS_SETTINGS_CHANGED_EVENT } from "./pi-glass-constants";

const DEFAULT_PROVIDER_KEY = "defaultProvider";
const DEFAULT_MODEL_KEY = "defaultModel";
const DEFAULT_THINKING_LEVEL_KEY = "defaultThinkingLevel";

const PREFERRED: ReadonlyArray<readonly [string, string]> = [
  ["amazon-bedrock", "us.anthropic.claude-opus-4-6-v1"],
  ["anthropic", "claude-opus-4-6"],
  ["openai", "gpt-5.4"],
  ["azure-openai-responses", "gpt-5.2"],
  ["openai-codex", "gpt-5.4"],
  ["google", "gemini-2.5-pro"],
  ["google-gemini-cli", "gemini-2.5-pro"],
  ["google-antigravity", "gemini-3.1-pro-high"],
  ["google-vertex", "gemini-3-pro-preview"],
  ["github-copilot", "gpt-4o"],
  ["openrouter", "openai/gpt-5.1-codex"],
  ["vercel-ai-gateway", "anthropic/claude-opus-4-6"],
  ["xai", "grok-4-fast-non-reasoning"],
  ["groq", "openai/gpt-oss-120b"],
  ["cerebras", "zai-glm-4.7"],
  ["zai", "glm-5"],
  ["mistral", "devstral-medium-latest"],
  ["minimax", "MiniMax-M2.7"],
  ["minimax-cn", "MiniMax-M2.7"],
  ["huggingface", "moonshotai/Kimi-K2.5"],
  ["opencode", "claude-opus-4-6"],
  ["opencode-go", "kimi-k2.5"],
  ["kimi-coding", "kimi-k2-thinking"],
];

export type PiModelItem = {
  key: string;
  provider: string;
  id: string;
  name: string;
  model: Model<any>;
};

export type PiDefaults = {
  provider: string | null;
  model: string | null;
  thinkingLevel: ThinkingLevel | null;
};

function trim(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

function isThinkingLevel(v: unknown): v is ThinkingLevel {
  return (
    v === "off" || v === "minimal" || v === "low" || v === "medium" || v === "high" || v === "xhigh"
  );
}

function key(provider: string, id: string): string {
  return `${provider}/${id}`;
}

function item(model: Model<any>): PiModelItem {
  return {
    key: key(model.provider, model.id),
    provider: model.provider,
    id: model.id,
    name: model.name ?? model.id,
    model,
  };
}

function sort(items: ReadonlyArray<PiModelItem>, cur?: Model<any> | null): PiModelItem[] {
  const out = [...items];
  out.sort((a, b) => {
    const aCur = modelsAreEqual(cur, a.model);
    const bCur = modelsAreEqual(cur, b.model);
    if (aCur && !bCur) return -1;
    if (!aCur && bCur) return 1;

    const byProvider = a.provider.localeCompare(b.provider);
    if (byProvider !== 0) return byProvider;
    return a.id.localeCompare(b.id);
  });
  return out;
}

function push(map: Map<string, PiModelItem>, model: Model<any>) {
  const it = item(model);
  if (map.has(it.key)) return;
  map.set(it.key, it);
}

async function all(storage: AppStorage, cur?: Model<any> | null): Promise<PiModelItem[]> {
  const map = new Map<string, PiModelItem>();

  for (const provider of getProviders()) {
    for (const model of getModels(provider)) {
      push(map, model);
    }
  }

  for (const provider of await storage.customProviders.getAll()) {
    for (const model of provider.models ?? []) {
      push(map, { ...model, provider: provider.name });
    }
  }

  if (cur) {
    push(map, cur);
  }

  return [...map.values()];
}

function fuzzyMatch(query: string, text: string): { matches: boolean; score: number } {
  const a = query.toLowerCase();
  const b = text.toLowerCase();

  const match = (q: string) => {
    if (q.length === 0) {
      return { matches: true, score: 0 };
    }
    if (q.length > b.length) {
      return { matches: false, score: 0 };
    }

    let qi = 0;
    let score = 0;
    let last = -1;
    let run = 0;

    for (let i = 0; i < b.length && qi < q.length; i++) {
      if (b[i] !== q[qi]) continue;

      const edge = i === 0 || /[\s\-_./:]/.test(b[i - 1] ?? "");
      if (last === i - 1) {
        run++;
        score -= run * 5;
      }
      if (last !== i - 1) {
        run = 0;
        if (last >= 0) {
          score += (i - last - 1) * 2;
        }
      }
      if (edge) {
        score -= 10;
      }
      score += i * 0.1;
      last = i;
      qi++;
    }

    if (qi < q.length) {
      return { matches: false, score: 0 };
    }

    return { matches: true, score };
  };

  const base = match(a);
  if (base.matches) return base;

  const alpha = a.match(/^(?<letters>[a-z]+)(?<digits>[0-9]+)$/);
  const num = a.match(/^(?<digits>[0-9]+)(?<letters>[a-z]+)$/);
  const swap = alpha
    ? `${alpha.groups?.digits ?? ""}${alpha.groups?.letters ?? ""}`
    : num
      ? `${num.groups?.letters ?? ""}${num.groups?.digits ?? ""}`
      : "";

  if (!swap) return base;

  const next = match(swap);
  if (!next.matches) return base;
  return { matches: true, score: next.score + 5 };
}

export function filterPiModels(items: ReadonlyArray<PiModelItem>, query: string): PiModelItem[] {
  const input = query.trim();
  if (!input) return [...items];

  const tokens = input
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) return [...items];

  const out: Array<{ item: PiModelItem; score: number }> = [];

  for (const item of items) {
    const text = `${item.provider} ${item.id} ${item.provider}/${item.id} ${item.name}`;
    let score = 0;
    let ok = true;

    for (const token of tokens) {
      const match = fuzzyMatch(token, text);
      if (!match.matches) {
        ok = false;
        break;
      }
      score += match.score;
    }

    if (ok) {
      out.push({ item, score });
    }
  }

  out.sort((a, b) => a.score - b.score);
  return out.map((item) => item.item);
}

export async function readPiDefaults(storage?: AppStorage): Promise<PiDefaults> {
  const app = storage ?? (await ensurePiGlassStorage());
  const provider = trim(await app.settings.get(DEFAULT_PROVIDER_KEY));
  const model = trim(await app.settings.get(DEFAULT_MODEL_KEY));
  const raw = await app.settings.get(DEFAULT_THINKING_LEVEL_KEY);
  const thinkingLevel = isThinkingLevel(raw) ? raw : null;

  return {
    provider,
    model,
    thinkingLevel,
  };
}

export async function listPiModels(cur?: Model<any> | null): Promise<PiModelItem[]> {
  const storage = await ensurePiGlassStorage();
  const keys = new Set(await storage.providerKeys.list());
  const base = await all(storage, cur);

  if (keys.size === 0) {
    return sort(base, cur);
  }

  const next = base.filter((item) => keys.has(item.provider) || modelsAreEqual(cur, item.model));
  if (next.length === 0) {
    return sort(base, cur);
  }

  return sort(next, cur);
}

export async function resolvePiDefaultModel(cur?: Model<any> | null): Promise<Model<any> | null> {
  const storage = await ensurePiGlassStorage();
  const defs = await readPiDefaults(storage);
  const items = await all(storage, cur);

  if (defs.provider && defs.model) {
    const found = items.find((item) => item.provider === defs.provider && item.id === defs.model);
    if (found) {
      return found.model;
    }
  }

  const pref = sort(
    items.filter((item) => {
      for (const pair of PREFERRED) {
        if (item.provider === pair[0] && item.id === pair[1]) {
          return true;
        }
      }
      return false;
    }),
    cur,
  );
  if (pref[0]) {
    return pref[0].model;
  }

  const vis = await listPiModels(cur);
  if (vis[0]) {
    return vis[0].model;
  }

  return cur ?? items[0]?.model ?? null;
}

export async function resolvePiDefaultThinkingLevel(): Promise<ThinkingLevel> {
  const defs = await readPiDefaults();
  return defs.thinkingLevel ?? "off";
}

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PI_GLASS_SETTINGS_CHANGED_EVENT));
}

export async function writePiDefaultModel(model: Model<any>): Promise<void> {
  const storage = await ensurePiGlassStorage();
  await storage.settings.set(DEFAULT_PROVIDER_KEY, model.provider);
  await storage.settings.set(DEFAULT_MODEL_KEY, model.id);
  emit();
}

export async function clearPiDefaultModel(): Promise<void> {
  const storage = await ensurePiGlassStorage();
  await storage.settings.delete(DEFAULT_PROVIDER_KEY);
  await storage.settings.delete(DEFAULT_MODEL_KEY);
  emit();
}

export async function writePiDefaultThinkingLevel(level: ThinkingLevel): Promise<void> {
  const storage = await ensurePiGlassStorage();
  await storage.settings.set(DEFAULT_THINKING_LEVEL_KEY, level);
  emit();
}

export function hasStoredPiDefault(defs: PiDefaults): boolean {
  return defs.provider !== null && defs.model !== null;
}
