import { useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { buildWorkspaceThreadSections, type GlassSidebarSection } from "../lib/glass-view-model";
import { usePiSums, usePiSumsStatus } from "../lib/pi-session-store";

export function useGlassAgents(cwd: string | null, home: string | null) {
  const sums = usePiSums();
  const status = usePiSumsStatus();
  const routeThreadId = useParams({
    strict: false,
    select: (params) => params.threadId ?? null,
  });

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
