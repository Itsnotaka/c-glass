import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import { ProviderSendTurnInput, ProviderSessionStartInput } from "./provider";

const decodeProviderSessionStartInput = Schema.decodeUnknownSync(ProviderSessionStartInput);
const decodeProviderSendTurnInput = Schema.decodeUnknownSync(ProviderSendTurnInput);

describe("ProviderSessionStartInput", () => {
  it("accepts pi model selection with reasoning options", () => {
    const parsed = decodeProviderSessionStartInput({
      threadId: "thread-1",
      provider: "pi",
      cwd: "/tmp/workspace",
      modelSelection: {
        provider: "pi",
        model: "gpt-5.3-codex",
        options: {
          reasoningEffort: "high",
          fastMode: true,
        },
      },
      runtimeMode: "full-access",
    });
    expect(parsed.runtimeMode).toBe("full-access");
    expect(parsed.modelSelection?.provider).toBe("pi");
    expect(parsed.modelSelection?.model).toBe("gpt-5.3-codex");
    if (parsed.modelSelection?.provider !== "pi") {
      throw new Error("Expected pi modelSelection");
    }
    expect(parsed.modelSelection.options?.reasoningEffort).toBe("high");
    expect(parsed.modelSelection.options?.fastMode).toBe(true);
  });

  it("rejects payloads without runtime mode", () => {
    expect(() =>
      decodeProviderSessionStartInput({
        threadId: "thread-1",
        provider: "pi",
      }),
    ).toThrow();
  });

  it("accepts pi runtime knobs (thinking, effort)", () => {
    const parsed = decodeProviderSessionStartInput({
      threadId: "thread-1",
      provider: "pi",
      cwd: "/tmp/workspace",
      modelSelection: {
        provider: "pi",
        model: "claude-sonnet-4-6",
        options: {
          thinking: true,
          effort: "max",
          fastMode: true,
        },
      },
      runtimeMode: "full-access",
    });
    expect(parsed.provider).toBe("pi");
    expect(parsed.modelSelection?.provider).toBe("pi");
    expect(parsed.modelSelection?.model).toBe("claude-sonnet-4-6");
    if (parsed.modelSelection?.provider !== "pi") {
      throw new Error("Expected pi modelSelection");
    }
    expect(parsed.modelSelection.options?.thinking).toBe(true);
    expect(parsed.modelSelection.options?.effort).toBe("max");
    expect(parsed.modelSelection.options?.fastMode).toBe(true);
    expect(parsed.runtimeMode).toBe("full-access");
  });
});

describe("ProviderSendTurnInput", () => {
  it("accepts pi modelSelection", () => {
    const parsed = decodeProviderSendTurnInput({
      threadId: "thread-1",
      modelSelection: {
        provider: "pi",
        model: "gpt-5.3-codex",
        options: {
          reasoningEffort: "xhigh",
          fastMode: true,
        },
      },
    });

    expect(parsed.modelSelection?.provider).toBe("pi");
    expect(parsed.modelSelection?.model).toBe("gpt-5.3-codex");
    if (parsed.modelSelection?.provider !== "pi") {
      throw new Error("Expected pi modelSelection");
    }
    expect(parsed.modelSelection.options?.reasoningEffort).toBe("xhigh");
    expect(parsed.modelSelection.options?.fastMode).toBe(true);
  });

  it("accepts pi modelSelection including ultrathink effort", () => {
    const parsed = decodeProviderSendTurnInput({
      threadId: "thread-1",
      modelSelection: {
        provider: "pi",
        model: "claude-sonnet-4-6",
        options: {
          effort: "ultrathink",
          fastMode: true,
        },
      },
    });

    expect(parsed.modelSelection?.provider).toBe("pi");
    if (parsed.modelSelection?.provider !== "pi") {
      throw new Error("Expected pi modelSelection");
    }
    expect(parsed.modelSelection.options?.effort).toBe("ultrathink");
    expect(parsed.modelSelection.options?.fastMode).toBe(true);
  });
});
