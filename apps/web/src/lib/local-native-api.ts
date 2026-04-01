import type { ContextMenuItem, NativeApi } from "@glass/contracts";
import {
  DEFAULT_SERVER_SETTINGS,
  DEFAULT_TERMINAL_ID,
  type GitActionProgressEvent,
  type GitCreateWorktreeResult,
  type GitListBranchesResult,
  type GitPreparePullRequestThreadResult,
  type GitPullResult,
  type GitResolvePullRequestResult,
  type GitRunStackedActionResult,
  type GitStatusResult,
  type OrchestrationReadModel,
  type PiConfig,
  type PiThinkingLevel,
  type ProjectSearchEntriesResult,
  type ProjectWriteFileResult,
  type ServerConfig,
  type ServerProviderUpdatedPayload,
  type ServerSettings,
  type ServerUpsertKeybindingResult,
  type TerminalClearInput,
  type TerminalCloseInput,
  type TerminalEvent,
  type TerminalOpenInput,
  type TerminalRestartInput,
  type TerminalSessionSnapshot,
} from "@glass/contracts";
import { getModels, getProviders } from "@mariozechner/pi-ai";

import { showContextMenuFallback } from "../contextMenuFallback";
import { EMPTY_ORCHESTRATION_READ_MODEL } from "./pi-glass-constants";

const emptyGitStatus = (): GitStatusResult => ({
  branch: null,
  hasWorkingTreeChanges: false,
  workingTree: { files: [], insertions: 0, deletions: 0 },
  hasUpstream: false,
  aheadCount: 0,
  behindCount: 0,
  pr: null,
});

const emptyBranchList = (): GitListBranchesResult => ({
  branches: [],
  isRepo: false,
  hasOriginRemote: false,
});

function terminalSnapshotFromOpen(input: TerminalOpenInput): TerminalSessionSnapshot {
  const terminalId =
    typeof input.terminalId === "string" && input.terminalId.length > 0
      ? input.terminalId
      : DEFAULT_TERMINAL_ID;
  return {
    threadId: input.threadId,
    terminalId,
    cwd: input.cwd,
    status: "error",
    pid: null,
    history: "",
    exitCode: 1,
    exitSignal: null,
    updatedAt: new Date().toISOString(),
  };
}

function terminalSnapshotFromRestart(input: TerminalRestartInput): TerminalSessionSnapshot {
  return {
    threadId: input.threadId,
    terminalId: input.terminalId ?? DEFAULT_TERMINAL_ID,
    cwd: input.cwd,
    status: "error",
    pid: null,
    history: "",
    exitCode: 1,
    exitSignal: null,
    updatedAt: new Date().toISOString(),
  };
}

const stubServerConfig = (): ServerConfig => ({
  cwd: "/",
  keybindingsConfigPath: "/dev/null",
  keybindings: [],
  issues: [],
  providers: [],
  availableEditors: ["vscode"],
  settings: DEFAULT_SERVER_SETTINGS,
});

const PI_PROVIDER_KEY = "defaultProvider";
const PI_MODEL_KEY = "defaultModel";
const PI_THINKING_KEY = "defaultThinkingLevel";

function piKey(provider: string, model: string) {
  return `${provider}/${model}`;
}

function piThinking(v: unknown): PiThinkingLevel | null {
  if (
    v === "off" ||
    v === "minimal" ||
    v === "low" ||
    v === "medium" ||
    v === "high" ||
    v === "xhigh"
  ) {
    return v;
  }
  return null;
}

async function piStorage() {
  const { ensurePiGlassStorage } = await import("./pi-glass-storage");
  return ensurePiGlassStorage();
}

async function localPiConfig(): Promise<PiConfig> {
  const storage = await piStorage();
  const models: Array<PiConfig["models"][number]> = [];

  for (const provider of getProviders()) {
    for (const model of getModels(provider)) {
      models.push({
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
      });
    }
  }

  for (const provider of await storage.customProviders.getAll()) {
    for (const model of provider.models ?? []) {
      models.push({
        provider: provider.name,
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
      });
    }
  }

  const provider = await storage.settings.get(PI_PROVIDER_KEY);
  const model = await storage.settings.get(PI_MODEL_KEY);
  const thinking = await storage.settings.get(PI_THINKING_KEY);
  const keys = await storage.providerKeys.list();
  const available =
    keys.length > 0
      ? models
          .filter((item) => keys.includes(item.provider))
          .map((item) => piKey(item.provider, item.id))
      : models.map((item) => piKey(item.provider, item.id));

  return {
    agentDir: "browser-local",
    settingsPath: "indexeddb:settings",
    projectSettingsPath: "indexeddb:settings",
    modelsPath: "indexeddb:customProviders",
    authPath: "indexeddb:providerKeys",
    defaults: {
      provider: typeof provider === "string" && provider.trim() ? provider : null,
      model: typeof model === "string" && model.trim() ? model : null,
      thinkingLevel: piThinking(thinking),
    },
    models,
    available,
    error: null,
  };
}

