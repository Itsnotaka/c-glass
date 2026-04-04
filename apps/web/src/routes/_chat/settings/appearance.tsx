import { createFileRoute } from "@tanstack/react-router";

import { AppearanceSettingsPanel } from "../../../components/settings/settings-panels";

export const Route = createFileRoute("/_chat/settings/appearance")({
  component: AppearanceSettingsPanel,
});
