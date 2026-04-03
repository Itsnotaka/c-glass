import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { getGlass } from "../host";
import { useGlassAgents } from "../hooks/use-glass-agents";
import { useShellState } from "../hooks/use-shell-cwd";
import { GlassAgentList } from "./glass/glass-agent-list";
import { GlassSidebarFooter } from "./glass/glass-sidebar-footer";
import { GlassSidebarHeader } from "./glass/glass-sidebar-header";

export function Sidebar() {
  const navigate = useNavigate();
  const { cwd, home } = useShellState();
  const agents = useGlassAgents(cwd, home);

  const select = useCallback(
    (id: string) => {
      void navigate({
        to: "/$threadId",
        params: { threadId: id },
      });
    },
    [navigate],
  );

  const create = useCallback(() => {
    void getGlass()
      .session.create()
      .then((session) => {
        void navigate({
          to: "/$threadId",
          params: { threadId: session.id },
        });
      });
  }, [navigate]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-glass-sidebar/90 backdrop-blur-xl">
      <GlassSidebarHeader onNewAgent={create} />
      <GlassAgentList
        sections={agents.sections}
        selectedId={agents.routeThreadId}
        onSelectAgent={select}
      />
      <GlassSidebarFooter />
    </div>
  );
}
