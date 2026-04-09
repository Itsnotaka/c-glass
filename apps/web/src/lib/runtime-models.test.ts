import type { ModelSelection, ServerProvider } from "@glass/contracts";
import { afterEach, describe, expect, it } from "vitest";

import type { Project } from "../types";
import { readRuntimeDefaults, resolveRuntimeSelection } from "./runtime-models";

const original = Object.getOwnPropertyDescriptor(globalThis, "window");

function setWindow(cwd?: string) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => (key === "glass:workspace-cwd" ? (cwd ?? null) : null),
      },
    },
  });
}

function provider(
  kind: ServerProvider["provider"],
  models: ServerProvider["models"],
): ServerProvider {
  return {
    provider: kind,
    enabled: true,
    installed: true,
    version: "1.0.0",
    status: "ready",
    auth: { status: "authenticated", type: "chatgpt", label: "ChatGPT Subscription" },
    checkedAt: "2026-04-08T00:00:00.000Z",
    models,
  };
}

const providers: ServerProvider[] = [
  provider("codex", [
    {
      slug: "gpt-5.4",
      name: "GPT-5.4",
      isCustom: false,
      capabilities: {
        reasoningEffortLevels: [
          { value: "xhigh", label: "Extra High" },
          { value: "high", label: "High", isDefault: true },
          { value: "medium", label: "Medium" },
          { value: "low", label: "Low" },
        ],
        supportsFastMode: true,
        supportsThinkingToggle: false,
        contextWindowOptions: [],
        promptInjectedEffortLevels: [],
      },
    },
  ]),
  provider("claudeAgent", [
    {
      slug: "claude-sonnet-4-6",
      name: "Claude Sonnet 4.6",
      isCustom: false,
      capabilities: {
        reasoningEffortLevels: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium", isDefault: true },
          { value: "high", label: "High" },
          { value: "max", label: "Max" },
        ],
        supportsFastMode: false,
        supportsThinkingToggle: true,
        contextWindowOptions: [],
        promptInjectedEffortLevels: [],
      },
    },
  ]),
];

afterEach(() => {
  if (original) {
    Object.defineProperty(globalThis, "window", original);
    return;
  }
  Reflect.deleteProperty(globalThis, "window");
});

describe("resolveRuntimeSelection", () => {
  it("drops codex-only options when the provider selection is Claude", () => {
    const selection = {
      provider: "claudeAgent",
      model: "claude-sonnet-4-6",
      options: { reasoningEffort: "high" },
    } as unknown as ModelSelection;

    expect(resolveRuntimeSelection(providers, selection)).toEqual({
      provider: "claudeAgent",
      model: "claude-sonnet-4-6",
      options: { effort: "medium" },
    });
  });

  it("drops Claude-only options when the provider selection is Codex", () => {
    const selection = {
      provider: "codex",
      model: "gpt-5.4",
      options: { thinking: true, effort: "high" },
    } as unknown as ModelSelection;

    expect(resolveRuntimeSelection(providers, selection)).toEqual({
      provider: "codex",
      model: "gpt-5.4",
      options: { reasoningEffort: "high" },
    });
  });

  it("canonicalizes the legacy gpt-5-codex slug to the current Codex default", () => {
    expect(
      resolveRuntimeSelection(providers, {
        provider: "codex",
        model: "gpt-5-codex",
      } as ModelSelection),
    ).toEqual({
      provider: "codex",
      model: "gpt-5.4",
      options: { reasoningEffort: "high" },
    });
  });
});

describe("readRuntimeDefaults", () => {
  it("uses the stored workspace project instead of the first project", () => {
    setWindow("/beta");

    const projects: Project[] = [
      {
        id: "project-a" as Project["id"],
        name: "alpha",
        cwd: "/alpha",
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5.4",
        },
        scripts: [],
      },
      {
        id: "project-b" as Project["id"],
        name: "beta",
        cwd: "/beta",
        defaultModelSelection: {
          provider: "claudeAgent",
          model: "claude-sonnet-4-6",
        },
        scripts: [],
      },
    ];

    const defs = readRuntimeDefaults(projects, providers);

    expect(defs.project?.id).toBe("project-b");
    expect(defs.selection).toEqual({
      provider: "claudeAgent",
      model: "claude-sonnet-4-6",
      options: { effort: "medium" },
    });
    expect(defs.model).toBe("claude-sonnet-4-6");
    expect(defs.thinkingLevel).toBe("medium");
    expect(defs.stored).toBe(true);
  });
});
