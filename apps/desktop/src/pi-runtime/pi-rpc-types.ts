import type { AgentEvent, AgentMessage, ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { Api, ImageContent, Model } from "@mariozechner/pi-ai";

type Obj = Record<string, unknown>;

type PiRpcResponseMap = {
  prompt: undefined;
  abort: undefined;
  get_state: {
    model?: Model<Api>;
    thinkingLevel: ThinkingLevel;
    isStreaming: boolean;
    isCompacting: boolean;
    steeringMode: "all" | "one-at-a-time";
    followUpMode: "all" | "one-at-a-time";
    sessionFile?: string;
    sessionId: string;
    sessionName?: string;
    autoCompactionEnabled: boolean;
    messageCount: number;
    pendingMessageCount: number;
  };
  get_messages: {
    messages: AgentMessage[];
  };
  get_commands: {
    commands: Array<{
      name: string;
      description?: string;
      source: "extension" | "prompt" | "skill";
    }>;
  };
  set_model: Model<Api>;
  set_thinking_level: undefined;
  new_session: {
    cancelled: boolean;
  };
  switch_session: {
    cancelled: boolean;
  };
};

export type PiRpcCommand =
  | {
      id?: string;
      type: "prompt";
      message: string;
      images?: ImageContent[];
      streamingBehavior?: "steer" | "followUp";
    }
  | {
      id?: string;
      type: "abort";
    }
  | {
      id?: string;
      type: "get_state";
    }
  | {
      id?: string;
      type: "get_messages";
    }
  | {
      id?: string;
      type: "get_commands";
    }
  | {
      id?: string;
      type: "set_model";
      provider: string;
      modelId: string;
    }
  | {
      id?: string;
      type: "set_thinking_level";
      level: ThinkingLevel;
    }
  | {
      id?: string;
      type: "new_session";
      parentSession?: string;
    }
  | {
      id?: string;
      type: "switch_session";
      sessionPath: string;
    }
  | PiRpcExtensionUiResponse;

type PiRpcResponseSuccess = {
  [K in keyof PiRpcResponseMap]: {
    id?: string;
    type: "response";
    command: K;
    success: true;
  } & (PiRpcResponseMap[K] extends undefined ? Obj : { data: PiRpcResponseMap[K] });
}[keyof PiRpcResponseMap];

type PiRpcResponseError = {
  id?: string;
  type: "response";
  command: string;
  success: false;
  error: string;
};

export type PiRpcResponse = PiRpcResponseSuccess | PiRpcResponseError;

export type PiRpcExtensionUiRequest =
  | {
      type: "extension_ui_request";
      id: string;
      method: "select";
      title: string;
      options: string[];
      timeout?: number;
    }
  | {
      type: "extension_ui_request";
      id: string;
      method: "confirm";
      title: string;
      message: string;
      timeout?: number;
    }
  | {
      type: "extension_ui_request";
      id: string;
      method: "input";
      title: string;
      placeholder?: string;
      timeout?: number;
    }
  | {
      type: "extension_ui_request";
      id: string;
      method: "editor";
      title: string;
      prefill?: string;
      timeout?: number;
    }
  | {
      type: "extension_ui_request";
      id: string;
      method: "notify";
      message: string;
      notifyType?: "info" | "warning" | "error";
    }
  | {
      type: "extension_ui_request";
      id: string;
      method: "setStatus";
      statusKey: string;
      statusText: string | undefined;
    }
  | {
      type: "extension_ui_request";
      id: string;
      method: "setWidget";
      widgetKey: string;
      widgetLines: string[] | undefined;
      widgetPlacement?: "aboveEditor" | "belowEditor";
    }
  | {
      type: "extension_ui_request";
      id: string;
      method: "setTitle";
      title: string;
    }
  | {
      type: "extension_ui_request";
      id: string;
      method: "set_editor_text";
      text: string;
    };

export type PiRpcExtensionUiResponse =
  | {
      type: "extension_ui_response";
      id: string;
      value: string;
    }
  | {
      type: "extension_ui_response";
      id: string;
      confirmed: boolean;
    }
  | {
      type: "extension_ui_response";
      id: string;
      cancelled: true;
    };

export type PiRpcExtensionError = {
  type: "extension_error";
  extensionPath: string;
  event: string;
  error: string;
};

const agentEvents = new Set<AgentEvent["type"]>([
  "agent_start",
  "agent_end",
  "turn_start",
  "turn_end",
  "message_start",
  "message_update",
  "message_end",
  "tool_execution_start",
  "tool_execution_update",
  "tool_execution_end",
]);

function rec(value: unknown): Obj | null {
  if (!value || typeof value !== "object") return null;
  return value as Obj;
}

export function isPiRpcResponse(value: unknown): value is PiRpcResponse {
  const item = rec(value);
  if (!item) return false;
  if (item.type !== "response") return false;
  if (typeof item.command !== "string" || item.command.length === 0) return false;
  return typeof item.success === "boolean";
}

export function isPiRpcExtensionUiRequest(value: unknown): value is PiRpcExtensionUiRequest {
  const item = rec(value);
  if (!item) return false;
  if (item.type !== "extension_ui_request") return false;
  if (typeof item.id !== "string" || item.id.length === 0) return false;
  return typeof item.method === "string" && item.method.length > 0;
}

export function isPiRpcExtensionError(value: unknown): value is PiRpcExtensionError {
  const item = rec(value);
  if (!item) return false;
  if (item.type !== "extension_error") return false;
  if (typeof item.extensionPath !== "string") return false;
  if (typeof item.event !== "string") return false;
  return typeof item.error === "string";
}

export function isPiAgentEvent(value: unknown): value is AgentEvent {
  const item = rec(value);
  if (!item) return false;
  if (typeof item.type !== "string") return false;
  return agentEvents.has(item.type as AgentEvent["type"]);
}
