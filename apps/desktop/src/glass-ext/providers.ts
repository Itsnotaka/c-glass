import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { registerFireworksProvider } from "./providers/fireworks";
import { registerOpenCodeGoProvider } from "./providers/opencode-go";

export default function (pi: ExtensionAPI) {
  registerFireworksProvider(pi);
  registerOpenCodeGoProvider(pi);
}
