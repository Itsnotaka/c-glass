import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  OrchestrationReadModel,
  ProviderRuntimeEvent,
  ProviderSession,
} from "@glass/contracts";
import {
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  EventId,
  ProjectId,
  PROVIDER_NOTICE_KIND,
  ThreadId,
  TurnId,
} from "@glass/contracts";
import { Effect, Exit, Layer, ManagedRuntime, PubSub, Scope, Stream } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { ServerConfig } from "../../config.ts";
import { OrchestrationCommandReceiptRepositoryLive } from "../../persistence/Layers/OrchestrationCommandReceipts.ts";
import { OrchestrationEventStoreLive } from "../../persistence/Layers/OrchestrationEventStore.ts";
import { OrchestrationProjectionSnapshotQueryLive } from "./ProjectionSnapshotQuery.ts";
import { OrchestrationProjectionPipelineLive } from "./ProjectionPipeline.ts";
import { SqlitePersistenceMemory } from "../../persistence/Layers/Sqlite.ts";
import {
  ProviderService,
  type ProviderServiceShape,
} from "../../provider/Services/ProviderService.ts";
import { OrchestrationEngineLive } from "./OrchestrationEngine.ts";
import {
  OrchestrationEngineService,
  type OrchestrationEngineShape,
} from "../Services/OrchestrationEngine.ts";
import { ProviderRuntimeIngestionLive } from "./ProviderRuntimeIngestion.ts";
import { ProviderRuntimeIngestionService } from "../Services/ProviderRuntimeIngestion.ts";
import { ServerSettingsService } from "../../serverSettings.ts";
import * as NodeServices from "@effect/platform-node/NodeServices";

const pid = (value: string) => ProjectId.makeUnsafe(value);
const eid = (value: string) => EventId.makeUnsafe(value);
const tid = (value: string) => ThreadId.makeUnsafe(value);
const turn = (value: string) => TurnId.makeUnsafe(value);

function makeProvider() {
  const pub = Effect.runSync(PubSub.unbounded<ProviderRuntimeEvent>());
  const sessions: ProviderSession[] = [];

  const die = () => Effect.die(new Error("Unsupported provider call in test")) as never;
  const svc: ProviderServiceShape = {
    startSession: () => die(),
    sendTurn: () => die(),
    interruptTurn: () => die(),
    respondToRequest: () => die(),
    respondToUserInput: () => die(),
    stopSession: () => die(),
    listSessions: () => Effect.succeed([...sessions]),
    getCapabilities: () => Effect.succeed({ sessionModelSwitch: "in-session" }),
    rollbackConversation: () => die(),
    get streamEvents() {
      return Stream.fromPubSub(pub);
    },
  };

  return {
    svc,
    emit: (event: ProviderRuntimeEvent) => Effect.runSync(PubSub.publish(pub, event)),
    set: (session: ProviderSession) => {
      const idx = sessions.findIndex((item) => item.threadId === session.threadId);
      if (idx >= 0) {
        sessions[idx] = session;
        return;
      }
      sessions.push(session);
    },
  };
}

