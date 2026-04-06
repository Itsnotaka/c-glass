import type { AgentEvent, AgentMessage } from "@mariozechner/pi-agent-core";
import type { PiRpcIntake } from "./pi-rpc-event-parser";
import type { PiRpcExtensionUiRequest } from "./pi-rpc-types";

type Base = {
  source: "pi-rpc";
  rawType: string;
  rawPayload: unknown;
  at: string;
};

type Warn = {
  source: "pi-rpc";
  at: string;
  message: string;
  rawType: string | null;
  rawPayload?: unknown;
};

export type PiRuntimeEvent =
  | (Base & {
      type: "session.started";
    })
  | (Base & {
      type: "session.state.changed";
      state: {
        model?: unknown;
        thinkingLevel?: string;
        isStreaming?: boolean;
        isCompacting?: boolean;
        steeringMode?: "all" | "one-at-a-time";
        followUpMode?: "all" | "one-at-a-time";
        sessionFile?: string;
        sessionId?: string;
        sessionName?: string;
        autoCompactionEnabled?: boolean;
        messageCount?: number;
        pendingMessageCount?: number;
      };
    })
  | (Base & {
      type: "session.messages.loaded";
      messages: AgentMessage[];
    })
  | (Base & {
      type: "turn.started";
      event: Extract<AgentEvent, { type: "turn_start" }>;
    })
  | (Base & {
      type: "turn.completed";
      event: Extract<AgentEvent, { type: "turn_end" | "agent_end" }>;
    })
  | (Base & {
      type: "content.delta";
      event: Extract<AgentEvent, { type: "message_start" | "message_update" | "message_end" }>;
    })
  | (Base & {
      type: "tool.started";
      event: Extract<AgentEvent, { type: "tool_execution_start" }>;
    })
  | (Base & {
      type: "tool.progress";
      event: Extract<AgentEvent, { type: "tool_execution_update" }>;
    })
  | (Base & {
      type: "tool.completed";
      event: Extract<AgentEvent, { type: "tool_execution_end" }>;
    })
  | (Base & {
      type: "user-input.requested";
      request: PiRpcExtensionUiRequest;
    })
  | (Warn & {
      type: "runtime.warning";
    })
  | (Warn & {
      type: "runtime.error";
    });

function stamp(rawType: string, rawPayload: unknown): Base {
  return {
    source: "pi-rpc",
    rawType,
    rawPayload,
    at: new Date().toISOString(),
  };
}

function warn(
  intake: PiRpcIntake,
  type: "runtime.warning" | "runtime.error",
  message: string,
): PiRuntimeEvent {
  if (intake.kind === "parse_error") {
    return {
      type,
      source: "pi-rpc",
      at: new Date().toISOString(),
      message,
      rawType: null,
    };
  }

  if (intake.kind === "unknown") {
    return {
      type,
      source: "pi-rpc",
      at: new Date().toISOString(),
      message,
      rawType: intake.rawType,
      rawPayload: intake.rawPayload,
    };
  }

  return {
    type,
    source: "pi-rpc",
    at: new Date().toISOString(),
    message,
    rawType: intake.rawType,
    rawPayload: intake.rawPayload,
  };
}

export function normalizePiRpcIntake(intake: PiRpcIntake): PiRuntimeEvent[] {
  if (intake.kind === "parse_error") {
    return [warn(intake, "runtime.warning", `Failed to parse runtime line: ${intake.error}`)];
  }

  if (intake.kind === "unknown") {
    return [warn(intake, "runtime.warning", "Received unknown runtime payload")];
  }

  if (intake.kind === "extension_error") {
    return [warn(intake, "runtime.error", `${intake.error.extensionPath}: ${intake.error.error}`)];
  }

  if (intake.kind === "ui_request") {
    return [
      {
        ...stamp(intake.rawType, intake.rawPayload),
        type: "user-input.requested",
        request: intake.request,
      },
    ];
  }

  if (intake.kind === "response") {
    if (!intake.response.success) {
      return [warn(intake, "runtime.error", intake.response.error)];
    }

    if (intake.response.command === "get_state" && "data" in intake.response) {
      return [
        {
          ...stamp(intake.rawType, intake.rawPayload),
          type: "session.state.changed",
          state: intake.response.data,
        },
      ];
    }

    if (intake.response.command === "get_messages" && "data" in intake.response) {
      return [
        {
          ...stamp(intake.rawType, intake.rawPayload),
          type: "session.messages.loaded",
          messages: intake.response.data.messages,
        },
      ];
    }

    return [];
  }

  if (intake.event.type === "agent_start") {
    return [
      {
        ...stamp(intake.rawType, intake.rawPayload),
        type: "session.started",
      },
      {
        ...stamp(intake.rawType, intake.rawPayload),
        type: "session.state.changed",
        state: { isStreaming: true },
      },
    ];
  }

  if (intake.event.type === "agent_end") {
    return [
      {
        ...stamp(intake.rawType, intake.rawPayload),
        type: "turn.completed",
        event: intake.event,
      },
      {
        ...stamp(intake.rawType, intake.rawPayload),
        type: "session.state.changed",
        state: { isStreaming: false },
      },
    ];
  }

  if (intake.event.type === "turn_start") {
    return [
      {
        ...stamp(intake.rawType, intake.rawPayload),
        type: "turn.started",
        event: intake.event,
      },
    ];
  }

  if (intake.event.type === "turn_end") {
    return [
      {
        ...stamp(intake.rawType, intake.rawPayload),
        type: "turn.completed",
        event: intake.event,
      },
    ];
  }

  if (
    intake.event.type === "message_start" ||
    intake.event.type === "message_update" ||
    intake.event.type === "message_end"
  ) {
    return [
      {
        ...stamp(intake.rawType, intake.rawPayload),
        type: "content.delta",
        event: intake.event,
      },
    ];
  }

  if (intake.event.type === "tool_execution_start") {
    return [
      {
        ...stamp(intake.rawType, intake.rawPayload),
        type: "tool.started",
        event: intake.event,
      },
    ];
  }

  if (intake.event.type === "tool_execution_update") {
    return [
      {
        ...stamp(intake.rawType, intake.rawPayload),
        type: "tool.progress",
        event: intake.event,
      },
    ];
  }

  if (intake.event.type === "tool_execution_end") {
    return [
      {
        ...stamp(intake.rawType, intake.rawPayload),
        type: "tool.completed",
        event: intake.event,
      },
    ];
  }

  return [];
}
