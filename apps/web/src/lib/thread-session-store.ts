import type {
  PiConfig,
  GlassSessionActiveEvent,
  GlassSessionDelta,
  GlassSessionSnapshot,
  GlassSessionSummary,
  GlassSessionSummaryEvent,
  ThreadSummary,
  ThreadSummaryEvent,
} from "@glass/contracts";
import { useMemo } from "react";
import { create } from "zustand";
import { readGlass, readGlassBoot } from "../host";

export type ThreadBootStatus = "loading" | "ready" | "error";

function rank(sums: Record<string, GlassSessionSummary>) {
  return Object.values(sums)
    .toSorted((left, right) =>
      left.modifiedAt < right.modifiedAt ? 1 : left.modifiedAt > right.modifiedAt ? -1 : 0,
    )
    .map((item) => item.id);
}

function same(left: GlassSessionSummary | undefined, right: GlassSessionSummary) {
  if (!left) return false;
  return (
    left.id === right.id &&
    left.harness === right.harness &&
    left.path === right.path &&
    left.cwd === right.cwd &&
    left.name === right.name &&
    left.createdAt === right.createdAt &&
    left.modifiedAt === right.modifiedAt &&
    left.messageCount === right.messageCount &&
    left.firstMessage === right.firstMessage &&
    left.allMessagesText === right.allMessagesText &&
    left.isStreaming === right.isStreaming
  );
}

function sync(snap: GlassSessionSnapshot, delta: Exclude<GlassSessionDelta, { type: "sync" }>) {
  return {
    ...snap,
    model: delta.meta.model,
    thinkingLevel: delta.meta.thinkingLevel,
    isStreaming: delta.meta.isStreaming,
    pending: delta.meta.pending,
  } satisfies GlassSessionSnapshot;
}

function patch(snap: GlassSessionSnapshot, delta: GlassSessionDelta) {
  if (delta.type === "sync") return delta.snapshot;

  const next = sync(snap, delta);
  if (delta.type === "meta") return next;
  if (delta.type === "commit") {
    return {
      ...next,
      messages: [...next.messages, delta.item],
      live: null,
    } satisfies GlassSessionSnapshot;
  }
  return {
    ...next,
    live: delta.item,
  } satisfies GlassSessionSnapshot;
}

function flags(cfgStatus: ThreadBootStatus, sumsStatus: ThreadBootStatus) {
  const cfgReady = cfgStatus === "ready";
  const sumsReady = sumsStatus === "ready";
  return {
    cfgReady,
    sumsReady,
    ready: cfgReady && sumsReady,
  };
}

function fromThread(item: ThreadSummary): GlassSessionSummary {
  return {
    id: item.id,
    harness: item.harness,
    path: item.path ?? "",
    cwd: item.cwd,
    name: item.name,
    createdAt: item.createdAt,
    modifiedAt: item.modifiedAt,
    messageCount: item.messageCount,
    firstMessage: item.preview,
    allMessagesText: item.search,
    isStreaming: item.state === "running",
  };
}

export function sumEventFromThread(event: ThreadSummaryEvent): GlassSessionSummaryEvent {
  if (event.type === "remove") {
    return {
      lane: "summary",
      type: "remove",
      sessionId: event.threadId,
    };
  }
  const next = fromThread(event.summary);
  return {
    lane: "summary",
    type: "upsert",
    sessionId: event.threadId,
    summary: next,
  };
}

function issue(err: Error | string | null | undefined) {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return "Unknown Pi boot error";
}

type State = {
  cfg: PiConfig | null;
  cfgStatus: ThreadBootStatus;
  cfgReady: boolean;
  cfgError: string | null;
  ids: string[];
  sums: Record<string, GlassSessionSummary>;
  sumsStatus: ThreadBootStatus;
  sumsReady: boolean;
  sumsError: string | null;
  ready: boolean;
  snaps: Record<string, GlassSessionSnapshot>;
  boot: () => Promise<void>;
  refreshCfg: () => Promise<void>;
  refreshSums: () => Promise<void>;
  resetForWorkspaceChange: () => void;
  applySummaryEvent: (event: GlassSessionSummaryEvent) => void;
  putSnap: (snap: GlassSessionSnapshot) => void;
  applyActs: (events: GlassSessionActiveEvent[]) => void;
};

function setCfg(
  state: State,
  cfg: PiConfig | null,
  status: ThreadBootStatus,
  cfgError: string | null,
) {
  return {
    ...state,
    cfg,
    cfgStatus: status,
    cfgError,
    ...flags(status, state.sumsStatus),
  } satisfies State;
}

function setSums(
  state: State,
  items: GlassSessionSummary[],
  status: ThreadBootStatus,
  sumsError: string | null,
) {
  const sums = Object.fromEntries(items.map((item) => [item.id, item]));
  return {
    ...state,
    sums,
    ids: rank(sums),
    sumsStatus: status,
    sumsError,
    ...flags(state.cfgStatus, status),
  } satisfies State;
}

