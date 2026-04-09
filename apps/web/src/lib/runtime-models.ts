import {
  type ClaudeModelOptions,
  CommandId,
  type CodexModelOptions,
  DEFAULT_MODEL_BY_PROVIDER,
  type HarnessModelRef,
  type ModelSelection,
  type ProviderKind,
  PROVIDER_DISPLAY_NAMES,
  type ServerProvider,
  type ThinkingLevel,
} from "@glass/contracts";
import {
  normalizeClaudeModelOptionsWithCapabilities,
  normalizeCodexModelOptionsWithCapabilities,
  resolveSelectableModel,
} from "@glass/shared/model";

import { readNativeApi } from "../native-api";
import { getServerConfig } from "../rpc/server-state";
import {
  getDefaultServerModel,
  getProviderModelCapabilities,
  getProviderModels,
  resolveSelectableProvider,
} from "../provider-models";
import { useStore } from "../store";
import type { Project } from "../types";

const WORKSPACE_KEY = "glass:workspace-cwd";

export interface RuntimeModelItem extends HarnessModelRef {
  key: string;
  name: string;
  supportsFastMode: boolean;
  supportsXhigh: boolean;
}

export interface RuntimeDefaultsRead {
  project: Project | null;
  selection: ModelSelection;
  provider: string | null;
  model: string | null;
  fastMode: boolean;
  fastSupported: boolean;
  thinkingLevel: ThinkingLevel;
  stored: boolean;
  items: RuntimeModelItem[];
  modelRef: RuntimeModelItem | HarnessModelRef | null;
}

const commandId = () => CommandId.make(crypto.randomUUID());

export function readStoredCwd() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(WORKSPACE_KEY)?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function resolveActiveProject(projects: readonly Project[], cwd = readStoredCwd()) {
  return projects.find((item) => item.cwd === cwd) ?? projects[0] ?? null;
}

function key(provider: string, id: string) {
  return `${provider}/${id}`;
}

export function displayModelName(raw: string) {
  const text = raw.trim();
  if (!text) return raw;
  const next = text.replace(/^model\s+/i, "").trim();
  return next.length > 0 ? next : text;
}

export function displayProviderName(provider: string) {
  return provider === "codex" || provider === "claudeAgent"
    ? PROVIDER_DISPLAY_NAMES[provider]
    : provider;
}

function supportsXhigh(
  provider: ProviderKind,
  caps: ServerProvider["models"][number]["capabilities"],
) {
  if (!caps) return false;
  if (provider === "codex") {
    return caps.reasoningEffortLevels.some((item) => item.value === "xhigh");
  }
  return caps.reasoningEffortLevels.some(
    (item) => item.value === "max" || item.value === "ultrathink",
  );
}

export function toModelItem(
  provider: ProviderKind,
  item: ServerProvider["models"][number],
): RuntimeModelItem {
  return {
    key: key(provider, item.slug),
    provider,
    id: item.slug,
    name: item.name,
    reasoning:
      Boolean(item.capabilities?.supportsThinkingToggle) ||
      Boolean(item.capabilities?.reasoningEffortLevels.length),
    supportsFastMode: Boolean(item.capabilities?.supportsFastMode),
    supportsXhigh: supportsXhigh(provider, item.capabilities),
  };
}

function fallbackModel(selection: ModelSelection): HarnessModelRef {
  return {
    provider: selection.provider,
    id: selection.model,
    name: selection.model,
    reasoning:
      selection.provider === "codex"
        ? Boolean(selection.options?.reasoningEffort)
        : Boolean(selection.options?.thinking) || Boolean(selection.options?.effort),
  };
}

function selectableOptions(
  providers: readonly ServerProvider[],
  provider: ProviderKind,
): ReadonlyArray<{ slug: string; name: string }> {
  return getProviderModels(providers, provider).map((item) => ({
    slug: item.slug,
    name: item.name,
  }));
}

export function resolveRuntimeSelection(
  providers: readonly ServerProvider[],
  selection: ModelSelection | null | undefined,
  requested?: ProviderKind | null,
): ModelSelection {
  const provider = resolveSelectableProvider(
    providers,
    requested ?? selection?.provider ?? "codex",
  );
  const prev = selection?.provider === provider ? selection : null;
  const model =
    resolveSelectableModel(provider, prev?.model ?? null, selectableOptions(providers, provider)) ??
    getDefaultServerModel(providers, provider) ??
    DEFAULT_MODEL_BY_PROVIDER[provider];
  const caps = getProviderModelCapabilities(
    getProviderModels(providers, provider),
    model,
    provider,
  );
  const options =
    provider === "codex"
      ? normalizeCodexModelOptionsWithCapabilities(
          caps,
          prev?.provider === "codex" ? prev.options : undefined,
        )
      : normalizeClaudeModelOptionsWithCapabilities(
          caps,
          prev?.provider === "claudeAgent" ? prev.options : undefined,
        );

  return {
    provider,
    model,
    ...(options ? { options } : {}),
  };
}

