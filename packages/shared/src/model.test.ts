import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_BY_PROVIDER, type ModelCapabilities } from "@glass/contracts";

import {
  applyClaudePromptEffortPrefix,
  getDefaultContextWindow,
  getDefaultEffort,
  hasContextWindowOption,
  hasEffortLevel,
  isClaudeUltrathinkPrompt,
  normalizeModelSlug,
  normalizePiModelOptionsWithCapabilities,
  resolveApiModelId,
  resolveContextWindow,
  resolveEffort,
  resolveModelSlug,
  resolveModelSlugForProvider,
  resolveSelectableModel,
  trimOrNull,
} from "./model";

const reasoningHeavyCaps: ModelCapabilities = {
  reasoningEffortLevels: [
    { value: "xhigh", label: "Extra High" },
    { value: "high", label: "High", isDefault: true },
  ],
  supportsFastMode: true,
  supportsThinkingToggle: false,
  contextWindowOptions: [],
  promptInjectedEffortLevels: [],
};

const contextWindowCaps: ModelCapabilities = {
  reasoningEffortLevels: [
    { value: "medium", label: "Medium" },
    { value: "high", label: "High", isDefault: true },
    { value: "ultrathink", label: "Ultrathink" },
  ],
  supportsFastMode: false,
  supportsThinkingToggle: false,
  contextWindowOptions: [
    { value: "200k", label: "200k" },
    { value: "1m", label: "1M", isDefault: true },
  ],
  promptInjectedEffortLevels: ["ultrathink"],
};

describe("normalizeModelSlug", () => {
  it("maps known aliases to canonical slugs", () => {
    expect(normalizeModelSlug("5.3")).toBe("gpt-5.3-codex");
    expect(normalizeModelSlug("sonnet", "pi")).toBe("claude-sonnet-4-6");
  });

  it("returns null for empty or missing values", () => {
    expect(normalizeModelSlug("")).toBeNull();
    expect(normalizeModelSlug("   ")).toBeNull();
    expect(normalizeModelSlug(null)).toBeNull();
    expect(normalizeModelSlug(undefined)).toBeNull();
  });
});

describe("resolveModelSlug", () => {
  it("returns defaults when the model is missing", () => {
    expect(resolveModelSlug(undefined, "pi")).toBe(DEFAULT_MODEL_BY_PROVIDER.pi);

    expect(resolveModelSlugForProvider("pi", undefined)).toBe(DEFAULT_MODEL_BY_PROVIDER.pi);
  });

  it("preserves normalized unknown models", () => {
    expect(resolveModelSlug("custom/internal-model", "pi")).toBe("custom/internal-model");
  });
});

