import { useParams } from "@tanstack/react-router";
import { startTransition, useEffect, useMemo } from "react";
import { readGlass } from "../host";
import { PI_GLASS_SHELL_CHANGED_EVENT } from "../lib/pi-glass-constants";
import { buildWorkspaceThreadSections, type GlassSidebarSection } from "../lib/glass-view-model";
import { usePiStore } from "../lib/pi-session-store";

export function useGlassAgents(cwd: string | null, home: string | null) {
  const sums = usePiStore((s) => s.sums);
  const clear = usePiStore((state) => state.clear);
  const dropSum = usePiStore((state) => state.dropSum);
  const putSum = usePiStore((state) => state.putSum);
  const replaceSums = usePiStore((state) => state.replaceSums);

  const routeThreadId = useParams({
    strict: false,
    select: (params) => params.threadId ?? null,
  });

  useEffect(() => {
    const glass = readGlass();
    if (!glass) return;

    let live = true;

    const load = () => {
      void glass.session
        .listAll()
        .then((items) => {
          if (!live) return;
          startTransition(() => {
            replaceSums(items);
          });
        })
        .catch(() => {});
    };

    const sync = () => {
      if (document.visibilityState === "hidden") return;
      load();
    };

    const reset = () => {
      if (!live) return;
      startTransition(() => {
        clear();
      });
      load();
    };

    load();
    const off = glass.session.onSummary((event) => {
      if (!live) return;
      startTransition(() => {
        if (event.type === "remove") {
          dropSum(event.sessionId);
          return;
        }
        putSum(event.summary);
      });
    });

    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener(PI_GLASS_SHELL_CHANGED_EVENT, reset);

    return () => {
      live = false;
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener(PI_GLASS_SHELL_CHANGED_EVENT, reset);
      off();
    };
  }, [clear, dropSum, putSum, replaceSums]);

  const sections = useMemo(() => buildWorkspaceThreadSections(sums, cwd, home), [cwd, home, sums]);

  return { sections, routeThreadId } satisfies {
    sections: GlassSidebarSection[];
    routeThreadId: string | null;
  };
}
