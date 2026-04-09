import { describe, expect, it } from "vitest";

import { resolveRouteThreadId } from "./use-route-thread-id";

describe("resolveRouteThreadId", () => {
  it("reads the thread id when present", () => {
    expect(resolveRouteThreadId({ threadId: "next" })).toBe("next");
  });

  it("trims whitespace around the route thread id", () => {
    expect(resolveRouteThreadId({ threadId: " cur " })).toBe("cur");
  });

  it("clears the thread when params do not include a thread id", () => {
    expect(resolveRouteThreadId({})).toBeNull();
  });
});
