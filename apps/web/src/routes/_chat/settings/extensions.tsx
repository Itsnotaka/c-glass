import { createFileRoute } from "@tanstack/react-router";

import { ExtensionsSettingsPanel } from "../../../components/settings/settings-panels";

export const Route = createFileRoute("/_chat/settings/extensions")({
  component: ExtensionsSettingsPanel,
});