async function waitFor(
  engine: OrchestrationEngineShape,
  test: (thread: TestThread) => boolean,
  timeout = 2_000,
) {
  const end = Date.now() + timeout;
  const poll = async (): Promise<TestThread> => {
    const model = await Effect.runPromise(engine.getReadModel());
    const thread = model.threads.find((item) => item.id === tid("thread-1"));
    if (thread && test(thread)) {
      return thread;
    }
    if (Date.now() >= end) {
      throw new Error("Timed out waiting for thread state");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
    return poll();
  };
  return poll();
}

type TestThread = OrchestrationReadModel["threads"][number];

describe("ProviderRuntimeIngestion", () => {
  let runtime: ManagedRuntime.ManagedRuntime<
    OrchestrationEngineService | ProviderRuntimeIngestionService,
    unknown
  > | null = null;
  let scope: Scope.Closeable | null = null;
  const dirs: string[] = [];

  function dir(prefix: string) {
    const next = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    dirs.push(next);
    return next;
  }

  afterEach(async () => {
    if (scope) {
      await Effect.runPromise(Scope.close(scope, Exit.void));
    }
    scope = null;

    if (runtime) {
      await runtime.dispose();
    }
    runtime = null;

    for (const item of dirs.splice(0)) {
      fs.rmSync(item, { recursive: true, force: true });
    }
  });

  async function make() {
    const root = dir("glass-provider-runtime-");
    fs.mkdirSync(path.join(root, ".git"));

    const provider = makeProvider();
    const orch = OrchestrationEngineLive.pipe(
      Layer.provide(OrchestrationProjectionSnapshotQueryLive),
      Layer.provide(OrchestrationProjectionPipelineLive),
      Layer.provide(OrchestrationEventStoreLive),
      Layer.provide(OrchestrationCommandReceiptRepositoryLive),
      Layer.provide(SqlitePersistenceMemory),
    );
    const layer = ProviderRuntimeIngestionLive.pipe(
      Layer.provideMerge(orch),
      Layer.provideMerge(SqlitePersistenceMemory),
      Layer.provideMerge(Layer.succeed(ProviderService, provider.svc)),
      Layer.provideMerge(ServerSettingsService.layerTest()),
      Layer.provideMerge(ServerConfig.layerTest(process.cwd(), process.cwd())),
      Layer.provideMerge(NodeServices.layer),
    );

    runtime = ManagedRuntime.make(layer);
    const engine = await runtime.runPromise(Effect.service(OrchestrationEngineService));
    const ingest = await runtime.runPromise(Effect.service(ProviderRuntimeIngestionService));
    scope = await Effect.runPromise(Scope.make("sequential"));
    await Effect.runPromise(ingest.start().pipe(Scope.provide(scope)));

    const now = new Date().toISOString();
    await Effect.runPromise(
      engine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe("cmd-project-create"),
        projectId: pid("project-1"),
        title: "Project",
        workspaceRoot: root,
        defaultModelSelection: {
          provider: "claudeAgent",
          model: "claude-sonnet-4-6",
        },
        createdAt: now,
      }),
    );
    await Effect.runPromise(
      engine.dispatch({
        type: "thread.create",
        commandId: CommandId.makeUnsafe("cmd-thread-create"),
        threadId: tid("thread-1"),
        projectId: pid("project-1"),
        title: "Thread",
        modelSelection: {
          provider: "claudeAgent",
          model: "claude-sonnet-4-6",
        },
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        runtimeMode: "full-access",
        branch: null,
        worktreePath: null,
        createdAt: now,
      }),
    );
    await Effect.runPromise(
      engine.dispatch({
        type: "thread.session.set",
        commandId: CommandId.makeUnsafe("cmd-thread-session-set"),
        threadId: tid("thread-1"),
        session: {
          threadId: tid("thread-1"),
          status: "ready",
          providerName: "claudeAgent",
          runtimeMode: "full-access",
          activeTurnId: null,
          updatedAt: now,
          lastError: null,
        },
        createdAt: now,
      }),
    );

    provider.set({
      provider: "claudeAgent",
      status: "ready",
      runtimeMode: "full-access",
      threadId: tid("thread-1"),
      createdAt: now,
      updatedAt: now,
    });

    return {
      engine,
      emit: provider.emit,
      drain: () => Effect.runPromise(ingest.drain),
    };
  }

  it("ignores Claude overage rejections when the main status is still allowed", async () => {
    const harness = await make();

    harness.emit({
      type: "account.rate-limits.updated",
      eventId: eid("evt-rate-soft"),
      provider: "claudeAgent",
      threadId: tid("thread-1"),
      turnId: turn("turn-1"),
      createdAt: "2026-04-10T23:41:55.530Z",
      payload: {
        rateLimits: {
          type: "rate_limit_event",
          rate_limit_info: {
            status: "allowed",
            resetsAt: 1775876400,
            rateLimitType: "five_hour",
            overageStatus: "rejected",
            overageDisabledReason: "org_level_disabled",
            isUsingOverage: false,
          },
          uuid: "rate-soft",
          session_id: "session-soft",
        },
      },
    });

    await harness.drain();
    const model = await Effect.runPromise(harness.engine.getReadModel());
    const thread = model.threads.find((item) => item.id === tid("thread-1"));

    expect(thread?.activities.some((item) => item.id === "evt-rate-soft")).toBe(false);
  });

  it("stores a notice when Claude reports a rejected rate-limit status", async () => {
    const harness = await make();

    harness.emit({
      type: "account.rate-limits.updated",
      eventId: eid("evt-rate-hard"),
      provider: "claudeAgent",
      threadId: tid("thread-1"),
      turnId: turn("turn-1"),
      createdAt: "2026-04-10T23:41:55.530Z",
      payload: {
        rateLimits: {
          type: "rate_limit_event",
          rate_limit_info: {
            status: "rejected",
            resetsAt: 1775876400,
            rateLimitType: "five_hour",
          },
          uuid: "rate-hard",
          session_id: "session-hard",
        },
      },
    });

    const thread = await waitFor(harness.engine, (item) =>
      item.activities.some((entry) => entry.id === "evt-rate-hard"),
    );
    const activity = thread.activities.find((item) => item.id === "evt-rate-hard");
    const payload =
      activity?.payload && typeof activity.payload === "object"
        ? (activity.payload as Record<string, unknown>)
        : undefined;

    expect(activity?.kind).toBe(PROVIDER_NOTICE_KIND.rateLimit);
    expect(payload?.title).toBe("Claude rate limit reached");
    expect(payload?.until).toBe("2026-04-11T03:00:00.000Z");
  });
});
