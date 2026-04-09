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
  it("preserves assistant thinking blocks alongside visible text", () => {
    const rows = buildChatRows([
      assistant("assistant-1", [
        { type: "text", text: "Visible " },
        { type: "thinking", thinking: "hidden", summary: "Reasoning" },
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
        id: "assistant-1:t:1",
        kind: "thinking",
        text: "hidden",
        summary: "Reasoning",
      },
      {
        id: "assistant-1:a:2",
        kind: "assistant",
        text: "reply",
      },
      {
        id: "assistant-2:t:3",
        kind: "thinking",
        text: "internal only",
        summary: null,
      },
    ]);
  });

  it("drops thinking blocks from plain custom content", () => {
    const rows = buildChatRows([
      {
        id: "custom-1",
        message: {
          role: "custom",
          customType: "note",
          content: [
            { type: "thinking", thinking: "hidden" },
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
        text: "Shown",
      },
    ]);
  });
});
