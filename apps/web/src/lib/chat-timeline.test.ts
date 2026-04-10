import type { GlassSessionItem } from "@glass/contracts";
import { describe, expect, it } from "vitest";

import { buildChatRows } from "./chat-timeline";

function assistant(id: string, content: Array<Record<string, unknown>>): GlassSessionItem {
  return {
    id,
    message: {
      role: "assistant",
      content,
    },
  };
}

describe("buildChatRows", () => {
  it("renders thinking blocks as full assistant transcript rows", () => {
    const rows = buildChatRows([
      assistant("assistant-1", [
        { type: "text", text: "Visible " },
        { type: "thinking", thinking: "deep reasoning here", summary: "Reasoning" },
        { type: "text", text: "reply" },
      ]),
      assistant("assistant-2", [{ type: "thinking", thinking: "internal only" }]),
    ]);

    expect(rows).toEqual([
      {
        id: "assistant-1:a:0",
        kind: "assistant",
        text: "Visible",
      },
      {
        id: "assistant-1:a:1",
        kind: "assistant",
        text: "deep reasoning here",
      },
      {
        id: "assistant-1:a:2",
        kind: "assistant",
        text: "reply",
      },
      {
        id: "assistant-2:a:3",
        kind: "assistant",
        text: "internal only",
      },
    ]);
  });

  it("includes thinking text in plain custom content", () => {
    const rows = buildChatRows([
      {
        id: "custom-1",
        message: {
          role: "custom",
          customType: "note",
          content: [
            { type: "thinking", thinking: "reasoning" },
            { type: "text", text: "Shown" },
          ],
          display: true,
        },
      },
    ]);

    expect(rows).toEqual([
      {
        id: "custom-1",
        kind: "custom",
        name: "note",
        text: "reasoningShown",
      },
    ]);
  });
});
