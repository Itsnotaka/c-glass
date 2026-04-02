import { createFileRoute } from "@tanstack/react-router";

import { GlassEmptyCanvas } from "../components/glass/glass-empty-canvas";
import { GlassShell } from "../components/glass/glass-shell";
import { isElectron } from "../env";
import { SidebarTrigger } from "../components/ui/sidebar";

function ChatThreadRouteView() {
  const id = Route.useParams({ select: (p) => p.threadId });

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

      <GlassEmptyCanvas sessionId={id} />
    </GlassShell>
  );
}

export const Route = createFileRoute("/_chat/$threadId")({
  component: ChatThreadRouteView,
});
