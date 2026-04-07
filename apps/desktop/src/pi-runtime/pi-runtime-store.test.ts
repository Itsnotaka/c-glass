import { describe, expect, it } from "vitest";

import { PiRuntimeStore } from "./pi-runtime-store";

describe("PiRuntimeStore", () => {
  it("builds an empty summary for a new session without crashing", () => {
    const store = new PiRuntimeStore({
      id: "session-1",
      cwd: "/tmp/project",
      file: null,
    });

    expect(store.summary()).toMatchObject({
      id: "session-1",
      cwd: "/tmp/project",
      messageCount: 0,
      firstMessage: "",
      allMessagesText: "",
    });
  });

  it("derives firstMessage from the first defined loaded message", () => {
    const store = new PiRuntimeStore({
      id: "session-2",
      cwd: "/tmp/project",
      file: null,
    });
    const messages: Array<unknown> = [];
    messages.length = 2;
    messages[1] = { role: "user", content: "hello" };

    store.apply({
      type: "session.messages.loaded",
      source: "pi-rpc",
      rawType: "bootstrap",
      rawPayload: messages,
      at: new Date().toISOString(),
      messages,
    } as never);

    expect(store.summary().messageCount).toBe(2);
    expect(store.summary().firstMessage).toBe("hello");
    expect(store.summary().allMessagesText).toBe("hello");
  });
});
