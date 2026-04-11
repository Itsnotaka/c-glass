import {
  EventId,
  PROVIDER_NOTICE_KIND,
  type OrchestrationThreadActivity,
  type ProviderKind,
} from "@glass/contracts";
import { describe, expect, it } from "vitest";

import { deriveProviderNotice, formatNoticeWait } from "./provider-notice";

function act(input: {
  kind: OrchestrationThreadActivity["kind"];
  provider: ProviderKind;
  createdAt?: string;
  until?: string | null;
  raw?: unknown;
}): OrchestrationThreadActivity {
  return {
    id: EventId.makeUnsafe(`evt:${input.kind}:${input.provider}`),
    tone: "info",
    kind: input.kind,
    summary: "Notice",
    payload: {
      provider: input.provider,
      title: "Notice",
      detail: "Detail",
      ...(input.until ? { until: input.until } : {}),
      raw: input.raw ?? {},
    },
    turnId: null,
    createdAt: input.createdAt ?? "2026-04-08T00:00:00.000Z",
  };
}

describe("deriveProviderNotice", () => {
  it("returns an active rate-limit notice when the reset is in the future", () => {
    const item = deriveProviderNotice({
      activities: [
        act({
          kind: PROVIDER_NOTICE_KIND.rateLimit,
          provider: "claudeAgent",
          until: "2026-04-08T00:10:00.000Z",
        }),
      ],
      provider: "claudeAgent",
      now: Date.parse("2026-04-08T00:05:00.000Z"),
    });

    expect(item?.kind).toBe(PROVIDER_NOTICE_KIND.rateLimit);
    expect(item?.provider).toBe("claudeAgent");
  });

  it("drops expired rate-limit notices", () => {
    const item = deriveProviderNotice({
      activities: [
        act({
          kind: PROVIDER_NOTICE_KIND.rateLimit,
          provider: "claudeAgent",
          until: "2026-04-08T00:04:00.000Z",
        }),
      ],
      provider: "claudeAgent",
      now: Date.parse("2026-04-08T00:05:00.000Z"),
    });

    expect(item).toBeNull();
  });

  it("drops stale Claude overage notices when the raw status is still allowed", () => {
    const item = deriveProviderNotice({
      activities: [
        act({
          kind: PROVIDER_NOTICE_KIND.rateLimit,
          provider: "claudeAgent",
          until: "2026-04-08T00:10:00.000Z",
          raw: {
            type: "rate_limit_event",
            rate_limit_info: {
              status: "allowed",
              overageStatus: "rejected",
              overageDisabledReason: "org_level_disabled",
              isUsingOverage: false,
            },
          },
        }),
      ],
      provider: "claudeAgent",
      now: Date.parse("2026-04-08T00:05:00.000Z"),
    });

    expect(item).toBeNull();
  });

  it("prefers rate-limit notices over config notices", () => {
    const item = deriveProviderNotice({
      activities: [
        act({ kind: PROVIDER_NOTICE_KIND.config, provider: "claudeAgent" }),
        act({
          kind: PROVIDER_NOTICE_KIND.rateLimit,
          provider: "claudeAgent",
          until: "2026-04-08T00:10:00.000Z",
        }),
      ],
      provider: "claudeAgent",
      now: Date.parse("2026-04-08T00:05:00.000Z"),
    });

    expect(item?.kind).toBe(PROVIDER_NOTICE_KIND.rateLimit);
  });
});

describe("formatNoticeWait", () => {
  it("formats relative wait text", () => {
    expect(
      formatNoticeWait("2026-04-08T00:10:00.000Z", Date.parse("2026-04-08T00:05:30.000Z")),
    ).toBe("4m 30s");
  });
});
