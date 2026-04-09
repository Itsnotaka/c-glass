import type {
  GlassWorkingSnapshot,
  GlassWorkingState,
  GlassWorkingUpdate,
  ProviderRuntimeEvent,
} from "@glass/contracts";
import { isToolLifecycleItemType } from "@glass/contracts";
import { Effect, Layer, PubSub, Ref, Stream } from "effect";

import { ProviderService } from "../../provider/Services/ProviderService.ts";
import { WorkingState, type WorkingStateShape } from "../Services/WorkingState.ts";

type Work = {
  snap: GlassWorkingState;
  sum: Map<number, string>;
};

function make(evt: ProviderRuntimeEvent): Work {
  return {
    snap: {
      threadId: evt.threadId,
      turnId: evt.turnId ?? null,
      provider: evt.provider,
      status: "running",
      startedAt: evt.createdAt,
      updatedAt: evt.createdAt,
      summary: null,
      text: "",
      tool: null,
      task: null,
    },
    sum: new Map(),
  };
}

function touch(cur: Work, evt: ProviderRuntimeEvent): Work {
  return {
    ...cur,
    snap: {
      ...cur.snap,
      provider: evt.provider,
      turnId: evt.turnId ?? cur.snap.turnId,
      updatedAt: evt.createdAt,
      status: "running",
    },
  };
}

function ensure(cur: Work | undefined, evt: ProviderRuntimeEvent): Work {
  if (!cur) return make(evt);
  if (evt.turnId && cur.snap.turnId !== null && cur.snap.turnId !== evt.turnId) {
    return make(evt);
  }
  return touch(cur, evt);
}

function join(sum: Map<number, string>) {
  const txt = [...sum.entries()]
    .toSorted((left, right) => left[0] - right[0])
    .map(([, val]) => val.trim())
    .filter((val) => val.length > 0)
    .join("\n\n");
  return txt.length > 0 ? txt : null;
}

function patch(cur: Work, evt: ProviderRuntimeEvent, delta: Partial<GlassWorkingState>): Work {
  return {
    ...cur,
    snap: {
      ...cur.snap,
      updatedAt: evt.createdAt,
      ...delta,
    },
  };
}

function put(sum: Map<number, string>, idx: number | undefined, delta: string) {
  const key = idx ?? 0;
  return new Map(sum).set(key, `${sum.get(key) ?? ""}${delta}`);
}

function task(
  evt: Extract<ProviderRuntimeEvent, { type: "task.started" | "task.progress" | "task.completed" }>,
) {
  return {
    id: evt.payload.taskId,
    description:
      "description" in evt.payload && typeof evt.payload.description === "string"
        ? evt.payload.description
        : null,
    summary:
      "summary" in evt.payload && typeof evt.payload.summary === "string"
        ? evt.payload.summary
        : null,
  };
}

function tool(
  evt: Extract<ProviderRuntimeEvent, { type: "item.started" | "item.updated" | "item.completed" }>,
) {
  if (!evt.itemId) return null;
  return {
    itemId: evt.itemId,
    title: evt.payload.title ?? null,
    detail: evt.payload.detail ?? null,
  };
}

function reduce(map: ReadonlyMap<string, Work>, evt: ProviderRuntimeEvent) {
  const cur = map.get(evt.threadId);

  switch (evt.type) {
    case "turn.started": {
      const next = new Map(map);
      const val = make(evt);
      next.set(evt.threadId, val);
      return { next, out: { threadId: evt.threadId, working: val.snap } };
    }

    case "turn.completed":
    case "turn.aborted":
    case "session.exited":
    case "runtime.error": {
      if (!cur) return null;
      const next = new Map(map);
      next.delete(evt.threadId);
      return { next, out: { threadId: evt.threadId, working: null } };
    }

    case "session.state.changed": {
      if (
        evt.payload.state === "ready" ||
        evt.payload.state === "stopped" ||
        evt.payload.state === "error"
      ) {
        if (!cur) return null;
        const next = new Map(map);
        next.delete(evt.threadId);
        return { next, out: { threadId: evt.threadId, working: null } };
      }
      return null;
    }

    case "content.delta": {
      if (
        evt.payload.streamKind !== "reasoning_text" &&
        evt.payload.streamKind !== "reasoning_summary_text"
      ) {
        return null;
      }
      const base = ensure(cur, evt);
      const val =
        evt.payload.streamKind === "reasoning_text"
          ? patch(base, evt, { text: `${base.snap.text}${evt.payload.delta}` })
          : (() => {
              const sum = put(base.sum, evt.payload.summaryIndex, evt.payload.delta);
              return {
                ...patch(base, evt, { summary: join(sum) }),
                sum,
              };
            })();
      const next = new Map(map);
      next.set(evt.threadId, val);
      return { next, out: { threadId: evt.threadId, working: val.snap } };
    }

    case "task.started":
    case "task.progress":
    case "task.completed": {
      const base = ensure(cur, evt);
      const row = task(evt);
      const val = patch(base, evt, {
        task: row,
        summary:
          base.sum.size > 0
            ? base.snap.summary
            : (row.summary ?? base.snap.summary ?? row.description ?? null),
      });
      const next = new Map(map);
      next.set(evt.threadId, val);
      return { next, out: { threadId: evt.threadId, working: val.snap } };
    }

    case "item.started":
    case "item.updated":
    case "item.completed": {
      if (!isToolLifecycleItemType(evt.payload.itemType)) {
        return null;
      }
      const base = ensure(cur, evt);
      const row = tool(evt);
      if (!row) {
        return null;
      }
      const val =
        evt.type === "item.completed" && base.snap.tool?.itemId === row.itemId
          ? patch(base, evt, { tool: null })
          : patch(base, evt, { tool: row });
      const next = new Map(map);
      next.set(evt.threadId, val);
      return { next, out: { threadId: evt.threadId, working: val.snap } };
    }

    default:
      return null;
  }
}

export const WorkingStateLive = Layer.effect(
  WorkingState,
  Effect.gen(function* () {
    const provider = yield* ProviderService;
    const pub = yield* Effect.acquireRelease(
      PubSub.unbounded<GlassWorkingUpdate>(),
      PubSub.shutdown,
    );
    const ref = yield* Ref.make(new Map<string, Work>());

    yield* Stream.runForEach(provider.streamEvents, (evt) =>
      Effect.gen(function* () {
        const res = yield* Ref.modify(ref, (map) => {
          const out = reduce(map, evt);
          if (!out) return [null, map] as const;
          return [out.out, out.next] as const;
        });
        if (!res) return;
        yield* PubSub.publish(pub, res).pipe(Effect.asVoid);
      }),
    ).pipe(Effect.forkScoped);

    return {
      getSnapshot: Ref.get(ref).pipe(
        Effect.map(
          (map): GlassWorkingSnapshot =>
            [...map.values()]
              .map((item) => item.snap)
              .toSorted((left, right) => left.updatedAt.localeCompare(right.updatedAt)),
        ),
      ),
      get streamChanges() {
        return Stream.fromPubSub(pub);
      },
    } satisfies WorkingStateShape;
  }),
);
