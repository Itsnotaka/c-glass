import { describe, expect, it } from "vitest";

import { shouldWarnSubscriptionDisconnect } from "./ws-transport";

describe("shouldWarnSubscriptionDisconnect", () => {
  it("skips warnings for socket read disconnects", () => {
    expect(shouldWarnSubscriptionDisconnect("SocketReadError: An error occurred during Read")).toBe(
      false,
    );
  });

  it("skips warnings for websocket connection failures", () => {
    expect(
      shouldWarnSubscriptionDisconnect("Unable to connect to the Glass server WebSocket."),
    ).toBe(false);
  });

  it("keeps warnings for unexpected stream failures", () => {
    expect(shouldWarnSubscriptionDisconnect(new Error("boom"))).toBe(true);
  });
});
