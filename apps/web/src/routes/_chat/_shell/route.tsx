import { createFileRoute } from "@tanstack/react-router";

import { GlassChatShell } from "~/components/glass/shell/chat";

export const Route = createFileRoute("/_chat/_shell")({
  component: GlassChatShell,
});
