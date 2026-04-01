import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as Path from "node:path";

import * as Effect from "effect/Effect";
import type { PiConfig, PiThinkingLevel } from "@glass/contracts";
import {
  AuthStorage,
  ModelRegistry,
  SettingsManager,
  getAgentDir,
} from "@mariozechner/pi-coding-agent";

function trim(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function raw(file: string) {
  if (!existsSync(file)) return {};
  const text = readFileSync(file, "utf8").trim();
  if (!text) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

function save(file: string, data: unknown, mode?: number) {
  mkdirSync(Path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  if (mode !== undefined) chmodSync(file, mode);
}

const LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

function level(value: string | undefined): PiThinkingLevel | null {
  if (!value) return null;
  return LEVELS.includes(value as PiThinkingLevel) ? (value as PiThinkingLevel) : null;
}

function key(provider: string, model: string) {
  return `${provider}/${model}`;
}

function modelDto(model: ReturnType<ModelRegistry["getAll"]>[number]) {
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

export class PiConfigService {
  auth = AuthStorage.create(Path.join(getAgentDir(), "auth.json"));
  reg = ModelRegistry.create(this.auth, Path.join(getAgentDir(), "models.json"));

  settings(cwd: string) {
    return SettingsManager.create(cwd, getAgentDir());
  }

  paths(cwd: string) {
    const agent = getAgentDir();
    return {
      agent,
      settings: Path.join(agent, "settings.json"),
      project: Path.join(cwd, ".pi", "settings.json"),
      models: Path.join(agent, "models.json"),
      auth: Path.join(agent, "auth.json"),
    };
  }

  errs(cwd: string) {
    const mgr = this.settings(cwd);
    const out = [
      ...mgr.drainErrors().map((err) => `${err.scope} settings: ${err.error.message}`),
      ...this.auth.drainErrors().map((err) => `auth: ${err.message}`),
      this.reg.getError(),
    ].filter(Boolean);
    return out.length > 0 ? out.join("\n\n") : null;
  }

  flush(mgr: SettingsManager) {
    return Effect.tryPromise({
      try: async () => {
        await mgr.flush();
        const err = mgr.drainErrors()[0];
        if (err) throw err.error;
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  getConfig(cwd: string): Effect.Effect<PiConfig> {
    return Effect.sync(() => {
      this.reg.refresh();
      const path = this.paths(cwd);
      const mgr = this.settings(cwd);
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
        models: this.reg.getAll().map((model) => modelDto(model)),
        available: this.reg.getAvailable().map((model) => key(model.provider, model.id)),
        error: this.errs(cwd),
      };
    });
  }

  setDefaultModel(cwd: string, provider: string, model: string) {
    const mgr = this.settings(cwd);
    mgr.setDefaultModelAndProvider(provider, model);
    return this.flush(mgr);
  }

  clearDefaultModel(cwd: string) {
    return Effect.sync(() => {
      const path = this.paths(cwd);
      const data = raw(path.settings);
      delete data.defaultProvider;
      delete data.defaultModel;
      save(path.settings, data);
    });
  }

  setDefaultThinkingLevel(cwd: string, value: string) {
    const mgr = this.settings(cwd);
    const next = trim(value);
    if (!next) return Effect.fail(new Error("Missing thinking level"));
    mgr.setDefaultThinkingLevel(next as Parameters<typeof mgr.setDefaultThinkingLevel>[0]);
    return this.flush(mgr);
  }

  getApiKey(provider: string) {
    return Effect.tryPromise({
      try: async () => {
        const value = await this.reg.getApiKeyForProvider(provider);
        const err = this.auth.drainErrors()[0];
        if (err) throw err;
        return value ?? null;
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  setApiKey(provider: string, key: string) {
    return Effect.sync(() => {
      this.auth.set(provider, { type: "api_key", key });
      const err = this.auth.drainErrors()[0];
      if (err) throw err;
    });
  }
}
