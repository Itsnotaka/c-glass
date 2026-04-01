import { createFileRoute } from "@tanstack/react-router";

import { GlassEmptyCanvas } from "../components/glass/GlassEmptyCanvas";
import { GlassShell } from "../components/glass/GlassShell";
import { isElectron } from "../env";
import { SidebarTrigger } from "../components/ui/sidebar";

function ChatThreadRouteView() {
  const id = Route.useParams({ select: (p) => p.threadId });

  return (
    <GlassShell>
      {!isElectron && (
        <header className="border-b border-glass-panel-border px-3 py-2 md:hidden">
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
