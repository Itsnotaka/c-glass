import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { PiConfig, PiModel, PiThinkingLevel } from "@glass/contracts";
import {
  AuthStorage,
  ModelRegistry,
  SettingsManager,
  getAgentDir,
} from "@mariozechner/pi-coding-agent";

function expand(path: string): string {
  if (path === "~") return homedir();
  if (path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

function trim(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function dir(home: string): string {
  const root = trim(home);
  if (!root) {
    return getAgentDir();
  }
  return join(expand(root), "agent");
}

function paths(cwd: string, home: string) {
  const agent = dir(home);
  return {
    agent,
    settings: join(agent, "settings.json"),
    project: join(cwd, ".pi", "settings.json"),
    models: join(agent, "models.json"),
    auth: join(agent, "auth.json"),
  };
}

function load(cwd: string, home: string) {
  const path = paths(cwd, home);
  const auth = AuthStorage.create(path.auth);
  const mgr = SettingsManager.create(cwd, path.agent);
  const reg = ModelRegistry.create(auth, path.models);
  return { path, auth, mgr, reg };
}

function level(value: PiThinkingLevel | undefined): PiThinkingLevel | null {
  return value ?? null;
}

function key(provider: string, model: string): string {
  return `${provider}/${model}`;
}

function map(model: ModelRegistry["getAll"] extends () => Array<infer T> ? T : never): PiModel {
  return {
    provider: model.provider,
    id: model.id,
    name: model.name ?? model.id,
    api: String(model.api ?? ""),
    baseUrl: model.baseUrl ?? "",
    reasoning: Boolean(model.reasoning),
    input: model.input ?? ["text"],
    cost: model.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: model.contextWindow ?? 0,
    maxTokens: model.maxTokens ?? 0,
    ...(model.compat !== undefined ? { compat: model.compat } : {}),
  };
}

function errs(input: {
  mgr: SettingsManager;
  auth: AuthStorage;
  reg: ModelRegistry;
}): string | null {
  const out = [
    ...input.mgr.drainErrors().map((err) => `${err.scope} settings: ${err.error.message}`),
    ...input.auth.drainErrors().map((err) => `auth: ${err.message}`),
    input.reg.getError(),
  ].filter((err): err is string => Boolean(err));

  return out.length > 0 ? out.join("\n\n") : null;
}

function raw(path: string): Record<string, unknown> {
  if (!existsSync(path)) {
    return {};
  }
  const text = readFileSync(path, "utf-8").trim();
  if (!text) {
    return {};
  }
  return JSON.parse(text) as Record<string, unknown>;
}

function save(path: string, data: unknown, mode?: number) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  if (mode !== undefined) {
    chmodSync(path, mode);
  }
}

function flush(mgr: SettingsManager) {
  return mgr.flush().then(() => {
    const errs = mgr.drainErrors();
    if (errs[0]) {
      throw errs[0].error;
    }
  });
}

export function readPi(cwd: string, home: string): PiConfig {
  const { path, auth, mgr, reg } = load(cwd, home);
  const models = reg.getAll().map(map);
  const available = reg.getAvailable().map((model) => key(model.provider, model.id));

  return {
    agentDir: path.agent,
    settingsPath: path.settings,
    projectSettingsPath: path.project,
    modelsPath: path.models,
    authPath: path.auth,
    defaults: {
      provider: mgr.getDefaultProvider() ?? null,
      model: mgr.getDefaultModel() ?? null,
      thinkingLevel: level(mgr.getDefaultThinkingLevel()),
    },
    models,
    available,
    error: errs({ mgr, auth, reg }),
  };
}

export async function setPiModel(cwd: string, home: string, provider: string, model: string) {
  const { mgr } = load(cwd, home);
  mgr.setDefaultModelAndProvider(provider, model);
  await flush(mgr);
}

export function clearPiModel(cwd: string, home: string) {
  const path = paths(cwd, home);
  const data = raw(path.settings);
  delete data.defaultProvider;
  delete data.defaultModel;
  save(path.settings, data);
}

export async function setPiThinking(cwd: string, home: string, value: PiThinkingLevel) {
  const { mgr } = load(cwd, home);
  mgr.setDefaultThinkingLevel(value);
  await flush(mgr);
}

export async function getPiKey(
  cwd: string,
  home: string,
  provider: string,
): Promise<string | null> {
  const { auth, reg } = load(cwd, home);
  const value = await reg.getApiKeyForProvider(provider);
  const err = auth.drainErrors()[0];
  if (err) {
    throw err;
  }
  return value ?? null;
}

export function setPiKey(cwd: string, home: string, provider: string, key: string) {
  const { auth } = load(cwd, home);
  auth.set(provider, { type: "api_key", key });
  const err = auth.drainErrors()[0];
  if (err) {
    throw err;
  }
}
