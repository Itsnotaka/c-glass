import { describe, expect, it } from "vitest";

import { resolveRouteThreadId } from "./use-route-thread-id";

describe("resolveRouteThreadId", () => {
  it("prefers the pending thread match during navigation", () => {
    expect(resolveRouteThreadId({ threadId: "old" }, { threadId: "next" })).toBe("next");
  });

  it("uses the current thread match when no navigation is pending", () => {
    expect(resolveRouteThreadId({ threadId: "cur" }, false)).toBe("cur");
  });

  it("clears the thread when the current route is not a thread route", () => {
    expect(resolveRouteThreadId(false, false)).toBeNull();
  });
});
