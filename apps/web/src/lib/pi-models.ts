import type { PiConfig } from "@glass/contracts";
import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import { modelsAreEqual, type Api, type Model } from "@mariozechner/pi-ai";
import { ensureNativeApi } from "../nativeApi";
import { PI_GLASS_SETTINGS_CHANGED_EVENT } from "./pi-glass-constants";

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

type PiModel = PiConfig["models"][number];

export type PiModelItem = {
  key: string;
  provider: string;
  id: string;
  name: string;
  model: Model<Api>;
};

export type PiDefaults = {
  provider: string | null;
  model: string | null;
  thinkingLevel: ThinkingLevel | null;
};

function key(provider: string, id: string): string {
  return `${provider}/${id}`;
}

function toModel(model: PiModel): Model<Api> {
  return model as unknown as Model<Api>;
}

function item(model: PiModel): PiModelItem {
  return {
    key: key(model.provider, model.id),
    provider: model.provider,
    id: model.id,
    name: model.name || model.id,
    model: toModel(model),
  };
}

function sort(items: ReadonlyArray<PiModelItem>, cur?: Model<Api> | null): PiModelItem[] {
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

function push(map: Map<string, PiModelItem>, model: PiModel | Model<Api>) {
  const it = {
    key: key(model.provider, model.id),
    provider: model.provider,
    id: model.id,
    name: model.name ?? model.id,
    model: model as Model<Api>,
  } satisfies PiModelItem;
  if (map.has(it.key)) return;
  map.set(it.key, it);
}

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PI_GLASS_SETTINGS_CHANGED_EVENT));
}

async function cfg() {
  return ensureNativeApi().server.getPiConfig();
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

export async function readPiDefaults(): Promise<PiDefaults> {
  const data = await cfg();
  return {
    provider: data.defaults.provider,
    model: data.defaults.model,
    thinkingLevel: data.defaults.thinkingLevel,
  };
}

export async function listPiModels(cur?: Model<Api> | null): Promise<PiModelItem[]> {
  const data = await cfg();
  const map = new Map<string, PiModelItem>();

  for (const model of data.models) {
    push(map, model);
  }

  if (cur) {
    push(map, cur);
  }

  const all = [...map.values()];
  const available = new Set(data.available);
  const next = all.filter(
    (item) => available.has(item.key) || item.key === key(cur?.provider ?? "", cur?.id ?? ""),
  );

  if (next.length > 0) {
    return sort(next, cur);
  }

  return sort(all, cur);
}

export async function resolvePiDefaultModel(cur?: Model<Api> | null): Promise<Model<Api> | null> {
  const data = await cfg();
  const items = data.models.map(item);
  const available = new Set(data.available);

  if (data.defaults.provider && data.defaults.model) {
    const hit = items.find(
      (item) => item.provider === data.defaults.provider && item.id === data.defaults.model,
    );
    if (hit) {
      return hit.model;
    }
  }

  const pref = sort(
    items.filter((item) => {
      if (!available.has(item.key)) {
        return false;
      }
      return PREFERRED.some((pair) => item.provider === pair[0] && item.id === pair[1]);
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

  return cur ? (cur as Model<Api>) : (items[0]?.model ?? null);
}

export async function resolvePiDefaultThinkingLevel(): Promise<ThinkingLevel> {
  const defs = await readPiDefaults();
  return defs.thinkingLevel ?? "off";
}

export async function writePiDefaultModel(model: Model<Api>): Promise<void> {
  await ensureNativeApi().server.setPiDefaultModel(model.provider, model.id);
  emit();
}

export async function clearPiDefaultModel(): Promise<void> {
  await ensureNativeApi().server.clearPiDefaultModel();
  emit();
}

export async function writePiDefaultThinkingLevel(level: ThinkingLevel): Promise<void> {
  await ensureNativeApi().server.setPiDefaultThinkingLevel(level);
  emit();
}

export async function readPiApiKey(provider: string): Promise<string | null> {
  return ensureNativeApi().server.getPiApiKey(provider);
}

export async function writePiApiKey(provider: string, key: string): Promise<void> {
  await ensureNativeApi().server.setPiApiKey(provider, key);
  emit();
}

export function hasStoredPiDefault(defs: PiDefaults): boolean {
  return defs.provider !== null && defs.model !== null;
}
