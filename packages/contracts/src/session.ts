import type { HarnessKind, HarnessModelRef, ThreadInteractiveKind } from "./harness";
import type { GlassWorkingState } from "./orchestration";
import type { ThinkingLevel } from "./pi";

// ── Blocks ───────────────────────────────────────────────────────────

export interface GlassTextBlock {
  type: "text";
  text: string;
}

export interface GlassThinkingBlock {
  type: "thinking";
  thinking: string;
  summary?: string;
}

export interface GlassImageBlock {
  type: "image";
  mimeType?: string;
  data?: string;
}

export interface GlassToolCallBlock {
  type: "toolCall";
  id?: string;
  name: string;
  arguments?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GlassUnknownBlock {
  type: string;
  [key: string]: unknown;
}

export type GlassBlock =
  | GlassTextBlock
  | GlassThinkingBlock
  | GlassImageBlock
  | GlassToolCallBlock
  | GlassUnknownBlock;

export interface GlassPromptPathAttachment {
  type: "path";
  path: string;
  name?: string;
}

export interface GlassPromptInlineAttachment {
  type: "inline";
  name: string;
  mimeType: string;
  data: string;
}

export type GlassPromptAttachment = GlassPromptPathAttachment | GlassPromptInlineAttachment;

export interface GlassPromptInput {
  text: string;
  attachments?: GlassPromptAttachment[];
}

export interface GlassUserMessage {
  role: "user";
  content: string | GlassBlock[];
}

export interface GlassUserAttachmentMessage {
  role: "user-with-attachments";
  content: string | GlassBlock[];
}

export interface GlassAssistantMessage {
  role: "assistant";
  content: GlassBlock[];
  stopReason?: string;
  errorMessage?: string;
}

export interface GlassToolResultMessage {
  role: "toolResult";
  toolCallId?: string;
  content: GlassBlock[];
  toolName?: string;
  isError?: boolean;
  details?: Record<string, unknown>;
}

export interface GlassBashExecutionMessage {
  role: "bashExecution";
  command: string;
  output: string;
  exitCode?: number;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string;
  excludeFromContext?: boolean;
}

export interface GlassCustomMessage {
  role: "custom";
  customType: string;
  content: string | GlassBlock[];
  display: boolean;
  details?: unknown;
}

export interface GlassBranchSummaryMessage {
  role: "branchSummary";
  summary: string;
  fromId: string;
}

export interface GlassCompactionSummaryMessage {
  role: "compactionSummary";
  summary: string;
  tokensBefore: number;
}

export interface GlassSystemMessage {
  role: "system";
  content: string | GlassBlock[];
}

export interface GlassUnknownMessage {
  role: string;
  [key: string]: unknown;
}

export type GlassMessage =
  | GlassUserMessage
  | GlassUserAttachmentMessage
  | GlassAssistantMessage
  | GlassToolResultMessage
  | GlassBashExecutionMessage
  | GlassCustomMessage
  | GlassBranchSummaryMessage
  | GlassCompactionSummaryMessage
  | GlassSystemMessage
  | GlassUnknownMessage;

export interface GlassSessionItem {
  id: string;
  message: GlassMessage;
}

// ── Session view model ───────────────────────────────────────────────

export interface GlassSessionSummary {
  id: string;
  /** Runtime harness for this thread (sidebar, composer). */
  harness?: HarnessKind;
  path: string;
  cwd: string;
  name: string | null;
  createdAt: string;
  modifiedAt: string;
  messageCount: number;
  firstMessage: string;
  allMessagesText: string;
  isStreaming: boolean;
}

export interface GlassSessionPending {
  steering: string[];
  followUp: string[];
}

export interface GlassSessionSnapshot {
  id: string;
  harness?: HarnessKind;
  file: string | null;
  cwd: string;
  name: string | null;
  model: HarnessModelRef | null;
  thinkingLevel: ThinkingLevel;
  messages: GlassSessionItem[];
  live: GlassSessionItem | null;
  working: GlassWorkingState | null;
  isStreaming: boolean;
  pending: GlassSessionPending;
}

export interface GlassSessionActiveEvent {
  lane: "active";
  sessionId: string;
}

// ── Ask ──────────────────────────────────────────────────────────────

export interface GlassAskOption {
  id: string;
  label: string;
  shortcut?: string;
  recommended?: boolean;
  other?: boolean;
}

export interface GlassAskQuestion {
  id: string;
  text: string;
  options: GlassAskOption[];
  multi?: boolean;
  optional?: boolean;
}

export interface GlassAskState {
  sessionId: string;
  toolCallId: string;
  kind: ThreadInteractiveKind;
  questions: GlassAskQuestion[];
  current: number;
  values: Record<string, string[]>;
  custom: Record<string, string>;
}

export type GlassAskReply =
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
