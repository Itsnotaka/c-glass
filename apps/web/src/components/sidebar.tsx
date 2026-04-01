import { ThreadId } from "@glass/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { useGlassAgents } from "../hooks/useGlassAgents";
import { GlassAgentList } from "./glass/glass-agent-list";
import { useGlassShellView } from "./glass/glass-shell-context";
import { GlassSidebarFooter } from "./glass/glass-sidebar-footer";
import { GlassSidebarHeader } from "./glass/glass-sidebar-header";

export function Sidebar() {
  const navigate = useNavigate();
  const agents = useGlassAgents();
  const shell = useGlassShellView();

  const select = useCallback(
    (id: string) => {
      shell.setCenterMode("main");
      void navigate({
        to: "/$threadId",
        params: { threadId: ThreadId.makeUnsafe(id) },
      });
    },
    [navigate, shell],
  );

  const create = useCallback(() => {
    select(crypto.randomUUID());
  }, [select]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-glass-sidebar">
      <GlassSidebarHeader onNewAgent={create} />
      <GlassAgentList sections={agents.sections} onSelectAgent={select} />
      <GlassSidebarFooter />
    </div>
  );
}
