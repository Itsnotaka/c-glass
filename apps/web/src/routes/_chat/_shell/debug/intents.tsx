import { createFileRoute } from "@tanstack/react-router";

import { ProviderIntentsPage } from "~/components/glass/debug/provider-intents-page";

function DebugProviderIntentsRouteView() {
  return <ProviderIntentsPage />;
}

export const Route = createFileRoute("/_chat/_shell/debug/intents")({
  component: DebugProviderIntentsRouteView,
});
