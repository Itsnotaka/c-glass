import { describe, expect, it } from "vitest";

import { createEvlogStore } from "./evlog";

describe("createEvlogStore", () => {
  it("keeps the newest entries within the buffer limit", () => {
    const log = createEvlogStore(2);

    log.push("command", "one", { n: 1 });
    log.push("domain", "two", { n: 2 });
    log.push("snapshot", "three", { n: 3 });

    expect(log.list().map((entry) => entry.label)).toEqual(["two", "three"]);
  });

  it("counts entries by kind", () => {
    const log = createEvlogStore();

    log.push("command", "command", {});
    log.push("command-ack", "command-ack", {});
    log.push("domain", "domain", {});
    log.push("domain", "domain", {});

    expect(log.counts()).toEqual({
      command: 1,
      "command-ack": 1,
      domain: 2,
      replay: 0,
      snapshot: 0,
    });
  });
});
