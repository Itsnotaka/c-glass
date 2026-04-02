import type { PiConfig, PiModelRef, PiProviderState, PiThinkingLevel } from "@glass/contracts";
import { getGlass } from "../host";
import { PI_GLASS_SETTINGS_CHANGED_EVENT } from "./pi-glass-constants";

const PREFERRED = [
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
] as const;

export interface PiModelItem extends PiModelRef {
  key: string;
  name: string;
}

interface PiDefaults {
  provider: string | null;
  model: string | null;
  thinkingLevel: PiThinkingLevel | null;
}

export interface PiProviderItem extends PiProviderState {}

function key(provider: string, id: string) {
  return `${provider}/${id}`;
}

function item(model: PiConfig["models"][number]) {
  return {
    key: key(model.provider, model.id),
    provider: model.provider,
    id: model.id,
    name: model.name || model.id,
    reasoning: model.reasoning,
  };
}

function same(left: PiModelRef | null | undefined, right: PiModelRef | null | undefined) {
  if (!left || !right) return false;
  return left.provider === right.provider && left.id === right.id;
}

function sort(items: readonly PiModelItem[], cur?: PiModelRef | null) {
  const out = [...items];
  out.sort((left, right) => {
    const a = same(cur, left);
    const b = same(cur, right);
    if (a && !b) return -1;
    if (!a && b) return 1;
    const byProvider = left.provider.localeCompare(right.provider);
    if (byProvider !== 0) return byProvider;
    return left.id.localeCompare(right.id);
  });
  return out;
}

function emit() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PI_GLASS_SETTINGS_CHANGED_EVENT));
}

function fuzzyMatch(query: string, text: string) {
  const a = query.toLowerCase();
  const b = text.toLowerCase();

  const match = (cur: string) => {
    if (!cur.length) return { matches: true, score: 0 };
    if (cur.length > b.length) return { matches: false, score: 0 };

    let qi = 0;
    let score = 0;
    let last = -1;
    let run = 0;

    for (let i = 0; i < b.length && qi < cur.length; i++) {
      if (b[i] !== cur[qi]) continue;
      const edge = i === 0 || /[\s\-_./:]/.test(b[i - 1] ?? "");
      if (last === i - 1) {
        run++;
        score -= run * 5;
      }
      if (last !== i - 1) {
        run = 0;
        if (last >= 0) score += (i - last - 1) * 2;
      }
      if (edge) score -= 10;
      score += i * 0.1;
      last = i;
      qi++;
    }

    if (qi < cur.length) return { matches: false, score: 0 };
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

export function filterPiModels(items: readonly PiModelItem[], query: string) {
  const input = query.trim();
  if (!input) return [...items];

  const tokens = input
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!tokens.length) return [...items];

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

    if (ok) out.push({ item, score });
  }

  out.sort((left, right) => left.score - right.score);
  return out.map((item) => item.item);
}

export async function readPiDefaults() {
  const data = await getGlass().pi.getConfig();
  return {
    provider: data.defaults.provider,
    model: data.defaults.model,
    thinkingLevel: data.defaults.thinkingLevel,
  } satisfies PiDefaults;
}

export async function listPiProviders() {
  const data = await getGlass().pi.getConfig();
  return [...data.providers].toSorted((left, right) => left.provider.localeCompare(right.provider));
}

export async function readPiProvider(provider: string) {
  const data = await getGlass().pi.getConfig();
  return (data.providers.find((item) => item.provider === provider) ?? {
    provider,
    configured: false,
    credentialType: null,
    oauthSupported: false,
  }) satisfies PiProviderItem;
}

export async function listPiModels(cur?: PiModelRef | null) {
  const data = await getGlass().pi.getConfig();
  const all = data.models.map((model) => item(model));
  const available = new Set(data.available);
  const next = all.filter((item) => available.has(item.key) || same(cur, item));
  if (next.length > 0) return sort(next, cur);
  return sort(all, cur);
}

export async function resolvePiDefaultModel(cur?: PiModelRef | null) {
  const data = await getGlass().pi.getConfig();
  const items = data.models.map((model) => item(model));
  const available = new Set(data.available);

  if (data.defaults.provider && data.defaults.model) {
    const hit = items.find(
      (item) => item.provider === data.defaults.provider && item.id === data.defaults.model,
    );
    if (hit) return hit;
  }

  const pref = sort(
    items.filter((item) => {
      if (!available.has(item.key)) return false;
      return PREFERRED.some((pair) => item.provider === pair[0] && item.id === pair[1]);
    }),
    cur,
  );
  if (pref[0]) return pref[0];

  const vis = await listPiModels(cur);
  if (vis[0]) return vis[0];
  return cur ?? items[0] ?? null;
}

export async function resolvePiDefaultThinkingLevel() {
  const defs = await readPiDefaults();
  return defs.thinkingLevel ?? "off";
}

export async function writePiDefaultModel(model: PiModelRef) {
  await getGlass().pi.setDefaultModel(model.provider, model.id);
  emit();
}

export async function clearPiDefaultModel() {
  await getGlass().pi.clearDefaultModel();
  emit();
}

export async function writePiDefaultThinkingLevel(level: PiThinkingLevel) {
  await getGlass().pi.setDefaultThinkingLevel(level);
  emit();
}

export const readPiApiKey = async (provider: string) => getGlass().pi.getApiKey(provider);

export async function writePiApiKey(provider: string, key: string) {
  await getGlass().pi.setApiKey(provider, key);
  emit();
}

export function hasStoredPiDefault(defs: PiDefaults) {
  return defs.provider !== null && defs.model !== null;
}
