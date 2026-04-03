import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useGlassAgents } from "../hooks/use-glass-agents";
import { useShellState } from "../hooks/use-shell-cwd";
import { useGlassNewChatStore } from "../lib/glass-new-chat-store";
import { GlassAgentList } from "./glass/glass-agent-list";
import { GlassSidebarFooter } from "./glass/glass-sidebar-footer";
import { GlassSidebarHeader } from "./glass/glass-sidebar-header";

export function Sidebar() {
  const navigate = useNavigate();
  const { cwd, home } = useShellState();
  const agents = useGlassAgents(cwd, home);
  const bump = useGlassNewChatStore((state) => state.bump);

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
    bump();
    void navigate({ to: "/" });
  }, [bump, navigate]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-glass-sidebar/90 px-4 backdrop-blur-xl">
      <GlassSidebarHeader onNewAgent={create} />
      <GlassAgentList
        loading={agents.loading}
        error={agents.error}
        sections={agents.sections}
        selectedId={agents.routeThreadId}
        onSelectAgent={select}
      />
      <GlassSidebarFooter />
    </div>
  );
}
