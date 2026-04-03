import { createFileRoute } from "@tanstack/react-router";

import { GlassChatShell } from "../components/glass/glass-chat-shell";
import { SidebarInset } from "../components/ui/sidebar";

function ChatRouteLayout() {
  return (
    <SidebarInset className="isolate h-dvh min-h-0 overflow-hidden overscroll-y-none bg-glass-editor text-foreground">
      <GlassChatShell />
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat")({
  component: ChatRouteLayout,
});
