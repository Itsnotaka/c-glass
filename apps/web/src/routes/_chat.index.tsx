import { createFileRoute } from "@tanstack/react-router";

import { GlassHeroCanvas } from "../components/glass/glass-hero-canvas";
import { GlassMarketplaceView } from "../components/glass/GlassMarketplaceView";
import { GlassShell } from "../components/glass/GlassShell";
import { useGlassShellView } from "../components/glass/GlassShellContext";
import { isElectron } from "../env";
import { SidebarTrigger } from "../components/ui/sidebar";
import { GlassWorkspacePicker } from "../components/glass/GlassWorkspacePicker";

function ChatIndexRouteView() {
  const view = useGlassShellView();

  return (
    <GlassShell>
      {isElectron ? (
        <div className="drag-region flex h-[35px] shrink-0 items-center justify-center px-6">
          <GlassWorkspacePicker />
        </div>
      ) : (
        <header className="border-b border-glass-panel-border px-3 py-2 md:hidden">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="size-7 shrink-0" />
            <span className="text-sm font-medium text-foreground">Agents</span>
          </div>
        </header>
      )}

      {view.centerMode === "marketplace" ? <GlassMarketplaceView /> : <GlassHeroCanvas />}
    </GlassShell>
  );
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});
