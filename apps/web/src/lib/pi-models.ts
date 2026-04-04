import type { PiConfig, PiModelRef, PiProviderState, PiThinkingLevel } from "@glass/contracts";
import { getGlass } from "../host";

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
  ["cursor", "gpt-5.1-codex"],
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
  supportsXhigh: boolean;
}

export interface PiDefaultsRead {
  provider: string | null;
  model: string | null;
  thinkingLevel: PiThinkingLevel | null;
}

export interface PiProviderItem extends PiProviderState {}

function key(provider: string, id: string) {
  return `${provider}/${id}`;
}

/** Strips a redundant leading "Model " from Pi display names (config often includes it). */
export function displayModelName(raw: string) {
  const t = raw.trim();
  if (!t) return raw;
  const n = t.replace(/^model\s+/i, "").trim();
  return n.length ? n : t;
}

function item(model: PiConfig["models"][number]) {
  return {
    key: key(model.provider, model.id),
    provider: model.provider,
    id: model.id,
    name: model.name || model.id,
    reasoning: model.reasoning,
    supportsXhigh: model.supportsXhigh,
  };
}

function same(left: PiModelRef | null | undefined, right: PiModelRef | null | undefined) {
  if (!left || !right) return false;
  return left.provider === right.provider && left.id === right.id;
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

export function readPiDefaultsFromConfig(data: PiConfig): PiDefaultsRead {
  return {
    provider: data.defaults.provider,
    model: data.defaults.model,
    thinkingLevel: data.defaults.thinkingLevel,
  };
}

export async function readPiDefaults() {
  const data = await getGlass().pi.getConfig();
  return readPiDefaultsFromConfig(data);
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

export function listPiModelsFromConfig(data: PiConfig, cur?: PiModelRef | null) {
  const all = data.models.map((m) => item(m));
  const available = new Set(data.available);
  const next = all.filter((row) => available.has(row.key) || same(cur, row));
  if (next.length > 0) return next;
  return all;
}

export function resolvePiDefaultModelFromConfig(data: PiConfig, cur?: PiModelRef | null) {
  const items = data.models.map((m) => item(m));
  const available = new Set(data.available);

  if (data.defaults.provider && data.defaults.model) {
    const hit = items.find(
      (row) => row.provider === data.defaults.provider && row.id === data.defaults.model,
    );
    if (hit) return hit;
  }

  const pref = PREFERRED.flatMap(([provider, id]) => {
    const hit = items.find(
      (row) => available.has(row.key) && row.provider === provider && row.id === id,
    );
    return hit ? [hit] : [];
  });
  if (pref[0]) return pref[0];

  const vis = listPiModelsFromConfig(data, cur);
  if (vis[0]) return vis[0];
  return cur ?? items[0] ?? null;
}

export function resolvePiDefaultThinkingLevelFromConfig(data: PiConfig): PiThinkingLevel {
  return data.defaults.thinkingLevel ?? "off";
}

export async function listPiModels(cur?: PiModelRef | null) {
  const data = await getGlass().pi.getConfig();
  return listPiModelsFromConfig(data, cur);
}

export async function resolvePiDefaultModel(cur?: PiModelRef | null) {
  const data = await getGlass().pi.getConfig();
  return resolvePiDefaultModelFromConfig(data, cur);
}

export async function resolvePiDefaultThinkingLevel() {
  const data = await getGlass().pi.getConfig();
  return resolvePiDefaultThinkingLevelFromConfig(data);
}

export async function writePiDefaultModel(model: PiModelRef) {
  await getGlass().pi.setDefaultModel(model.provider, model.id);
}

export async function clearPiDefaultModel() {
  await getGlass().pi.clearDefaultModel();
}

export async function writePiDefaultThinkingLevel(level: PiThinkingLevel) {
  await getGlass().pi.setDefaultThinkingLevel(level);
}

export const readPiApiKey = async (provider: string) => getGlass().pi.getApiKey(provider);

export async function writePiApiKey(provider: string, key: string) {
  await getGlass().pi.setApiKey(provider, key);
}

export async function startPiOAuthLogin(provider: string) {
  await getGlass().pi.startOAuthLogin(provider);
}

export function hasStoredPiDefault(defs: PiDefaultsRead) {
  return defs.provider !== null && defs.model !== null;
}
