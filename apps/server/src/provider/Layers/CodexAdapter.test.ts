import {
  EventId,
  ProviderItemId,
  RuntimeItemId,
  ThreadId,
  TurnId,
  type ProviderEvent,
} from "@glass/contracts";
import { describe, expect, it } from "vitest";

import { mapCodexProviderEventToRuntimeEvents } from "./CodexAdapter.ts";

const threadId = ThreadId.make("thread-codex");
const turnId = TurnId.make("turn-codex");
const itemId = ProviderItemId.make("item-codex");

function evt(method: string, payload: unknown): ProviderEvent {
  return {
    id: EventId.make(`event:${method}`),
    kind: "notification",
    provider: "codex",
    threadId,
    createdAt: "2026-04-09T04:00:00.000Z",
    method,
    payload,
  };
}

describe("mapCodexProviderEventToRuntimeEvents", () => {
  it("recovers reasoning delta ids and indexes from nested codex msg payloads", () => {
    const events = mapCodexProviderEventToRuntimeEvents(
      evt("item/reasoning/textDelta", {
        msg: {
          turn_id: turnId,
          item_id: itemId,
          delta: "Inspect",
          content_index: 2,
        },
      }),
      threadId,
    );

    expect(events).toEqual([
      {
        eventId: EventId.make("event:item/reasoning/textDelta"),
        provider: "codex",
        threadId,
        createdAt: "2026-04-09T04:00:00.000Z",
        turnId,
        itemId: RuntimeItemId.make(itemId),
        providerRefs: {
          providerTurnId: turnId,
          providerItemId: itemId,
        },
        raw: {
          source: "codex.app-server.notification",
          method: "item/reasoning/textDelta",
          payload: {
            msg: {
              turn_id: turnId,
              item_id: itemId,
              delta: "Inspect",
              content_index: 2,
            },
          },
        },
        type: "content.delta",
        payload: {
          streamKind: "reasoning_text",
          delta: "Inspect",
          contentIndex: 2,
        },
      },
    ]);
  });

  it("recovers summary deltas from nested item reasoning payloads", () => {
    const events = mapCodexProviderEventToRuntimeEvents(
      evt("item/reasoning/summaryTextDelta", {
        msg: {
          turn_id: turnId,
          item_id: itemId,
          delta: "Plan first",
          summary_index: 1,
        },
      }),
      threadId,
    );

    expect(events[0]?.turnId).toBe(turnId);
    expect(events[0]?.itemId).toBe(RuntimeItemId.make(itemId));
    expect(events[0]?.type).toBe("content.delta");
    expect(events[0]?.payload).toEqual({
      streamKind: "reasoning_summary_text",
      delta: "Plan first",
      summaryIndex: 1,
    });
  });

  it("recovers codex reasoning content deltas from nested msg payloads", () => {
    const events = mapCodexProviderEventToRuntimeEvents(
      evt("codex/event/reasoning_content_delta", {
        msg: {
          turn_id: turnId,
          item_id: itemId,
          delta: "Short summary",
          summary_index: 0,
        },
      }),
      threadId,
    );

    expect(events[0]?.turnId).toBe(turnId);
    expect(events[0]?.itemId).toBe(RuntimeItemId.make(itemId));
    expect(events[0]?.type).toBe("content.delta");
    expect(events[0]?.payload).toEqual({
      streamKind: "reasoning_summary_text",
      delta: "Short summary",
      summaryIndex: 0,
    });
  });
});
