import type { PiConfig } from "@glass/contracts";
import { extSpecs } from "@glass/shared/glass-ext";
import type { ExtensionFactory, ToolDefinition } from "@mariozechner/pi-coding-agent";

import { createAskTool, type AskHub } from "./ask";
import codebase from "./codebase";
import context7 from "./context7";
import debug from "./debug";
import getDiagnosis from "./get-diagnostics/index";
import handoff from "./handoff";
import openaiFastDefault from "./openai-fast";
import paperMcp from "./paper-mcp";
import providers from "./providers";
import sessionDate from "./session-date";
import statusline from "./statusline";
import tasks from "./tasks";
import uv from "./uv";
import websearch from "./websearch";

const files = {
  ask: "apps/desktop/src/glass-ext/ask.ts",
  codebase: "apps/desktop/src/glass-ext/codebase.ts",
  "context7-search": "apps/desktop/src/glass-ext/context7.ts",
  debug: "apps/desktop/src/glass-ext/debug.ts",
  "get-diagnosis": "apps/desktop/src/glass-ext/get-diagnostics/index.ts",
  handoff: "apps/desktop/src/glass-ext/handoff.ts",
  "openai-fast-default": "apps/desktop/src/glass-ext/openai-fast.ts",
  "paper-mcp": "apps/desktop/src/glass-ext/paper-mcp.ts",
  providers: "apps/desktop/src/glass-ext/providers.ts",
  "session-date": "apps/desktop/src/glass-ext/session-date.ts",
  statusline: "apps/desktop/src/glass-ext/statusline.ts",
  task_list: "apps/desktop/src/glass-ext/tasks.ts",
  uv: "apps/desktop/src/glass-ext/uv.ts",
  websearch: "apps/desktop/src/glass-ext/websearch.ts",
} as const;

const facts = [
  codebase,
  context7,
  debug,
  getDiagnosis,
  handoff,
  openaiFastDefault,
  paperMcp,
  providers,
  sessionDate,
  statusline,
  tasks,
  uv,
  websearch,
] satisfies ExtensionFactory[];

export function extFactories() {
  return facts;
}

export function extTools(ask: AskHub) {
  return [createAskTool(ask) as unknown as ToolDefinition];
}

export function extDtos(): PiConfig["extensions"] {
  return extSpecs
    .filter((item) => item.native)
    .map((item) => ({
      name: item.name,
      path: `glass://${item.id}`,
      resolvedPath: files[item.id as keyof typeof files] ?? files.ask,
      scope: "other" as const,
    }));
}

export { extSpecs };
