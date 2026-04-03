import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { GlassShell } from "../components/glass/glass-shell";
import { GlassWorkbench } from "../components/glass/workbench";
import { isElectron } from "../env";
import { SidebarTrigger } from "../components/ui/sidebar";
import { usePiIds } from "../lib/pi-session-store";
import { buildPiSessionSidebarSections } from "../lib/glass-view-model";

function ChatThreadRouteView() {
  const nav = useNavigate();
  const id = Route.useParams({ select: (p) => p.threadId });
  const ids = usePiIds();
  const sections = buildPiSessionSidebarSections(ids);

  return (
    <GlassShell>
      {!isElectron && (
        <header className="border-b border-glass-border/80 bg-glass-menubar/80 px-3 py-2 backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="size-7 shrink-0" />
            <span className="text-sm font-medium text-foreground">Agents</span>
          </div>
        </header>
      )}

      <GlassWorkbench
        sessionId={id}
        sections={sections}
        selectedId={id}
        onSelectAgent={(next) => {
          if (next === id) return;
          nav({ to: "/$threadId", params: { threadId: next } });
        }}
        className="flex-1"
      />
    </GlassShell>
  );
}

export const Route = createFileRoute("/_chat/$threadId")({
  component: ChatThreadRouteView,
});
