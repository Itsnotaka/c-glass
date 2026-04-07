import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as Path from "node:path";

import * as Effect from "effect/Effect";
import { supportsXhigh } from "@mariozechner/pi-ai";
import type { OAuthLoginCallbacks } from "@mariozechner/pi-ai";
import type { PiConfig, ThinkingLevel } from "@glass/contracts";
import {
  AuthStorage,
  ModelRegistry,
  SettingsManager,
  getAgentDir,
} from "@mariozechner/pi-coding-agent";
import { registerCursorProvider, syncCursorProvider } from "./cursor-provider";
import { loadPi } from "./pi-imports";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type JsonObj = { [k: string]: Json };

function trim(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function raw(file: string) {
  if (!existsSync(file)) return {};
  const text = readFileSync(file, "utf8").trim();
  if (!text) return {};
  const parsed = JSON.parse(text) as Json;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as JsonObj;
}

function save(file: string, data: JsonObj, mode?: number) {
  mkdirSync(Path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  if (mode !== undefined) chmodSync(file, mode);
}

const LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

function level(value: string | undefined): ThinkingLevel | null {
  if (!value) return null;
  return LEVELS.includes(value as ThinkingLevel) ? (value as ThinkingLevel) : null;
}

function key(provider: string, model: string) {
  return `${provider}/${model}`;
}

function errDto(item: { path: string; error: string }) {
  return {
    path: item.path,
    error: item.error,
  };
}

function stem(file: string) {
  const base = Path.basename(file);
  if (base === "index.ts" || base === "index.js") return Path.basename(Path.dirname(file));
  const next = base.replace(/\.(ts|js)$/u, "");
  return next || base;
}

function kind(value: string) {
  if (value === "user") return "user" as const;
  if (value === "project") return "project" as const;
  return "other" as const;
}

function clean(text: string) {
  const next = text.startsWith("./") || text.startsWith(".\\") ? text.slice(2) : text;
  return next.split(Path.sep).join("/");
}

function rel(file: string, root: string) {
  const next = Path.relative(root, file);
  if (!next || next.startsWith("..") || Path.isAbsolute(next)) {
    return file.split(Path.sep).join("/");
  }
  return next.split(Path.sep).join("/");
}

function strip(list: string[], file: string, root: string) {
  const key = clean(rel(file, root));
  const abs = clean(file);
  return list.filter((item) => {
    const cur = item.trim();
    if (!cur.startsWith("+") && !cur.startsWith("-")) return true;
    const next = clean(cur.slice(1));
    return next !== key && next !== abs;
  });
}

function modelDto(model: ReturnType<ModelRegistry["getAll"]>[number]) {
  return {
    provider: model.provider,
    id: model.id,
    name: model.name ?? model.id,
    api: String(model.api ?? ""),
    baseUrl: model.baseUrl ?? "",
    reasoning: Boolean(model.reasoning),
    supportsXhigh: supportsXhigh(model),
    input: model.input ?? ["text"],
    cost: model.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: model.contextWindow ?? 0,
    maxTokens: model.maxTokens ?? 0,
    ...(model.compat !== undefined ? { compat: model.compat } : {}),
  };
}

const core = {
  sendMessage() {},
  sendUserMessage() {},
  appendEntry() {},
  setSessionName() {},
  getSessionName() {
    return undefined;
  },
  setLabel() {},
  getActiveTools() {
    return [];
  },
  getAllTools() {
    return [];
  },
  setActiveTools() {},
  refreshTools() {},
  getCommands() {
    return [];
  },
  setModel() {
    return Promise.resolve(true);
  },
  getThinkingLevel() {
    return "off" as const;
  },
  setThinkingLevel() {},
};

const ctx = {
  getModel() {
    return undefined;
  },
  isIdle() {
    return true;
  },
  getSignal() {
    return undefined;
  },
  abort() {},
  hasPendingMessages() {
    return false;
  },
  getContextUsage() {
    return undefined;
  },
  compact() {},
  getSystemPrompt() {
    return "";
  },
  shutdown() {},
};

function providerDto(input: {
  provider: string;
  configured: boolean;
  credential: ReturnType<AuthStorage["get"]>;
  oauthSupported: boolean;
}) {
  return {
    provider: input.provider,
    configured: input.configured,
    credentialType: input.credential?.type ?? null,
    oauthSupported: input.oauthSupported,
  };
}

export class PiConfigService {
  auth = AuthStorage.create(Path.join(getAgentDir(), "auth.json"));
  reg = ModelRegistry.create(this.auth, Path.join(getAgentDir(), "models.json"));
  runtime = new Set<string>();
  cursor = "";
  cursorp: Promise<void> | null = null;
  initp: Promise<void> | null = null;
  initcwd: string | null = null;
  exts: PiConfig["extensions"] = [];
  xerrs: PiConfig["extensionErrors"] = [];

  constructor() {
    registerCursorProvider(this.reg);
  }

  invalidate() {
    this.initp = null;
    this.initcwd = null;
    this.exts = [];
    this.xerrs = [];
  }

  init(cwd: string) {
    if (this.initp && this.initcwd === cwd) return this.initp;

    this.initcwd = cwd;
    this.initp = (async () => {
      this.exts = [];
      this.xerrs = [];

      const pi = await loadPi();
      const mgr = this.settings(cwd);
      const loader = new pi.DefaultResourceLoader({
        cwd,
        agentDir: getAgentDir(),
        settingsManager: mgr,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
      });
      const pack = new pi.DefaultPackageManager({
        cwd,
        agentDir: getAgentDir(),
        settingsManager: mgr,
      });

      try {
        await loader.reload();
        const paths = await pack.resolve();
        const exts = loader.getExtensions();
        this.exts = paths.extensions
          .filter((item) => item.metadata.origin === "top-level")
          .map((item) => ({
            name: stem(item.path),
            path: item.path,
            resolvedPath: item.path,
            scope: kind(item.metadata.scope),
            enabled: item.enabled,
          }));
        this.xerrs = exts.errors.map((item) => errDto(item));

        const runner = new pi.ExtensionRunner(
          exts.extensions,
          exts.runtime,
          cwd,
          pi.SessionManager.inMemory(cwd),
          this.reg,
        );
        runner.bindCore(core, ctx);
        this.sync();
      } catch (err) {
        this.xerrs = [
          { path: "<loader>", error: err instanceof Error ? err.message : String(err) },
        ];
      }
    })();

    return this.initp;
  }

  sync() {
    for (const provider of this.runtime) {
      this.auth.removeRuntimeApiKey(provider);
    }
    this.runtime.clear();

    this.auth.reload();
    this.reg.refresh();

    const oauth = new Set(this.auth.getOAuthProviders().map((item) => item.id));
    for (const provider of this.auth.list()) {
      const cred = this.auth.get(provider);
      if (cred?.type !== "oauth" || oauth.has(provider)) continue;
      const key = cred.access.trim();
      if (!key) continue;
      this.auth.setRuntimeApiKey(provider, key);
      this.runtime.add(provider);
    }
  }

  settings(cwd: string) {
    const agent = getAgentDir();
    return SettingsManager.create(cwd, agent);
  }

  cursorKey() {
    if (!this.auth.hasAuth("cursor")) return "";
    const cred = this.auth.get("cursor");
    if (!cred) return "env";
    if (cred.type === "oauth") return "oauth";
    return `key:${cred.key.trim()}`;
  }

  cursorSync() {
    const next = this.cursorKey();
    if (!next) {
      if (this.cursor) registerCursorProvider(this.reg);
      this.cursor = "";
      return this.cursorp ?? Promise.resolve();
    }
    if (this.cursor === next && this.cursorp) return this.cursorp;
    if (this.cursor === next && !this.cursorp) return Promise.resolve();

    this.cursor = next;
    const cred = this.auth.get("cursor");
    const key =
      cred?.type === "api_key" ? cred.key.trim() : (process.env["CURSOR_API_KEY"] ?? null);
    const job = syncCursorProvider(this.reg, key).catch(() => {
      registerCursorProvider(this.reg);
    });
    this.cursorp = job.finally(() => {
      if (this.cursorp === job) this.cursorp = null;
    });
    return this.cursorp;
  }

  prepare(cwd: string) {
    return Effect.tryPromise({
      try: async () => {
        await this.init(cwd);
        this.sync();
        await this.cursorSync();
        this.sync();
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
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
      ...this.xerrs.map((err) => `extensions: ${err.path}: ${err.error}`),
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
      this.sync();
      const path = this.paths(cwd);
      const mgr = this.settings(cwd);
      const all = this.reg.getAll();
      const available = this.reg.getAvailable();
      const shown = new Set(all.map((model) => model.provider));
      const providers = [...new Set([...shown, ...this.auth.list()])].toSorted((left, right) =>
        left.localeCompare(right),
      );
      const oauth = new Set(this.auth.getOAuthProviders().map((item) => item.id));
      const visible = new Set(available.map((model) => model.provider));
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
        providers: providers.map((provider) =>
          providerDto({
            provider,
            configured: visible.has(provider) || this.auth.hasAuth(provider),
            credential: this.auth.get(provider),
            oauthSupported: oauth.has(provider),
          }),
        ),
        models: all.map((model) => modelDto(model)),
        extensions: this.exts,
        extensionErrors: this.xerrs,
        available: available.map((model) => key(model.provider, model.id)),
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

  setExtensionEnabled(cwd: string, file: string, scope: "user" | "project", enabled: boolean) {
    return Effect.tryPromise({
      try: async () => {
        const mgr = this.settings(cwd);
        const root = scope === "user" ? this.paths(cwd).agent : Path.join(cwd, ".pi");
        const list =
          scope === "user"
            ? (mgr.getGlobalSettings().extensions ?? [])
            : (mgr.getProjectSettings().extensions ?? []);
        const next = strip(list, file, root);
        next.push(`${enabled ? "+" : "-"}${rel(file, root)}`);

        if (scope === "user") mgr.setExtensionPaths(next);
        if (scope === "project") mgr.setProjectExtensionPaths(next);

        await this.flush(mgr);
        this.invalidate();
        await Effect.runPromise(this.prepare(cwd));
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  getApiKey(provider: string) {
    return Effect.tryPromise({
      try: async () => {
        this.sync();
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
      this.sync();
      const err = this.auth.drainErrors()[0];
      if (err) throw err;
    });
  }

  clearAuth(provider: string) {
    return Effect.sync(() => {
      this.auth.remove(provider);
      this.sync();
      const err = this.auth.drainErrors()[0];
      if (err) throw err;
    });
  }

  oauthLogin(cwd: string, provider: string, callbacks: OAuthLoginCallbacks) {
    return Effect.tryPromise({
      try: async () => {
        await this.init(cwd);
        this.sync();
        await this.auth.login(provider, callbacks);
        this.reg.refresh();
        if (provider === "cursor") {
          await this.cursorSync();
        }
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }
}
