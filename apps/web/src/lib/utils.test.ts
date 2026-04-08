import { afterEach, describe, expect, it } from "vitest";

import { resolveServerUrl } from "./utils";

const original = Object.getOwnPropertyDescriptor(globalThis, "window");

const setWindow = (url?: string) => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      desktopBridge: {
        getWsUrl: () => url ?? null,
      },
      location: {
        origin: "http://localhost:5733",
      },
    },
  });
};

afterEach(() => {
  if (original) {
    Object.defineProperty(globalThis, "window", original);
    return;
  }

  Reflect.deleteProperty(globalThis, "window");
});

describe("resolveServerUrl", () => {
  it("normalizes the desktop websocket url to /ws and preserves the auth token", () => {
    setWindow("ws://127.0.0.1:61353/?token=secret-token");

    expect(resolveServerUrl({ protocol: "ws", pathname: "/ws" })).toBe(
      "ws://127.0.0.1:61353/ws?token=secret-token",
    );
  });

  it("replaces the query string when explicit search params are provided", () => {
    setWindow("ws://127.0.0.1:61353/?token=secret-token");

    expect(
      resolveServerUrl({
        protocol: "ws",
        pathname: "/ws",
        searchParams: { token: "next-token" },
      }),
    ).toBe("ws://127.0.0.1:61353/ws?token=next-token");
  });
});
