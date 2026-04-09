import { EventId, PROVIDER_NOTICE_KIND, type OrchestrationThreadActivity } from "@glass/contracts";
import { describe, expect, it } from "vitest";

import { derivePendingUserInputs, shouldShowActivity } from "./session-logic";

function act(kind: OrchestrationThreadActivity["kind"]): OrchestrationThreadActivity {
  return {
    id: EventId.make(`evt:${kind}`),
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

describe("derivePendingUserInputs", () => {
  it("drops stale pending requests when provider failure uses user input wording", () => {
    const requested: OrchestrationThreadActivity = {
      id: EventId.make("evt:user-input.requested"),
      tone: "info",
      kind: "user-input.requested",
      summary: "User input requested",
      payload: {
        requestId: "req-1",
        questions: [
          {
            id: "q-1",
            header: "Question",
            question: "Pick one",
            options: [{ label: "A", description: "A" }],
          },
        ],
      },
      turnId: null,
      createdAt: "2026-04-08T00:00:00.000Z",
    };
    const failed: OrchestrationThreadActivity = {
      id: EventId.make("evt:provider.user-input.respond.failed"),
      tone: "error",
      kind: "provider.user-input.respond.failed",
      summary: "Provider user input response failed",
      payload: {
        requestId: "req-1",
        detail: "Unknown pending user input request: req-1",
      },
      turnId: null,
      createdAt: "2026-04-08T00:00:01.000Z",
    };

    expect(derivePendingUserInputs([requested, failed])).toEqual([]);
  });
});
