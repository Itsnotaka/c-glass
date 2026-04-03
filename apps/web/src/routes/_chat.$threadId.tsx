import { createFileRoute } from "@tanstack/react-router";

import { GlassChatSession } from "../components/glass/glass-chat-session";

function ChatThreadRouteView() {
  const id = Route.useParams({ select: (p) => p.threadId });
  return <GlassChatSession sessionId={id} />;
}

export const Route = createFileRoute("/_chat/$threadId")({
  component: ChatThreadRouteView,
});