export function createLocalGlassNativeApi(): NativeApi {
  return {
    dialogs: {
      pickFolder: async () => {
        if (window.desktopBridge) {
          return window.desktopBridge.pickFolder();
        }
        return null;
      },
      confirm: async (message) => {
        if (window.desktopBridge) {
          return window.desktopBridge.confirm(message);
        }
        return window.confirm(message);
      },
    },
    terminal: {
      open: async (input) => terminalSnapshotFromOpen(input),
      write: async () => undefined,
      resize: async () => undefined,
      clear: async (_input: TerminalClearInput) => undefined,
      restart: async (input) => terminalSnapshotFromRestart(input),
      close: async (_input: TerminalCloseInput) => undefined,
      onEvent: (_callback: (event: TerminalEvent) => void) => () => undefined,
    },
    projects: {
      searchEntries: async (): Promise<ProjectSearchEntriesResult> => ({
        entries: [],
        truncated: false,
      }),
      writeFile: async (input): Promise<ProjectWriteFileResult> => ({
        relativePath: input.relativePath,
      }),
    },
    shell: {
      openInEditor: async () => undefined,
      openExternal: async (url) => {
        if (window.desktopBridge) {
          const opened = await window.desktopBridge.openExternal(url);
          if (!opened) {
            throw new Error("Unable to open link.");
          }
          return;
        }
        window.open(url, "_blank", "noopener,noreferrer");
      },
    },
    git: {
      pull: async (_input): Promise<GitPullResult> => ({
        status: "skipped_up_to_date",
        branch: "main",
        upstreamBranch: null,
      }),
      status: async (_input): Promise<GitStatusResult> => emptyGitStatus(),
      runStackedAction: async (_input): Promise<GitRunStackedActionResult> => ({
        action: "commit",
        branch: { status: "skipped_not_requested" },
        commit: { status: "skipped_no_changes" },
        push: { status: "skipped_not_requested" },
        pr: { status: "skipped_not_requested" },
      }),
      listBranches: async (_input): Promise<GitListBranchesResult> => emptyBranchList(),
      createWorktree: async (input): Promise<GitCreateWorktreeResult> => ({
        worktree: {
          path: input.path ?? "/tmp/worktree",
          branch: input.branch,
        },
      }),
      removeWorktree: async () => undefined,
      createBranch: async () => undefined,
      checkout: async () => undefined,
      init: async () => undefined,
      resolvePullRequest: async (): Promise<GitResolvePullRequestResult> => ({
        pullRequest: {
          number: 1,
          title: "stub",
          url: "https://example.com",
          baseBranch: "main",
          headBranch: "main",
          state: "open",
        },
      }),
      preparePullRequestThread: async (): Promise<GitPreparePullRequestThreadResult> => ({
        pullRequest: {
          number: 1,
          title: "stub",
          url: "https://example.com",
          baseBranch: "main",
          headBranch: "main",
          state: "open",
        },
        branch: "main",
        worktreePath: null,
      }),
      onActionProgress: (_callback: (event: GitActionProgressEvent) => void) => () => undefined,
    },
    contextMenu: {
      show: async <T extends string>(
        items: readonly ContextMenuItem<T>[],
        position?: { x: number; y: number },
      ) => {
        if (window.desktopBridge) {
          return window.desktopBridge.showContextMenu(items, position) as Promise<T | null>;
        }
        return showContextMenuFallback(items, position) as Promise<T | null>;
      },
    },
    server: {
      getConfig: async () => stubServerConfig(),
      refreshProviders: async (): Promise<ServerProviderUpdatedPayload> => ({ providers: [] }),
      upsertKeybinding: async (): Promise<ServerUpsertKeybindingResult> => ({
        keybindings: [],
        issues: [],
      }),
      getSettings: async () => DEFAULT_SERVER_SETTINGS,
      updateSettings: async (patch) => ({ ...DEFAULT_SERVER_SETTINGS, ...patch }) as ServerSettings,
      getPiConfig: async () => localPiConfig(),
      setPiDefaultModel: async (provider, model) => {
        const storage = await piStorage();
        await storage.settings.set(PI_PROVIDER_KEY, provider);
        await storage.settings.set(PI_MODEL_KEY, model);
      },
      clearPiDefaultModel: async () => {
        const storage = await piStorage();
        await storage.settings.delete(PI_PROVIDER_KEY);
        await storage.settings.delete(PI_MODEL_KEY);
      },
      setPiDefaultThinkingLevel: async (thinkingLevel) => {
        const storage = await piStorage();
        await storage.settings.set(PI_THINKING_KEY, thinkingLevel);
      },
      getPiApiKey: async (provider) => {
        const storage = await piStorage();
        return (await storage.providerKeys.get(provider)) ?? null;
      },
      setPiApiKey: async (provider, key) => {
        const storage = await piStorage();
        await storage.providerKeys.set(provider, key);
      },
    },
    orchestration: {
      getSnapshot: async (): Promise<OrchestrationReadModel> => EMPTY_ORCHESTRATION_READ_MODEL,
      dispatchCommand: async () => ({ sequence: 0 }),
      getTurnDiff: async (input) => ({
        threadId: input.threadId,
        fromTurnCount: 0,
        toTurnCount: 0,
        diff: "",
      }),
      getFullThreadDiff: async (input) => ({
        threadId: input.threadId,
        fromTurnCount: 0,
        toTurnCount: 0,
        diff: "",
      }),
      replayEvents: async () => [],
      onDomainEvent: (callback) => {
        void callback;
        return () => undefined;
      },
    },
  };
}
