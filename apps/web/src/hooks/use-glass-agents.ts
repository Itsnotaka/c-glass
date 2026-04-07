import { useMatchRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { buildWorkspaceThreadSections, type GlassSidebarSection } from "../lib/glass-view-model";
import { useThreadSummaries, useThreadSummariesStatus } from "../lib/thread-session-store";

const THREAD_ROUTE = "/$threadId";

function useShellThreadId() {
  const match = useMatchRoute();
  const pend = match({ to: THREAD_ROUTE, pending: true });
  if (pend && typeof pend.threadId === "string") return pend.threadId;

  const cur = match({ to: THREAD_ROUTE });
  return cur && typeof cur.threadId === "string" ? cur.threadId : null;
}

export function useGlassAgents(cwd: string | null, home: string | null) {
  const sums = useThreadSummaries();
  const status = useThreadSummariesStatus();
  const routeThreadId = useShellThreadId();

  const sections = useMemo(
    () =>
      status === "ready"
        ? buildWorkspaceThreadSections(sums, cwd, home)
        : ([] satisfies GlassSidebarSection[]),
    [cwd, home, status, sums],
  );

  return {
    sections,
    routeThreadId,
    loading: status === "loading",
    error: status === "error",
  } satisfies {
    sections: GlassSidebarSection[];
    routeThreadId: string | null;
    loading: boolean;
    error: boolean;
  };
}
