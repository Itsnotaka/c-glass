import { useRouter } from "@tanstack/react-router";
import { useMemo, useSyncExternalStore } from "react";
import { buildWorkspaceThreadSections, type GlassSidebarSection } from "../lib/glass-view-model";
import { usePiSums, usePiSumsStatus } from "../lib/pi-session-store";

const THREAD_ROUTE = "/_chat/_shell/$threadId";

function useShellThreadId() {
  const router = useRouter();
  return useSyncExternalStore(
    (onStoreChange) => {
      const unsub = router.history.subscribe(() => {
        onStoreChange();
      });
      return () => {
        unsub();
      };
    },
    () => {
      const hit = router.state.matches.find((m) => m.routeId === THREAD_ROUTE);
      const id = hit?.params?.threadId;
      return typeof id === "string" ? id : null;
    },
    () => null,
  );
}

export function useGlassAgents(cwd: string | null, home: string | null) {
  const sums = usePiSums();
  const status = usePiSumsStatus();
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