export function filterRuntimeModels(items: readonly RuntimeModelItem[], query: string) {
  const input = query.trim().toLowerCase();
  if (!input) return [...items];

  const tokens = input.split(/\s+/).filter(Boolean);
  return items
    .filter((item) => {
      const text =
        `${item.provider} ${displayProviderName(item.provider)} ${item.id} ${item.name}`.toLowerCase();
      return tokens.every((token) => text.includes(token));
    })
    .toSorted((left, right) =>
      `${displayProviderName(left.provider)} ${left.name}`.localeCompare(
        `${displayProviderName(right.provider)} ${right.name}`,
      ),
    );
}

export function selectionToThinking(selection: ModelSelection | null | undefined): ThinkingLevel {
  if (!selection) return "off";
  if (selection.provider === "codex") {
    switch (selection.options?.reasoningEffort) {
      case "low":
        return "low";
      case "medium":
        return "medium";
      case "high":
        return "high";
      case "xhigh":
        return "xhigh";
      default:
        return "off";
    }
  }

  if (selection.options?.thinking === false) return "off";
  switch (selection.options?.effort) {
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "max":
    case "ultrathink":
      return "xhigh";
    default:
      return selection.options?.thinking ? "medium" : "off";
  }
}

export function selectionToFastMode(selection: ModelSelection | null | undefined) {
  return selection?.options?.fastMode === true;
}

export function selectionSupportsFastMode(
  providers: readonly ServerProvider[],
  selection: ModelSelection | null | undefined,
) {
  if (!selection) return false;
  return getProviderModelCapabilities(
    getProviderModels(providers, selection.provider),
    selection.model,
    selection.provider,
  ).supportsFastMode;
}

export function applyThinking(selection: ModelSelection, level: ThinkingLevel): ModelSelection {
  if (selection.provider === "codex") {
    const reasoningEffort: CodexModelOptions["reasoningEffort"] =
      level === "off"
        ? undefined
        : level === "minimal" || level === "low"
          ? "low"
          : level === "medium"
            ? "medium"
            : level === "xhigh"
              ? "xhigh"
              : "high";
    const options: CodexModelOptions = {
      ...(reasoningEffort ? { reasoningEffort } : {}),
      ...(selection.options?.fastMode !== undefined
        ? { fastMode: selection.options.fastMode }
        : {}),
    };
    const next: Extract<ModelSelection, { provider: "codex" }> = {
      provider: "codex",
      model: selection.model,
      ...(Object.keys(options).length > 0 ? { options } : {}),
    };
    return next;
  }

  const effort: ClaudeModelOptions["effort"] =
    level === "off"
      ? undefined
      : level === "minimal" || level === "low"
        ? "low"
        : level === "medium"
          ? "medium"
          : level === "xhigh"
            ? "max"
            : "high";
  const options: ClaudeModelOptions = {
    thinking: level !== "off",
    ...(effort ? { effort } : {}),
    ...(selection.options?.fastMode !== undefined ? { fastMode: selection.options.fastMode } : {}),
    ...(selection.options?.contextWindow !== undefined
      ? { contextWindow: selection.options.contextWindow }
      : {}),
  };
  const next: Extract<ModelSelection, { provider: "claudeAgent" }> = {
    provider: "claudeAgent",
    model: selection.model,
    ...(Object.keys(options).length > 0 ? { options } : {}),
  };
  return next;
}

export function applyFastMode(selection: ModelSelection, on: boolean): ModelSelection {
  if (selection.provider === "codex") {
    const options: CodexModelOptions = {
      ...(selection.options?.reasoningEffort
        ? { reasoningEffort: selection.options.reasoningEffort }
        : {}),
      ...(on || selection.options?.fastMode !== undefined ? { fastMode: on } : {}),
    };
    return {
      provider: "codex",
      model: selection.model,
      ...(Object.keys(options).length > 0 ? { options } : {}),
    };
  }

  const options: ClaudeModelOptions = {
    ...(selection.options?.thinking !== undefined ? { thinking: selection.options.thinking } : {}),
    ...(selection.options?.effort ? { effort: selection.options.effort } : {}),
    ...(on || selection.options?.fastMode !== undefined ? { fastMode: on } : {}),
    ...(selection.options?.contextWindow !== undefined
      ? { contextWindow: selection.options.contextWindow }
      : {}),
  };
  return {
    provider: "claudeAgent",
    model: selection.model,
    ...(Object.keys(options).length > 0 ? { options } : {}),
  };
}

