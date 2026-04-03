"use client";

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { GlassShell } from "../components/glass/glass-shell";
import { GlassWorkbench } from "../components/glass/workbench";
import { isElectron } from "../env";
import { SidebarTrigger } from "../components/ui/sidebar";
import { GlassWorkspacePicker } from "../components/glass/glass-workspace-picker";
import { usePiIds } from "../lib/pi-session-store";
import { buildPiSessionSidebarSections } from "../lib/glass-view-model";

function ChatIndexRouteView() {
  const navigate = useNavigate();
  const sessionIds = usePiIds();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sections = buildPiSessionSidebarSections(sessionIds);

  const handleSelectAgent = (id: string) => {
    setSelectedId(id);
    navigate({ to: "/$threadId", params: { threadId: id } });
  };

  return (
    <GlassShell>
      {isElectron ? (
        <div className="drag-region flex h-[var(--glass-header-height)] shrink-0 items-center justify-center border-b border-glass-border/80 bg-glass-menubar/80 px-6 backdrop-blur-xl">
          <GlassWorkspacePicker />
        </div>
      ) : (
        <header className="flex h-[var(--glass-header-height)] shrink-0 items-center gap-3 border-b border-glass-border/80 bg-glass-menubar/80 px-4 backdrop-blur-xl md:hidden">
          <SidebarTrigger className="size-7 shrink-0" />
          <span className="text-sm font-medium text-foreground">Agents</span>
        </header>
      )}

      <GlassWorkbench
        sessionId={selectedId}
        sections={sections}
        selectedId={selectedId}
        onSelectAgent={handleSelectAgent}
        className="flex-1"
      />
    </GlassShell>
  );
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});
