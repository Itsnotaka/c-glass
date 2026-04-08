import { EventId, PROVIDER_NOTICE_KIND, type OrchestrationThreadActivity } from "@glass/contracts";
import { describe, expect, it } from "vitest";

import { shouldShowActivity } from "./session-logic";

function act(kind: OrchestrationThreadActivity["kind"]): OrchestrationThreadActivity {
  return {
    id: EventId.makeUnsafe(`evt:${kind}`),
    tone: "info",
    kind,
    summary: "Activity",
    payload: {},
    turnId: null,
    createdAt: "2026-04-08T00:00:00.000Z",
  };
}

describe("shouldShowActivity", () => {
  it("hides runtime warnings from the transcript", () => {
    expect(shouldShowActivity(act("runtime.warning"))).toBe(false);
  });

  it("hides provider notices from the transcript", () => {
    expect(shouldShowActivity(act(PROVIDER_NOTICE_KIND.rateLimit))).toBe(false);
  });

  it("keeps normal tool lifecycle rows visible", () => {
    expect(shouldShowActivity(act("tool.completed"))).toBe(true);
  });
});
