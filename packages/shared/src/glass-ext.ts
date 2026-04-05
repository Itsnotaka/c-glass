export const extKinds = ["tool", "command", "renderer", "ui", "provider", "lifecycle"] as const;

export type ExtKind = (typeof extKinds)[number];

export type ExtSpec = {
  id: string;
  name: string;
  kinds: ExtKind[];
  summary: string;
  native: boolean;
};

export const extSpecs = [
  {
    id: "ask",
    name: "Ask",
    kinds: ["tool", "ui"],
    summary: "Interactive clarification flow rendered by Glass.",
    native: true,
  },
  {
    id: "codebase",
    name: "Codebase",
    kinds: ["tool", "command", "lifecycle"],
    summary: "Disposable GitHub repo clones exposed in `.pi/codebases`.",
    native: true,
  },
  {
    id: "context7-search",
    name: "Context7 Search",
    kinds: ["tool"],
    summary: "Official package and repo documentation lookup.",
    native: true,
  },
  {
    id: "debug",
    name: "Debug",
    kinds: ["tool", "command", "lifecycle"],
    summary: "Runtime fetch-based debugging with a local log server.",
    native: true,
  },
  {
    id: "edit",
    name: "Edit",
    kinds: ["tool"],
    summary: "Enhanced exact edit tool with multi-edit and patch support.",
    native: false,
  },
  {
    id: "get-diagnosis",
    name: "Get Diagnosis",
    kinds: ["tool", "lifecycle"],
    summary: "On-demand LSP diagnostics across TS, Go, Python, YAML, Astro, and Markdown.",
    native: true,
  },
  {
    id: "handoff",
    name: "Handoff",
    kinds: ["command", "ui"],
    summary: "Generate a continuation brief and seed a new session.",
    native: true,
  },
  {
    id: "openai-fast-default",
    name: "OpenAI Fast Default",
    kinds: ["lifecycle"],
    summary: "Sets OpenAI provider requests to priority service tier.",
    native: true,
  },
  {
    id: "paper-mcp",
    name: "Paper MCP",
    kinds: ["tool", "lifecycle"],
    summary: "Paper design-file inspection and mutation tools over MCP.",
    native: true,
  },
  {
    id: "providers",
    name: "Providers",
    kinds: ["provider"],
    summary: "Registers built-in provider integrations beyond Pi defaults.",
    native: true,
  },
  {
    id: "session-date",
    name: "Session Date",
    kinds: ["lifecycle"],
    summary: "Injects a session-start date into the system prompt.",
    native: true,
  },
  {
    id: "statusline",
    name: "Statusline",
    kinds: ["command", "renderer"],
    summary: "Pi TUI footer customization; Glass keeps its own native workbench chrome.",
    native: false,
  },
  {
    id: "subagent",
    name: "Subagent",
    kinds: ["tool", "ui", "lifecycle"],
    summary: "Delegates work to separate Pi subprocesses with isolated context.",
    native: false,
  },
  {
    id: "task_list",
    name: "Task List",
    kinds: ["tool", "command", "lifecycle"],
    summary: "Branch-local task tracking with session reconstruction.",
    native: true,
  },
  {
    id: "uv",
    name: "UV",
    kinds: ["tool"],
    summary: "Replaces Python packaging flows with uv-oriented bash behavior.",
    native: true,
  },
  {
    id: "websearch",
    name: "Web Search",
    kinds: ["tool"],
    summary: "parallel-cli powered web search and direct URL fetch.",
    native: true,
  },
] satisfies ExtSpec[];

export type AskOpt = {
  id: string;
  label: string;
  shortcut?: string;
  recommended?: boolean;
  other?: boolean;
};

export type AskQ = {
  id: string;
  text: string;
  options: AskOpt[];
  multi?: boolean;
  optional?: boolean;
};

export type AskState = {
  sessionId: string;
  toolCallId: string;
  questions: AskQ[];
  current: number;
  values: Record<string, string[]>;
  custom: Record<string, string>;
};

export type AskReply =
  | {
      type: "next";
      questionId: string;
      values: string[];
      custom?: string;
    }
  | {
      type: "back";
      questionId: string;
      values: string[];
      custom?: string;
    }
  | {
      type: "skip";
      questionId: string;
      values?: string[];
      custom?: string;
    }
  | {
      type: "abort";
    };
