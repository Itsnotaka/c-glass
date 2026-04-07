import { Schema } from "effect";
import type { Json } from "./json";

export const HarnessKind = Schema.Literals(["pi", "codex", "claudeCode"]);
export type HarnessKind = typeof HarnessKind.Type;

export type ThreadRunState = "idle" | "running" | "error";
export type ThreadInteractiveKind = "select" | "confirm" | "input" | "editor";

export interface HarnessModelRef {
  provider: string;
  id: string;
  name?: string | null;
  reasoning?: boolean;
}

export interface HarnessThreadBinding {
  threadId: string;
  harness: HarnessKind;
  cwd: string;
  path: string | null;
  createdAt: string;
  updatedAt: string;
}

interface HarnessRuntimeBase {
  type: string;
  harness: HarnessKind;
  threadId: string;
  source: string;
  rawType: string | null;
  raw?: Json;
  at: string;
}

export interface HarnessRuntimeSessionStarted extends HarnessRuntimeBase {
  type: "session.started";
}

export interface HarnessRuntimeSessionStateChanged extends HarnessRuntimeBase {
  type: "session.state.changed";
  state: {
    path?: string | null;
    name?: string | null;
    model?: HarnessModelRef | null;
    thinking?: string | null;
    streaming?: boolean;
    messages?: number;
    pending?: number;
  };
}

export interface HarnessRuntimeMessagesLoaded extends HarnessRuntimeBase {
  type: "session.messages.loaded";
  messages: number;
}

export interface HarnessRuntimeTurnStarted extends HarnessRuntimeBase {
  type: "turn.started";
}

export interface HarnessRuntimeTurnCompleted extends HarnessRuntimeBase {
  type: "turn.completed";
}

export interface HarnessRuntimeContentDelta extends HarnessRuntimeBase {
  type: "content.delta";
  role?: string;
}

export interface HarnessRuntimeToolStarted extends HarnessRuntimeBase {
  type: "tool.started";
  name?: string;
  callId?: string;
}

export interface HarnessRuntimeToolProgress extends HarnessRuntimeBase {
  type: "tool.progress";
  name?: string;
  callId?: string;
}

export interface HarnessRuntimeToolCompleted extends HarnessRuntimeBase {
  type: "tool.completed";
  name?: string;
  callId?: string;
}

export interface HarnessRuntimeInteractiveRequested extends HarnessRuntimeBase {
  type: "interactive.requested";
  requestId: string;
  kind: ThreadInteractiveKind;
  title?: string | null;
}

export interface HarnessRuntimeInteractiveResolved extends HarnessRuntimeBase {
  type: "interactive.resolved";
  requestId: string;
}

export interface HarnessRuntimeWarning extends HarnessRuntimeBase {
  type: "runtime.warning";
  message: string;
}

export interface HarnessRuntimeError extends HarnessRuntimeBase {
  type: "runtime.error";
  message: string;
}

export type HarnessRuntimeEvent =
  | HarnessRuntimeSessionStarted
  | HarnessRuntimeSessionStateChanged
  | HarnessRuntimeMessagesLoaded
  | HarnessRuntimeTurnStarted
  | HarnessRuntimeTurnCompleted
  | HarnessRuntimeContentDelta
  | HarnessRuntimeToolStarted
  | HarnessRuntimeToolProgress
  | HarnessRuntimeToolCompleted
  | HarnessRuntimeInteractiveRequested
  | HarnessRuntimeInteractiveResolved
  | HarnessRuntimeWarning
  | HarnessRuntimeError;

export interface HarnessCapabilities {
  modelPicker: boolean;
  thinkingLevels: boolean;
  commands: boolean;
  extensions: boolean;
  interactive: boolean;
  fileAttachments: boolean;
}

export interface HarnessDescriptor {
  kind: HarnessKind;
  label: string;
  version?: string;
  available: boolean;
  enabled: boolean;
  reason?: string;
  capabilities: HarnessCapabilities;
}

export interface HarnessRegistryBridge {
  list: () => Promise<HarnessDescriptor[]>;
  setEnabled: (kind: HarnessKind, enabled: boolean) => Promise<void>;
  setDefault: (kind: HarnessKind) => Promise<void>;
  getDefault: () => Promise<HarnessKind>;
  onChange: (fn: (descriptors: HarnessDescriptor[]) => void) => () => void;
}
