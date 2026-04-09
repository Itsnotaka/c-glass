import { describe, expect, it } from "vitest";

import { mirrorSegmentsDraft } from "./composer-search";

describe("mirrorSegmentsDraft", () => {
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
});