export function listRuntimeModelsFromProviders(
  providers: readonly ServerProvider[],
  cur?: HarnessModelRef | null,
) {
  const items = providers
    .filter((provider) => provider.enabled)
    .flatMap((provider) => provider.models.map((item) => toModelItem(provider.provider, item)));
  const keys = new Set(items.map((item) => item.key));
  if (cur && !keys.has(key(cur.provider, cur.id))) {
    items.push({
      key: key(cur.provider, cur.id),
      provider: cur.provider,
      id: cur.id,
      name: cur.name ?? cur.id,
      reasoning: Boolean(cur.reasoning),
      supportsFastMode: false,
      supportsXhigh: false,
    });
  }
  return items.toSorted((left, right) =>
    `${displayProviderName(left.provider)} ${left.name}`.localeCompare(
      `${displayProviderName(right.provider)} ${right.name}`,
    ),
  );
}

export function resolveRuntimeModel(
  providers: readonly ServerProvider[],
  selection: ModelSelection,
  cur?: HarnessModelRef | null,
) {
  const items = listRuntimeModelsFromProviders(providers, cur);
  return (
    items.find((item) => item.provider === selection.provider && item.id === selection.model) ??
    cur ??
    fallbackModel(selection)
  );
}

export function readRuntimeDefaults(
  projects: readonly Project[],
  providers: readonly ServerProvider[],
  cwd = readStoredCwd(),
  cur?: HarnessModelRef | null,
) {
  const project = resolveActiveProject(projects, cwd);
  const selection = resolveRuntimeSelection(providers, project?.defaultModelSelection);
  const modelRef = resolveRuntimeModel(providers, selection, cur);
  return {
    project,
    selection,
    provider: modelRef?.provider ?? null,
    model: modelRef?.id ?? null,
    fastMode: selectionToFastMode(selection),
    fastSupported: selectionSupportsFastMode(providers, selection),
    thinkingLevel: selectionToThinking(selection),
    stored: project?.defaultModelSelection !== null,
    items: listRuntimeModelsFromProviders(providers, cur),
    modelRef,
  };
}

export async function writeRuntimeDefaultModel(model: HarnessModelRef) {
  const api = readNativeApi();
  const project = resolveActiveProject(useStore.getState().projects);
  if (!api || !project) return;
  const providers = getServerConfig()?.providers ?? [];
  const current = project.defaultModelSelection;
  const next = resolveRuntimeSelection(providers, {
    provider: model.provider as ProviderKind,
    model: model.id,
    ...(current?.provider === model.provider && current.options
      ? { options: current.options }
      : {}),
  });
  await api.orchestration.dispatchCommand({
    type: "project.meta.update",
    commandId: commandId(),
    projectId: project.id,
    defaultModelSelection: next,
  });
}

export async function clearRuntimeDefaultModel() {
  const api = readNativeApi();
  const project = resolveActiveProject(useStore.getState().projects);
  if (!api || !project) return;
  await api.orchestration.dispatchCommand({
    type: "project.meta.update",
    commandId: commandId(),
    projectId: project.id,
    defaultModelSelection: null,
  });
}

export async function writeRuntimeDefaultThinkingLevel(level: ThinkingLevel) {
  const api = readNativeApi();
  const project = resolveActiveProject(useStore.getState().projects);
  if (!api || !project) return;
  const providers = getServerConfig()?.providers ?? [];
  const selection = resolveRuntimeSelection(providers, project.defaultModelSelection);
  await api.orchestration.dispatchCommand({
    type: "project.meta.update",
    commandId: commandId(),
    projectId: project.id,
    defaultModelSelection: resolveRuntimeSelection(providers, applyThinking(selection, level)),
  });
}

export async function writeRuntimeDefaultFastMode(on: boolean) {
  const api = readNativeApi();
  const project = resolveActiveProject(useStore.getState().projects);
  if (!api || !project) return;
  const providers = getServerConfig()?.providers ?? [];
  const selection = resolveRuntimeSelection(providers, project.defaultModelSelection);
  await api.orchestration.dispatchCommand({
    type: "project.meta.update",
    commandId: commandId(),
    projectId: project.id,
    defaultModelSelection: resolveRuntimeSelection(providers, applyFastMode(selection, on)),
  });
}
