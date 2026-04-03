import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PiSessionSummary } from "@glass/contracts";
import { useEffect } from "react";
import { readGlass } from "../host";
import { PI_GLASS_SHELL_CHANGED_EVENT } from "./pi-glass-constants";

export const piKeys = {
  all: ["pi"] as const,
  cfg: () => ["pi", "cfg"] as const,
  sums: () => ["pi", "sums"] as const,
};

function bootCfg() {
  return readGlass()?.pi.readBootConfig?.() ?? undefined;
}

function bootSums() {
  return readGlass()?.session.readBootSummaries?.() ?? undefined;
}

function sort(items: readonly PiSessionSummary[]) {
  return [...items].toSorted((left, right) =>
    left.modifiedAt < right.modifiedAt ? 1 : left.modifiedAt > right.modifiedAt ? -1 : 0,
  );
}

function upsert(items: readonly PiSessionSummary[], next: PiSessionSummary) {
  const hit = items.findIndex((item) => item.id === next.id);
  if (hit < 0) return sort([...items, next]);
  const out = [...items];
  out[hit] = next;
  return sort(out);
}

function cfgOpts() {
  const data = bootCfg();
  return queryOptions({
    queryKey: piKeys.cfg(),
    queryFn: async () => {
      const glass = readGlass();
      if (!glass) return null;
      return glass.pi.getConfig();
    },
    ...(data ? { initialData: data } : {}),
    staleTime: Infinity,
    refetchOnMount: "always" as const,
  });
}

function sumsOpts() {
  const data = bootSums();
  return queryOptions({
    queryKey: piKeys.sums(),
    queryFn: async () => {
      const glass = readGlass();
      if (!glass) return [];
      return glass.session.listAll();
    },
    ...(data ? { initialData: sort(data) } : {}),
    staleTime: Infinity,
    refetchOnMount: "always" as const,
  });
}

export function usePiConfigQuery() {
  const queryClient = useQueryClient();
  const query = useQuery(cfgOpts());

  useEffect(() => {
    const glass = readGlass();
    const load = () => {
      void queryClient.invalidateQueries({ queryKey: piKeys.cfg() });
    };

    const off = glass?.desktop.onBootRefresh?.(load);
    window.addEventListener(PI_GLASS_SHELL_CHANGED_EVENT, load);
    return () => {
      window.removeEventListener(PI_GLASS_SHELL_CHANGED_EVENT, load);
      off?.();
    };
  }, [queryClient]);

  return query;
}

export function usePiSummariesQuery() {
  const queryClient = useQueryClient();
  const query = useQuery(sumsOpts());

  useEffect(() => {
    const glass = readGlass();
    if (!glass) return;

    const sync = () => {
      if (document.visibilityState === "hidden") return;
      void queryClient.invalidateQueries({ queryKey: piKeys.sums() });
    };

    const off = glass.session.onSummary((event) => {
      queryClient.setQueryData(piKeys.sums(), (cur: PiSessionSummary[] | undefined) => {
        const items = cur ?? [];
        if (event.type === "remove") {
          return items.filter((item) => item.id !== event.sessionId);
        }
        return upsert(items, event.summary);
      });
    });

    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener(PI_GLASS_SHELL_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener(PI_GLASS_SHELL_CHANGED_EVENT, sync);
      off();
    };
  }, [queryClient]);

  return query;
}
