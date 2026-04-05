import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

function date() {
  const now = new Date();
  const off = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - off).toISOString().slice(0, 10);
}

function init(ctx: ExtensionContext) {
  if (ctx.sessionManager.getEntries().length > 0) {
    return undefined;
  }

  return date();
}

export default function (pi: ExtensionAPI) {
  let pending: string | undefined;

  pi.on("session_start", async (_event, ctx) => {
    pending = init(ctx);
  });

  pi.on("session_switch", async (_event, ctx) => {
    pending = init(ctx);
  });

  pi.on("session_fork", async (_event, ctx) => {
    pending = init(ctx);
  });

  pi.on("before_agent_start", async (event) => {
    if (!pending) {
      return;
    }

    const stamp = pending;
    pending = undefined;

    return {
      systemPrompt: `${event.systemPrompt}\n\nCurrent date at session start: ${stamp}`,
    };
  });
}
