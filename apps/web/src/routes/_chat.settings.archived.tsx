import { createFileRoute } from "@tanstack/react-router";

import { ArchivedThreadsPanel } from "../components/settings/settings-panels";

export const Route = createFileRoute("/_chat/settings/archived")({
  component: ArchivedThreadsPanel,
});
