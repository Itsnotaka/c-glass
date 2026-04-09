import type { OrchestrationEvent } from "@glass/contracts";
import { MessageId, ProjectId, ThreadId, TurnId } from "@glass/contracts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createEmptyReadModel, projectEvent } from "./projector";

const projectId = ProjectId.make("project-thinking");
const threadId = ThreadId.make("thread-thinking");
const turnId = TurnId.make("turn-thinking");
const messageId = MessageId.make("assistant:turn-thinking");

function stamp(seq: number) {
  return new Date(Date.UTC(2026, 1, 28, 19, 0, seq)).toISOString();
}

function evt<T extends OrchestrationEvent["type"]>(
  type: T,
  payload: Extract<OrchestrationEvent, { type: T }>["payload"],
  seq: number,
): Extract<OrchestrationEvent, { type: T }> {
  return {
    sequence: seq,
    eventId: `event-${seq}`,
    aggregateKind: "thread",
    aggregateId: threadId,
    occurredAt: stamp(seq),
    commandId: null,
    causationEventId: null,
    correlationId: null,
    metadata: {},
    type,
    payload,
  } as Extract<OrchestrationEvent, { type: T }>;
}

function created(seq = 1) {
  return evt(
    "thread.created",
    {
      threadId,
      projectId,
      title: "Thinking",
      modelSelection: {
        provider: "codex",
        model: "gpt-5.4",
      },
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: null,
      worktreePath: null,
      createdAt: stamp(seq),
      updatedAt: stamp(seq),
    },
    seq,
  );
}

function sent(
  seq: number,
  payload: Partial<Extract<OrchestrationEvent, { type: "thread.message-sent" }>["payload"]>,
) {
  return evt(
    "thread.message-sent",
    {
      threadId,
      messageId,
      role: "assistant",
      text: "",
      turnId,
      streaming: true,
      createdAt: stamp(2),
      updatedAt: stamp(seq),
      ...payload,
    },
    seq,
  );
}

function apply(events: ReadonlyArray<OrchestrationEvent>) {
  let model = createEmptyReadModel(stamp(0));
  for (const event of events) {
    model = Effect.runSync(projectEvent(model, event));
  }
  return model;
}

describe("projectEvent", () => {
  it("preserves reasoning when it arrives before assistant text", () => {
    const model = apply([
      created(),
      sent(2, {
        content: [{ type: "thinking", thinking: "Inspect" }],
      }),
      sent(3, {
        text: "Answer",
        content: [
          { type: "thinking", thinking: "Inspect" },
          { type: "text", text: "Answer" },
        ],
      }),
    ]);

    expect(model.threads[0]?.messages).toEqual([
      {
        id: messageId,
        role: "assistant",
        text: "Answer",
        content: [
          { type: "thinking", thinking: "Inspect" },
          { type: "text", text: "Answer" },
        ],
        turnId,
        streaming: true,
        createdAt: stamp(2),
        updatedAt: stamp(3),
      },
    ]);
  });

  it("updates the thinking summary without dropping prior reasoning text", () => {
    const model = apply([
      created(),
      sent(2, {
        content: [{ type: "thinking", thinking: "Inspect", summary: "Phase 1" }],
      }),
      sent(3, {
        content: [{ type: "thinking", thinking: "Inspect", summary: "Phase 1\n\nPhase 2" }],
      }),
    ]);

    expect(model.threads[0]?.messages[0]?.content).toEqual([
      {
        type: "thinking",
        thinking: "Inspect",
        summary: "Phase 1\n\nPhase 2",
      },
    ]);
  });

  it("keeps structured reasoning content after assistant completion", () => {
    const model = apply([
      created(),
      sent(2, {
        text: "Answer",
        content: [
          { type: "thinking", thinking: "Inspect", summary: "Reasoning" },
          { type: "text", text: "Answer" },
        ],
      }),
      sent(3, {
        text: "",
        streaming: false,
      }),
    ]);

    expect(model.threads[0]?.messages[0]).toEqual({
      id: messageId,
      role: "assistant",
      text: "Answer",
      content: [
        { type: "thinking", thinking: "Inspect", summary: "Reasoning" },
        { type: "text", text: "Answer" },
      ],
      turnId,
      streaming: false,
      createdAt: stamp(2),
      updatedAt: stamp(3),
    });
  });
});
