import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

type TaskState = "pending" | "in_progress" | "completed";

type Task = {
  id: number;
  text: string;
  status: TaskState;
};

type TaskDetails = {
  action: "list" | "add" | "update" | "remove" | "clear";
  tasks: Task[];
  nextId: number;
  error?: string;
};

const statusSchema = StringEnum(["pending", "in_progress", "completed"] as const, {
  description: "Task status",
  default: "pending",
});

const taskSchema = Type.Object({
  action: StringEnum(["list", "add", "update", "remove", "clear"] as const),
  text: Type.Optional(Type.String({ description: "Task text (for add/update)" })),
  id: Type.Optional(Type.Number({ description: "Task ID (for update/remove)" })),
  status: Type.Optional(statusSchema),
});

const labels = {
  pending: "pending",
  in_progress: "in progress",
  completed: "completed",
} satisfies Record<TaskState, string>;

function line(item: Task) {
  return `[#${item.id}] ${item.text} (${labels[item.status]})`;
}

function summary(tasks: Task[]) {
  if (tasks.length === 0) return "No tasks";
  return tasks.map(line).join("\n");
}

function sync(ctx: ExtensionContext, state: { tasks: Task[]; nextId: number }) {
  state.tasks = [];
  state.nextId = 1;

  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "message") continue;
    const msg = entry.message;
    if (msg.role !== "toolResult" || msg.toolName !== "task_list") continue;
    const details = msg.details as TaskDetails | undefined;
    if (!details) continue;
    state.tasks = details.tasks;
    state.nextId = details.nextId;
  }
}

export default function (pi: ExtensionAPI) {
  const state = { tasks: [] as Task[], nextId: 1 };

  const load = (_event: unknown, ctx: ExtensionContext) => {
    sync(ctx, state);
  };

  pi.on("session_start", load);
  pi.on("session_switch", load);
  pi.on("session_fork", load);
  pi.on("session_tree", load);

  pi.registerTool<typeof taskSchema, TaskDetails>({
    name: "task_list",
    label: "Task List",
    description:
      "Manage a task list with statuses. Actions: list, add (text), update (id, status/text), remove (id), clear",
    parameters: taskSchema,
    async execute(_toolCallId, params) {
      switch (params.action) {
        case "list":
          return {
            content: [{ type: "text", text: summary(state.tasks) }],
            details: {
              action: "list",
              tasks: [...state.tasks],
              nextId: state.nextId,
            } satisfies TaskDetails,
          };

        case "add": {
          if (!params.text) {
            return {
              content: [{ type: "text", text: "Error: text required for add" }],
              details: {
                action: "add",
                tasks: [...state.tasks],
                nextId: state.nextId,
                error: "text required",
              } satisfies TaskDetails,
            };
          }
          const next = {
            id: state.nextId,
            text: params.text,
            status: (params.status ?? "pending") as TaskState,
          } satisfies Task;
          state.nextId += 1;
          state.tasks.push(next);
          return {
            content: [
              {
                type: "text",
                text: `Added task #${next.id}: ${next.text} (${labels[next.status]})`,
              },
            ],
            details: {
              action: "add",
              tasks: [...state.tasks],
              nextId: state.nextId,
            } satisfies TaskDetails,
          };
        }

        case "update": {
          if (params.id === undefined) {
            return {
              content: [{ type: "text", text: "Error: id required for update" }],
              details: {
                action: "update",
                tasks: [...state.tasks],
                nextId: state.nextId,
                error: "id required",
              } satisfies TaskDetails,
            };
          }
          const cur = state.tasks.find((item) => item.id === params.id);
          if (!cur) {
            return {
              content: [{ type: "text", text: `Task #${params.id} not found` }],
              details: {
                action: "update",
                tasks: [...state.tasks],
                nextId: state.nextId,
                error: `#${params.id} not found`,
              } satisfies TaskDetails,
            };
          }
          if (!params.text && !params.status) {
            return {
              content: [{ type: "text", text: "Error: provide text and/or status for update" }],
              details: {
                action: "update",
                tasks: [...state.tasks],
                nextId: state.nextId,
                error: "text or status required",
              } satisfies TaskDetails,
            };
          }
          if (params.text) cur.text = params.text;
          if (params.status) cur.status = params.status as TaskState;
          return {
            content: [
              {
                type: "text",
                text: `Updated task #${cur.id}: ${cur.text} (${labels[cur.status]})`,
              },
            ],
            details: {
              action: "update",
              tasks: [...state.tasks],
              nextId: state.nextId,
            } satisfies TaskDetails,
          };
        }

        case "remove": {
          if (params.id === undefined) {
            return {
              content: [{ type: "text", text: "Error: id required for remove" }],
              details: {
                action: "remove",
                tasks: [...state.tasks],
                nextId: state.nextId,
                error: "id required",
              } satisfies TaskDetails,
            };
          }
          const i = state.tasks.findIndex((item) => item.id === params.id);
          if (i < 0) {
            return {
              content: [{ type: "text", text: `Task #${params.id} not found` }],
              details: {
                action: "remove",
                tasks: [...state.tasks],
                nextId: state.nextId,
                error: `#${params.id} not found`,
              } satisfies TaskDetails,
            };
          }
          const [cur] = state.tasks.splice(i, 1);
          return {
            content: [{ type: "text", text: `Removed task #${cur!.id}: ${cur!.text}` }],
            details: {
              action: "remove",
              tasks: [...state.tasks],
              nextId: state.nextId,
            } satisfies TaskDetails,
          };
        }

        case "clear": {
          const count = state.tasks.length;
          state.tasks = [];
          state.nextId = 1;
          return {
            content: [{ type: "text", text: `Cleared ${count} tasks` }],
            details: {
              action: "clear",
              tasks: [],
              nextId: 1,
            } satisfies TaskDetails,
          };
        }
      }
    },
  });

  pi.registerCommand("tasks", {
    description: "Show all tasks on the current branch",
    handler: async (_args, ctx) => {
      ctx.ui.notify(summary(state.tasks), "info");
    },
  });
}
