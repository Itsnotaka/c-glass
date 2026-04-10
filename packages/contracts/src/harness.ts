import { Schema } from "effect";

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

export interface HarnessCapabilities {
  modelPicker: boolean;
  thinkingLevels: boolean;
  commands: boolean;
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
