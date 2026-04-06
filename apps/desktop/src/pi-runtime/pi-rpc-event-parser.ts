import type { AgentEvent } from "@mariozechner/pi-agent-core";
import type { PiRpcExtensionError, PiRpcExtensionUiRequest, PiRpcResponse } from "./pi-rpc-types";
import {
  isPiAgentEvent,
  isPiRpcExtensionError,
  isPiRpcExtensionUiRequest,
  isPiRpcResponse,
} from "./pi-rpc-types";

type Obj = Record<string, unknown>;

export type PiRpcIntake =
  | {
      kind: "response";
      response: PiRpcResponse;
      rawType: string;
      rawPayload: unknown;
    }
  | {
      kind: "agent_event";
      event: AgentEvent;
      rawType: string;
      rawPayload: unknown;
    }
  | {
      kind: "ui_request";
      request: PiRpcExtensionUiRequest;
      rawType: string;
      rawPayload: unknown;
    }
  | {
      kind: "extension_error";
      error: PiRpcExtensionError;
      rawType: string;
      rawPayload: unknown;
    }
  | {
      kind: "unknown";
      rawType: string | null;
      rawPayload: unknown;
    }
  | {
      kind: "parse_error";
      line: string;
      error: string;
    };

function rec(value: unknown): Obj | null {
  if (!value || typeof value !== "object") return null;
  return value as Obj;
}

function typeOf(value: unknown): string | null {
  const item = rec(value);
  if (!item) return null;
  return typeof item.type === "string" ? item.type : null;
}

export function parsePiRpcLine(line: string): PiRpcIntake {
  try {
    const parsed = JSON.parse(line) as unknown;
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