function setBoot(state: State) {
  const boot = readGlassBoot();
  if (!boot) return state;

  const sums = boot.threads.length > 0 ? boot.threads.map(fromThread) : boot.sessions;

  let next = state;
  next = setCfg(next, boot.pi, "ready", null);
  next = setSums(next, sums, "ready", null);
  return {
    ...next,
    snaps: { ...next.snaps, ...boot.snapshots },
  } satisfies State;
}

let cfgSeq = 0;
let sumsSeq = 0;
let cfgRun: Promise<void> | null = null;
let sumsRun: Promise<void> | null = null;

export const useThreadSessionStore = create<State>()((set, get) => ({
  cfg: null,
  cfgStatus: "loading",
  cfgReady: false,
  cfgError: null,
  ids: [],
  sums: {},
  sumsStatus: "loading",
  sumsReady: false,
  sumsError: null,
  ready: false,
  snaps: {},
  boot: async () => {
    const glass = readGlass();
    const boot = readGlassBoot();
    if (!glass && !boot) {
      set((state) => {
        let next = setCfg(state, null, "ready", null);
        next = setSums(next, [], "ready", null);
        return next;
      });
      return;
    }

    if (boot) {
      set((state) => setBoot(state));
    }

    if (!glass) return;

    await Promise.all([get().refreshCfg(), get().refreshSums()]);
  },
  refreshCfg: async () => {
    const glass = readGlass();
    if (!glass) {
      set((state) => setCfg(state, null, "ready", null));
      return;
    }
    if (cfgRun) return cfgRun;

    const seq = ++cfgSeq;
    cfgRun = glass.pi
      .getConfig()
      .then((cfg) => {
        if (seq !== cfgSeq) return;
        set((state) => setCfg(state, cfg, "ready", null));
      })
      .catch((err) => {
        if (seq !== cfgSeq) return;
        set((state) => (state.cfgReady ? state : setCfg(state, null, "error", issue(err))));
      })
      .finally(() => {
        if (seq !== cfgSeq) return;
        cfgRun = null;
      });

    return cfgRun;
  },
  refreshSums: async () => {
    const glass = readGlass();
    if (!glass) {
      set((state) => setSums(state, [], "ready", null));
      return;
    }
    if (sumsRun) return sumsRun;

    const seq = ++sumsSeq;
    sumsRun = glass.thread
      .listAll()
      .then((items) => {
        if (seq !== sumsSeq) return;
        set((state) => setSums(state, items.map(fromThread), "ready", null));
      })
      .catch((err) => {
        if (seq !== sumsSeq) return;
        set((state) => (state.sumsReady ? state : setSums(state, [], "error", issue(err))));
      })
      .finally(() => {
        if (seq !== sumsSeq) return;
        sumsRun = null;
      });

    return sumsRun;
  },
  resetForWorkspaceChange: () => {
    cfgSeq++;
    cfgRun = null;
    set((state) => setCfg(state, state.cfg, "loading", null));
  },
  applySummaryEvent: (event) => {
    set((state) => {
      if (event.type === "remove") {
        if (!(event.sessionId in state.sums)) return state;
        const sums = { ...state.sums };
        delete sums[event.sessionId];
        return { sums, ids: rank(sums) } satisfies Partial<State>;
      }

      const item = event.summary;
      if (same(state.sums[item.id], item)) return state;
      const sums = { ...state.sums, [item.id]: item };
      return { sums, ids: rank(sums) } satisfies Partial<State>;
    });
  },
  putSnap: (snap) => {
    set((state) => ({
      snaps: { ...state.snaps, [snap.id]: snap },
    }));
  },
  applyActs: (events) => {
    set((state) => {
      const snaps = { ...state.snaps };
      let hit = false;
      for (const event of events) {
        const cur = snaps[event.sessionId];
        if (!cur) {
          if (event.delta.type !== "sync") continue;
          snaps[event.sessionId] = event.delta.snapshot;
          hit = true;
          continue;
        }
        snaps[event.sessionId] = patch(cur, event.delta);
        hit = true;
      }
      if (!hit) return state;
      return { snaps } satisfies Partial<State>;
    });
  },
}));

export const useThreadBootReady = () => useThreadSessionStore((state) => state.ready);
export const usePiCfg = () => useThreadSessionStore((state) => state.cfg);
export const usePiCfgStatus = () => useThreadSessionStore((state) => state.cfgStatus);
export const useThreadIds = () => useThreadSessionStore((state) => state.ids);
export const useThreadSummaries = () => useThreadSessionStore((state) => state.sums);
export const useThreadSummariesStatus = () => useThreadSessionStore((state) => state.sumsStatus);

export function useThreadSummary(sessionId: string | null | undefined) {
  const pick = useMemo(
    () => (state: State) => (sessionId ? state.sums[sessionId] : undefined),
    [sessionId],
  );
  return useThreadSessionStore(pick);
}
