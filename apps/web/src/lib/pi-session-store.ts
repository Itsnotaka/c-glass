import type {
  PiSessionActiveEvent,
  PiSessionDelta,
  PiSessionSnapshot,
  PiSessionSummary,
} from "@glass/contracts";
import { useMemo } from "react";
import { create } from "zustand";

function rank(sums: Record<string, PiSessionSummary>) {
  return Object.values(sums)
    .toSorted((left, right) =>
      left.modifiedAt < right.modifiedAt ? 1 : left.modifiedAt > right.modifiedAt ? -1 : 0,
    )
    .map((item) => item.id);
}

function same(left: PiSessionSummary | undefined, right: PiSessionSummary) {
  if (!left) return false;
  return (
    left.id === right.id &&
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

function sync(snap: PiSessionSnapshot, delta: Exclude<PiSessionDelta, { type: "sync" }>) {
  return {
    ...snap,
    model: delta.meta.model,
    thinkingLevel: delta.meta.thinkingLevel,
    isStreaming: delta.meta.isStreaming,
    pending: delta.meta.pending,
  } satisfies PiSessionSnapshot;
}

function patch(snap: PiSessionSnapshot, delta: PiSessionDelta) {
  if (delta.type === "sync") return delta.snapshot;

  const next = sync(snap, delta);
  if (delta.type === "meta") return next;
  if (delta.type === "append") {
    return {
      ...next,
      messages: [...next.messages, delta.message],
    } satisfies PiSessionSnapshot;
  }
  if (next.messages.length === 0) {
    return {
      ...next,
      messages: [delta.message],
    } satisfies PiSessionSnapshot;
  }
  return {
    ...next,
    messages: next.messages.map((item, i) =>
      i === next.messages.length - 1 ? delta.message : item,
    ),
  } satisfies PiSessionSnapshot;
}

type State = {
  ids: string[];
  sums: Record<string, PiSessionSummary>;
  snaps: Record<string, PiSessionSnapshot>;
  replaceSums: (items: PiSessionSummary[]) => void;
  putSum: (item: PiSessionSummary) => void;
  dropSum: (id: string) => void;
  putSnap: (snap: PiSessionSnapshot) => void;
  applyActs: (events: PiSessionActiveEvent[]) => void;
  clear: () => void;
};

export const usePiStore = create<State>()((set) => ({
  ids: [],
  sums: {},
  snaps: {},
  replaceSums: (items) => {
    const sums = Object.fromEntries(items.map((item) => [item.id, item]));
    set({ sums, ids: rank(sums) });
  },
  putSum: (item) => {
    set((state) => {
      if (same(state.sums[item.id], item)) return state;
      const sums = { ...state.sums, [item.id]: item };
      return { sums, ids: rank(sums) };
    });
  },
  dropSum: (id) => {
    set((state) => {
      if (!(id in state.sums)) return state;
      const sums = { ...state.sums };
      delete sums[id];
      return { sums, ids: rank(sums) };
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
      return { snaps };
    });
  },
  clear: () => {
    set({ ids: [], sums: {}, snaps: {} });
  },
}));

export const usePiIds = () => usePiStore((state) => state.ids);

export function usePiSummary(sessionId: string | null | undefined) {
  const pick = useMemo(
    () => (state: State) => (sessionId ? state.sums[sessionId] : undefined),
    [sessionId],
  );
  return usePiStore(pick);
}

export function usePiSnapshot(sessionId: string | null | undefined) {
  const pick = useMemo(
    () => (state: State) => (sessionId ? state.snaps[sessionId] : undefined),
    [sessionId],
  );
  return usePiStore(pick);
}
