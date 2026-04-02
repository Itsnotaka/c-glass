import { createFileRoute } from "@tanstack/react-router";

import { GlassHeroCanvas } from "../components/glass/glass-hero-canvas";
import { GlassMarketplaceView } from "../components/glass/glass-marketplace-view";
import { GlassShell } from "../components/glass/glass-shell";
import { useGlassShellView } from "../components/glass/glass-shell-context";
import { isElectron } from "../env";
import { SidebarTrigger } from "../components/ui/sidebar";
import { GlassWorkspacePicker } from "../components/glass/glass-workspace-picker";

function ChatIndexRouteView() {
  const view = useGlassShellView();

  return (
    <GlassShell>
      {isElectron ? (
        <div className="drag-region flex h-[var(--glass-header-height)] shrink-0 items-center justify-center border-b border-glass-border/80 bg-glass-menubar/80 px-6 backdrop-blur-xl">
          <GlassWorkspacePicker />
        </div>
      ) : (
        <header className="border-b border-glass-border/80 bg-glass-menubar/80 px-3 py-2 backdrop-blur-xl md:hidden">
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
