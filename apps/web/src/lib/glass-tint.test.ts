import { describe, expect, it } from "vitest";

import { glassTintPreviewCss } from "./glass-tint";

describe("glassTintPreviewCss", () => {
  it("returns oklch()", () => {
    expect(glassTintPreviewCss(180, 50)).toMatch(/^oklch\(/);
  });
});
