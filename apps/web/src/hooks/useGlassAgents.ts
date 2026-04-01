import type { PiSessionSummary } from "@glass/contracts";
import { useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getGlass } from "../host";
import { buildPiSessionSidebarSections, type GlassSidebarSection } from "../lib/glassViewModel";

export function useGlassAgents() {
  const [sessions, setSessions] = useState<PiSessionSummary[]>([]);

  const routeThreadId = useParams({
    strict: false,
    select: (params) => params.threadId ?? null,
  });

  useEffect(() => {
    let live = true;

    const load = () => {
      void getGlass()
        .session.list()
        .then((items) => {
          if (!live) return;
          setSessions(items);
        })
        .catch(() => {});
    };

    load();
    const off = getGlass().session.onEvent(() => {
      load();
    });

    return () => {
      live = false;
      off();
    };
  }, []);

  const sections = useMemo(
    () => buildPiSessionSidebarSections(sessions, routeThreadId),
    [routeThreadId, sessions],
  );

  return { sections, routeThreadId } satisfies {
    sections: GlassSidebarSection[];
    routeThreadId: string | null;
  };
}
