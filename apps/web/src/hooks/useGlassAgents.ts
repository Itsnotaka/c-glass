import { ThreadId } from "@glass/contracts";
import type { SessionMetadata } from "@mariozechner/pi-web-ui";
import { useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { PI_GLASS_SESSIONS_CHANGED_EVENT } from "../lib/pi-glass-constants";
import { buildPiSessionSidebarSections, type GlassSidebarSection } from "../lib/glassViewModel";
import { ensurePiGlassStorage } from "../lib/pi-glass-storage";

export function useGlassAgents(): {
  sections: GlassSidebarSection[];
  routeThreadId: ThreadId | null;
} {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);

  const routeThreadId = useParams({
    strict: false,
    select: (params) => (params.threadId ? ThreadId.makeUnsafe(params.threadId) : null),
  });

  useEffect(() => {
    let alive = true;

    const refresh = async () => {
      try {
        const storage = await ensurePiGlassStorage();
        const meta = await storage.sessions.getAllMetadata();
        if (alive) {
          setSessions(meta);
        }
      } catch {}
    };

    void refresh();
    window.addEventListener(PI_GLASS_SESSIONS_CHANGED_EVENT, refresh);
    return () => {
      alive = false;
      window.removeEventListener(PI_GLASS_SESSIONS_CHANGED_EVENT, refresh);
    };
  }, []);

  const sections = useMemo(
    () => buildPiSessionSidebarSections(sessions, routeThreadId ? String(routeThreadId) : null),
    [sessions, routeThreadId],
  );

  return { sections, routeThreadId };
}
