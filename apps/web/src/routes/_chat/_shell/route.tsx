import { createFileRoute } from "@tanstack/react-router";

import { GlassChatShell } from "../../../components/glass/glass-chat-shell";

export const Route = createFileRoute("/_chat/_shell")({
  component: GlassChatShell,
});
