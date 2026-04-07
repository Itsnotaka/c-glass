import type { GlassSessionSummary } from "@glass/contracts";
import { describe, expect, it } from "vitest";

import { buildWorkspaceThreadSections } from "./glass-view-model";

function sum(
  item: Pick<GlassSessionSummary, "id" | "cwd" | "modifiedAt"> & Partial<GlassSessionSummary>,
): GlassSessionSummary {
  return {
    id: item.id,
    harness: item.harness ?? "pi",
    path: item.path ?? `/tmp/${item.id}.jsonl`,
    cwd: item.cwd,
    name: item.name ?? null,
    createdAt: item.createdAt ?? "2026-04-01T00:00:00.000Z",
    modifiedAt: item.modifiedAt,
    messageCount: item.messageCount ?? 0,
    firstMessage: item.firstMessage ?? "",
    allMessagesText: item.allMessagesText ?? "",
    isStreaming: item.isStreaming ?? false,
  };
}

describe("buildWorkspaceThreadSections", () => {
  it("keeps empty sessions visible and orders the current workspace first", () => {
    const sums = {
      a: sum({
        id: "a",
        cwd: "/Users/test/.pi",
        modifiedAt: "2026-04-01T00:00:00.000Z",
        messageCount: 1,
        firstMessage: "hello",
      }),
      b: sum({
        id: "b",
        cwd: "/Users/test/lab",
        modifiedAt: "2026-04-02T00:00:00.000Z",
      }),
    };

    const sections = buildWorkspaceThreadSections(sums, "/Users/test/lab", "/Users/test");

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      cwd: "/Users/test/lab",
      active: true,
      ids: ["b"],
    });
    expect(sections[1]).toMatchObject({
      cwd: "/Users/test/.pi",
      active: false,
      ids: ["a"],
    });
  });
});
