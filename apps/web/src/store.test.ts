import type { OrchestrationEvent, OrchestrationReadModel } from "@glass/contracts";
import { MessageId, ProjectId, ThreadId, TurnId } from "@glass/contracts";
import { describe, expect, it } from "vitest";

import { applyOrchestrationEvent, syncServerReadModel, type AppState } from "./store";

const projectId = ProjectId.makeUnsafe("project-store");
const threadId = ThreadId.makeUnsafe("thread-store");
const turnId = TurnId.makeUnsafe("turn-store");
const messageId = MessageId.makeUnsafe("assistant:turn-store");

function stamp(seq: number) {
  return new Date(Date.UTC(2026, 1, 28, 20, 0, seq)).toISOString();
}

function baseState(): AppState {
  return {
    projects: [],
    threads: [],
    sidebarThreadsById: {},
    threadIdsByProjectId: {},
    bootstrapComplete: false,
  };
}

function baseReadModel(
  messages: NonNullable<OrchestrationReadModel["threads"][number]>["messages"] = [],
): OrchestrationReadModel {
  return {
    snapshotSequence: 1,
    updatedAt: stamp(1),
    projects: [
      {
        id: projectId,
        title: "Store",
        workspaceRoot: "/tmp/store",
        defaultModelSelection: null,
        scripts: [],
        createdAt: stamp(1),
        updatedAt: stamp(1),
        deletedAt: null,
      },
    ],
    threads: [
      {
        id: threadId,
        projectId,
        title: "Thread",
        modelSelection: {
          provider: "codex",
          model: "gpt-5.4",
        },
        runtimeMode: "full-access",
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        latestTurn: null,
        createdAt: stamp(1),
        updatedAt: stamp(1),
        archivedAt: null,
        deletedAt: null,
        messages,
        proposedPlans: [],
        activities: [],
        checkpoints: [],
        session: null,
      },
    ],
  };
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

describe("store assistant content", () => {
  it("keeps structured reasoning content when bootstrapping from a snapshot", () => {
    const state = syncServerReadModel(
      baseState(),
      baseReadModel([
        {
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
        },
      ]),
    );

    expect(state.threads[0]?.messages[0]?.content).toEqual([
      { type: "thinking", thinking: "Inspect", summary: "Reasoning" },
      { type: "text", text: "Answer" },
    ]);
  });

  it("marks streamed thinking on the active assistant message", () => {
    const state = syncServerReadModel(baseState(), baseReadModel());
    const next = applyOrchestrationEvent(
      state,
      evt(
        "thread.message-sent",
        {
          threadId,
          messageId,
          role: "assistant",
          text: "",
          content: [{ type: "thinking", thinking: "Inspect", summary: "Reasoning" }],
          turnId,
          streaming: true,
          createdAt: stamp(2),
          updatedAt: stamp(2),
        },
        2,
      ),
    );

    const msg = next.threads[0]?.messages[0];
    expect(msg?.content).toEqual([{ type: "thinking", thinking: "Inspect", summary: "Reasoning" }]);
  });
});
