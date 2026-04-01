import { describe, expect, it } from "vitest";
import { getModel } from "@mariozechner/pi-ai";

import { filterPiModels, type PiModelItem } from "./pi-models";

function item(provider: "anthropic" | "openai-codex", id: string): PiModelItem {
  const model =
    provider === "anthropic"
      ? getModel("anthropic", id as "claude-opus-4-5" | "claude-opus-4-6")
      : getModel("openai-codex", id as "gpt-5.4" | "gpt-5.2-codex");

  return {
    key: `${model.provider}/${model.id}`,
    provider: model.provider,
    id: model.id,
    name: model.name ?? model.id,
    model,
  };
}

describe("filterPiModels", () => {
  const items = [
    item("anthropic", "claude-opus-4-5"),
    item("anthropic", "claude-opus-4-6"),
    item("openai-codex", "gpt-5.4"),
    item("openai-codex", "gpt-5.2-codex"),
  ];

  it("matches the Pi TUI fuzzy filter semantics", () => {
    const out = filterPiModels(items, "opus 46");

    expect(out.map((item) => item.id)).toEqual(["claude-opus-4-6"]);
  });

  it("matches across provider and model id tokens", () => {
    const out = filterPiModels(items, "openai 54");

    expect(out.map((item) => item.id)).toEqual(["gpt-5.4"]);
  });

  it("supports swapped alpha numeric queries like the TUI filter", () => {
    const out = filterPiModels(items, "54gpt");

    expect(out[0]?.id).toBe("gpt-5.4");
  });
});