describe("resolveSelectableModel", () => {
  it("resolves exact slugs, labels, and aliases", () => {
    const options = [
      { slug: "gpt-5.3-codex", name: "GPT-5.3 Codex" },
      { slug: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    ];
    expect(resolveSelectableModel("pi", "gpt-5.3-codex", options)).toBe("gpt-5.3-codex");
    expect(resolveSelectableModel("pi", "gpt-5.3 codex", options)).toBe("gpt-5.3-codex");
    expect(resolveSelectableModel("pi", "sonnet", options)).toBe("claude-sonnet-4-6");
  });
});

describe("capability helpers", () => {
  it("reads default efforts", () => {
    expect(getDefaultEffort(reasoningHeavyCaps)).toBe("high");
    expect(getDefaultEffort(contextWindowCaps)).toBe("high");
  });

  it("checks effort support", () => {
    expect(hasEffortLevel(reasoningHeavyCaps, "xhigh")).toBe(true);
    expect(hasEffortLevel(reasoningHeavyCaps, "max")).toBe(false);
  });
});

describe("resolveEffort", () => {
  it("returns the explicit value when supported and not prompt-injected", () => {
    expect(resolveEffort(reasoningHeavyCaps, "xhigh")).toBe("xhigh");
    expect(resolveEffort(reasoningHeavyCaps, "high")).toBe("high");
    expect(resolveEffort(contextWindowCaps, "medium")).toBe("medium");
  });

  it("falls back to default when value is unsupported", () => {
    expect(resolveEffort(reasoningHeavyCaps, "bogus")).toBe("high");
    expect(resolveEffort(contextWindowCaps, "bogus")).toBe("high");
  });

  it("returns the default when no value is provided", () => {
    expect(resolveEffort(reasoningHeavyCaps, undefined)).toBe("high");
    expect(resolveEffort(reasoningHeavyCaps, null)).toBe("high");
    expect(resolveEffort(reasoningHeavyCaps, "")).toBe("high");
    expect(resolveEffort(reasoningHeavyCaps, "  ")).toBe("high");
  });

  it("excludes prompt-injected efforts and falls back to default", () => {
    expect(resolveEffort(contextWindowCaps, "ultrathink")).toBe("high");
  });

  it("returns undefined for models with no effort levels", () => {
    const noCaps: ModelCapabilities = {
      reasoningEffortLevels: [],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    };
    expect(resolveEffort(noCaps, undefined)).toBeUndefined();
    expect(resolveEffort(noCaps, "high")).toBeUndefined();
  });
});

describe("misc helpers", () => {
  it("detects ultrathink prompts", () => {
    expect(isClaudeUltrathinkPrompt("Ultrathink:\nInvestigate")).toBe(true);
    expect(isClaudeUltrathinkPrompt("Investigate")).toBe(false);
  });

  it("prefixes ultrathink prompts once", () => {
    expect(applyClaudePromptEffortPrefix("Investigate", "ultrathink")).toBe(
      "Ultrathink:\nInvestigate",
    );
    expect(applyClaudePromptEffortPrefix("Ultrathink:\nInvestigate", "ultrathink")).toBe(
      "Ultrathink:\nInvestigate",
    );
  });

  it("trims strings to null", () => {
    expect(trimOrNull("  hi  ")).toBe("hi");
    expect(trimOrNull("   ")).toBeNull();
  });
});

describe("context window helpers", () => {
  it("reads default context window", () => {
    expect(getDefaultContextWindow(contextWindowCaps)).toBe("1m");
  });

  it("returns null for models without context window options", () => {
    expect(getDefaultContextWindow(reasoningHeavyCaps)).toBeNull();
  });

  it("checks context window support", () => {
    expect(hasContextWindowOption(contextWindowCaps, "1m")).toBe(true);
    expect(hasContextWindowOption(contextWindowCaps, "200k")).toBe(true);
    expect(hasContextWindowOption(contextWindowCaps, "bogus")).toBe(false);
    expect(hasContextWindowOption(reasoningHeavyCaps, "1m")).toBe(false);
  });
});

describe("resolveContextWindow", () => {
  it("returns the explicit value when supported", () => {
    expect(resolveContextWindow(contextWindowCaps, "200k")).toBe("200k");
    expect(resolveContextWindow(contextWindowCaps, "1m")).toBe("1m");
  });

  it("falls back to default when value is unsupported", () => {
    expect(resolveContextWindow(contextWindowCaps, "bogus")).toBe("1m");
  });

  it("returns the default when no value is provided", () => {
    expect(resolveContextWindow(contextWindowCaps, undefined)).toBe("1m");
    expect(resolveContextWindow(contextWindowCaps, null)).toBe("1m");
    expect(resolveContextWindow(contextWindowCaps, "")).toBe("1m");
  });

  it("returns undefined for models with no context window options", () => {
    expect(resolveContextWindow(reasoningHeavyCaps, undefined)).toBeUndefined();
    expect(resolveContextWindow(reasoningHeavyCaps, "1m")).toBeUndefined();
  });
});

describe("resolveApiModelId", () => {
  it("appends [1m] suffix for 1m context window", () => {
    expect(
      resolveApiModelId({
        provider: "pi",
        model: "claude-opus-4-6",
        options: { contextWindow: "1m" },
      }),
    ).toBe("claude-opus-4-6[1m]");
  });

  it("returns the model as-is for 200k context window", () => {
    expect(
      resolveApiModelId({
        provider: "pi",
        model: "claude-opus-4-6",
        options: { contextWindow: "200k" },
      }),
    ).toBe("claude-opus-4-6");
  });

  it("returns the model as-is when no context window is set", () => {
    expect(resolveApiModelId({ provider: "pi", model: "claude-opus-4-6" })).toBe("claude-opus-4-6");
    expect(resolveApiModelId({ provider: "pi", model: "claude-opus-4-6", options: {} })).toBe(
      "claude-opus-4-6",
    );
  });

  it("returns the model as-is for GPT-style selections", () => {
    expect(resolveApiModelId({ provider: "pi", model: "gpt-5.4" })).toBe("gpt-5.4");
  });
});

describe("normalizePiModelOptionsWithCapabilities", () => {
  it("preserves explicit false fast mode on reasoning-heavy models", () => {
    expect(
      normalizePiModelOptionsWithCapabilities(reasoningHeavyCaps, {
        reasoningEffort: "high",
        fastMode: false,
      }),
    ).toEqual({
      reasoningEffort: "high",
      fastMode: false,
    });
  });

  it("preserves the default context window explicitly", () => {
    expect(
      normalizePiModelOptionsWithCapabilities(
        {
          ...contextWindowCaps,
          contextWindowOptions: [
            { value: "200k", label: "200k", isDefault: true },
            { value: "1m", label: "1M" },
          ],
        },
        {
          effort: "high",
          contextWindow: "200k",
        },
      ),
    ).toEqual({
      effort: "high",
      contextWindow: "200k",
    });
  });

  it("omits unsupported context window options", () => {
    expect(
      normalizePiModelOptionsWithCapabilities(
        {
          ...contextWindowCaps,
          reasoningEffortLevels: [],
          supportsThinkingToggle: true,
          contextWindowOptions: [],
        },
        {
          thinking: true,
          contextWindow: "1m",
        },
      ),
    ).toEqual({
      thinking: true,
    });
  });
});
