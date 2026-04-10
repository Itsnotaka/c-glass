import { PROVIDER_RUNTIME_EVENT_TYPES } from "@glass/contracts";
import { describe, expect, it } from "vitest";

import { PROVIDER_INTENT_COMPONENTS, PROVIDER_INTENT_ROWS } from "./provider-intent-map";

describe("provider intent map", () => {
  it("covers every provider runtime event type", () => {
    expect(Object.keys(PROVIDER_INTENT_COMPONENTS).toSorted()).toEqual(
      [...PROVIDER_RUNTIME_EVENT_TYPES].toSorted(),
    );
  });

  it("builds one debug row per runtime event type", () => {
    expect(PROVIDER_INTENT_ROWS).toHaveLength(PROVIDER_RUNTIME_EVENT_TYPES.length);
    expect(new Set(PROVIDER_INTENT_ROWS.map((row) => row.eventType)).size).toBe(
      PROVIDER_RUNTIME_EVENT_TYPES.length,
    );
  });
});
