import { describe, expect, it } from "vitest";

import { clearSlash, mirrorSegmentsDraft, pendingSlash, slashPrefix } from "./composer-search";

describe("mirrorSegmentsDraft", () => {
  it("finds a bare slash token even when the cursor is no longer at the end", () => {
    expect(pendingSlash("/pla", 0)).toEqual({
      query: "pla",
      start: 0,
      end: 4,
    });
  });

  it("renders tracked skills as skill segments", () => {
    expect(
      mirrorSegmentsDraft("/tailwind build", [
        { kind: "skill", start: 0, end: "/tailwind".length },
      ]),
    ).toEqual([
      {
        kind: "skill",
        text: "/tailwind",
        start: 0,
        end: 9,
      },
      {
        kind: "plain",
        text: " build",
        start: 9,
        end: 15,
      },
    ]);
  });

  it("renders an in-progress slash query as a slash segment", () => {
    expect(mirrorSegmentsDraft("/tai", [{ kind: "slash", start: 0, end: 4 }])).toEqual([
      {
        kind: "slash",
        text: "/tai",
        start: 0,
        end: 4,
      },
    ]);
  });

  it("finds a trimmed slash token inside surrounding whitespace", () => {
    expect(pendingSlash("  /pla  ", 0)).toEqual({
      query: "pla",
      start: 2,
      end: 6,
    });
  });

  it("does not treat a bare slash as a command prefix match", () => {
    expect(slashPrefix({ query: "", start: 0, end: 1 }, "plan")).toBe(false);
  });

  it("treats a bare @ as plain text", () => {
    expect(mirrorSegmentsDraft("@")).toEqual([
      {
        kind: "plain",
        text: "@",
        start: 0,
        end: 1,
      },
    ]);
  });

  it("keeps @ tokens with content as mentions", () => {
    expect(mirrorSegmentsDraft("@s")).toEqual([
      {
        kind: "mention",
        text: "@s",
        start: 0,
        end: 2,
      },
    ]);
  });

  it("keeps quoted @ paths as mentions", () => {
    expect(mirrorSegmentsDraft('@"foo bar"')).toEqual([
      {
        kind: "mention",
        text: '@"foo bar"',
        start: 0,
        end: 10,
      },
    ]);
  });

  it("keeps mixed skill and mention tokens ordered without overlap", () => {
    expect(
      mirrorSegmentsDraft('/tailwind @"foo bar"', [
        { kind: "skill", start: 0, end: "/tailwind".length },
      ]),
    ).toEqual([
      {
        kind: "skill",
        text: "/tailwind",
        start: 0,
        end: 9,
      },
      {
        kind: "plain",
        text: " ",
        start: 9,
        end: 10,
      },
      {
        kind: "mention",
        text: '@"foo bar"',
        start: 10,
        end: 20,
      },
    ]);
  });

  it("clears an in-progress slash token without touching the rest of the draft", () => {
    expect(clearSlash("/pla hello", { query: "pla", start: 0, end: 4 })).toEqual({
      value: " hello",
      cursor: 0,
    });
  });
});
