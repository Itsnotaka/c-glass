import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("statusline", {
    description: "Glass uses native workbench chrome instead of Pi's TUI statusline",
    handler: async (_args, ctx) => {
      ctx.ui.notify("Glass uses its own native workbench status UI.", "info");
    },
  });
}
