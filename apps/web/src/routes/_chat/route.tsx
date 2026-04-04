import { Outlet, createFileRoute } from "@tanstack/react-router";

import { GlassProviderShellOverlay } from "../../components/glass/glass-provider-shell-overlay";
import { SidebarInset } from "../../components/ui/sidebar";

function ChatRouteLayout() {
  return (
    <>
      <SidebarInset className="isolate h-dvh min-h-0 overflow-hidden overscroll-y-none bg-glass-editor text-foreground">
        <Outlet />
      </SidebarInset>
      <GlassProviderShellOverlay />
    </>
  );
}

export const Route = createFileRoute("/_chat")({
  component: ChatRouteLayout,
});
