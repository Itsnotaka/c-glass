import { describe, expect, it } from "vitest";

import { assistantBlocks, hasStreamingThinking } from "./assistant-content";

describe("assistantBlocks", () => {
  it("keeps thinking visible while clipping text to the visible assistant transcript", () => {
    expect(
      assistantBlocks({
        text: "",
        content: [
          { type: "thinking", thinking: "Inspect", summary: "Reasoning" },
          { type: "text", text: "Answer" },
        ],
      }),
    ).toEqual([{ type: "thinking", thinking: "Inspect", summary: "Reasoning" }]);

    expect(
      assistantBlocks({
        text: "Answer",
        content: [
          { type: "thinking", thinking: "Inspect", summary: "Reasoning" },
          { type: "text", text: "Answer" },
        ],
      }),
    ).toEqual([
      { type: "thinking", thinking: "Inspect", summary: "Reasoning" },
      { type: "text", text: "Answer" },
    ]);
  });
});

describe("hasStreamingThinking", () => {
  it("matches the latest streaming assistant message", () => {
    expect(
      hasStreamingThinking([
        {
          role: "assistant",
          streaming: true,
          content: [{ type: "thinking", thinking: "Inspect" }],
        },
      ]),
    ).toBe(true);

    expect(
      hasStreamingThinking([
        {
          role: "assistant",
          streaming: true,
          content: [{ type: "thinking", thinking: "Inspect" }],
        },
        {
          role: "assistant",
          streaming: true,
          content: [{ type: "text", text: "Answer" }],
        },
      ]),
    ).toBe(false);
  });
});
