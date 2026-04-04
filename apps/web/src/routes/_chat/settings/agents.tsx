import { createFileRoute } from "@tanstack/react-router";

import { AgentsSettingsPanel } from "../../../components/settings/settings-panels";

export const Route = createFileRoute("/_chat/settings/agents")({
  component: AgentsSettingsPanel,
});
