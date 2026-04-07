import type { Json } from "@glass/contracts";
import type { AgentEvent } from "@mariozechner/pi-agent-core";
import type { PiRpcExtensionError, PiRpcExtensionUiRequest, PiRpcResponse } from "./pi-rpc-types";
import {
  isPiAgentEvent,
  isPiRpcExtensionError,
  isPiRpcExtensionUiRequest,
  isPiRpcResponse,
} from "./pi-rpc-types";

type Obj = Record<string, Json>;

export type PiRpcIntake =
  | {
      kind: "response";
      response: PiRpcResponse;
      rawType: string;
      rawPayload: Json;
    }
  | {
      kind: "agent_event";
      event: AgentEvent;
      rawType: string;
      rawPayload: Json;
    }
  | {
      kind: "ui_request";
      request: PiRpcExtensionUiRequest;
      rawType: string;
      rawPayload: Json;
    }
  | {
      kind: "extension_error";
      error: PiRpcExtensionError;
      rawType: string;
      rawPayload: Json;
    }
  | {
      kind: "unknown";
      rawType: string | null;
      rawPayload: Json;
    }
  | {
      kind: "parse_error";
      line: string;
      error: string;
    };

function rec(value: Json): Obj | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Obj;
}

function typeOf(value: Json): string | null {
  const item = rec(value);
  if (!item) return null;
  return typeof item.type === "string" ? item.type : null;
}

export function parsePiRpcLine(line: string): PiRpcIntake {
  try {
    const parsed = JSON.parse(line) as Json;
    const rawType = typeOf(parsed);

    if (isPiRpcResponse(parsed) && rawType) {
      return { kind: "response", response: parsed, rawType, rawPayload: parsed };
    }
    if (isPiAgentEvent(parsed) && rawType) {
      return { kind: "agent_event", event: parsed, rawType, rawPayload: parsed };
    }
    if (isPiRpcExtensionUiRequest(parsed) && rawType) {
      return { kind: "ui_request", request: parsed, rawType, rawPayload: parsed };
    }
    if (isPiRpcExtensionError(parsed) && rawType) {
      return { kind: "extension_error", error: parsed, rawType, rawPayload: parsed };
    }

    return {
      kind: "unknown",
      rawType,
      rawPayload: parsed,
    };
  } catch (err) {
    return {
      kind: "parse_error",
      line,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
