import { ThreadId } from "@glass/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { useGlassAgents } from "../../hooks/useGlassAgents";
import { useGlassShellView } from "./GlassShellContext";
import { GlassAgentList } from "./GlassAgentList";
import { GlassSidebarFooter } from "./GlassSidebarFooter";
import { GlassSidebarHeader } from "./GlassSidebarHeader";

export function GlassSidebar() {
  const navigate = useNavigate();
  const { sections } = useGlassAgents();
  const { setCenterMode } = useGlassShellView();

  const onNewAgent = useCallback(() => {
    setCenterMode("main");
    void navigate({
      to: "/$threadId",
      params: { threadId: ThreadId.makeUnsafe(crypto.randomUUID()) },
    });
  }, [navigate, setCenterMode]);

  const onSelectAgent = useCallback(
    (id: string) => {
      setCenterMode("main");
      void navigate({
        to: "/$threadId",
        params: { threadId: ThreadId.makeUnsafe(id) },
      });
    },
    [navigate, setCenterMode],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-glass-sidebar">
      <GlassSidebarHeader onNewAgent={onNewAgent} />
      <GlassAgentList sections={sections} onSelectAgent={onSelectAgent} />
      <GlassSidebarFooter />
    </div>
  );
}
