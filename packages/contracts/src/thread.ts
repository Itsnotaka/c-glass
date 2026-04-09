import type {
  HarnessKind,
  HarnessModelRef,
  HarnessRuntimeEvent,
  ThreadInteractiveKind,
  ThreadRunState,
} from "./harness";
import type { GlassWorkingState } from "./orchestration";

export interface ThreadTextBlock {
  type: "text";
  text: string;
}

export interface ThreadThinkingBlock {
  type: "thinking";
  thinking: string;
  summary?: string;
}

export interface ThreadImageBlock {
  type: "image";
  mimeType?: string;
  data?: string;
}

export interface ThreadToolCallBlock {
  type: "toolCall";
  id?: string;
  name: string;
  arguments?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ThreadUnknownBlock {
  type: string;
  [key: string]: unknown;
}

export type ThreadBlock =
  | ThreadTextBlock
  | ThreadThinkingBlock
  | ThreadImageBlock
  | ThreadToolCallBlock
  | ThreadUnknownBlock;

export interface ThreadPromptPathAttachment {
  type: "path";
  path: string;
  name?: string;
}

export interface ThreadPromptInlineAttachment {
  type: "inline";
  name: string;
  mimeType: string;
  data: string;
}

export type ThreadPromptAttachment = ThreadPromptPathAttachment | ThreadPromptInlineAttachment;

export interface ThreadPromptInput {
  text: string;
  attachments?: ThreadPromptAttachment[];
}

export interface ThreadInteractiveOption {
  id: string;
  label: string;
  shortcut?: string;
  recommended?: boolean;
  other?: boolean;
}

export interface ThreadInteractiveQuestion {
  id: string;
  text: string;
  options: ThreadInteractiveOption[];
  multi?: boolean;
  optional?: boolean;
}

export interface ThreadInteractiveState {
  threadId: string;
  requestId: string;
  kind: ThreadInteractiveKind;
  questions: ThreadInteractiveQuestion[];
  current: number;
  values: Record<string, string[]>;
  custom: Record<string, string>;
}

export interface ThreadUserMessage {
  role: "user";
  content: string | ThreadBlock[];
}

export interface ThreadUserAttachmentMessage {
  role: "user-with-attachments";
  content: string | ThreadBlock[];
}

export interface ThreadAssistantMessage {
  role: "assistant";
  content: ThreadBlock[];
  stopReason?: string;
  errorMessage?: string;
}

export interface ThreadToolResultMessage {
  role: "toolResult";
  toolCallId?: string;
  content: ThreadBlock[];
  toolName?: string;
  isError?: boolean;
  details?: Record<string, unknown>;
}

export interface ThreadBashExecutionMessage {
  role: "bashExecution";
  command: string;
  output: string;
  exitCode?: number;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string;
  excludeFromContext?: boolean;
}

export interface ThreadCustomMessage {
  role: "custom";
  customType: string;
  content: string | ThreadBlock[];
  display: boolean;
  details?: unknown;
}

export interface ThreadBranchSummaryMessage {
  role: "branchSummary";
  summary: string;
  fromId: string;
}

export interface ThreadCompactionSummaryMessage {
  role: "compactionSummary";
  summary: string;
  tokensBefore: number;
}

export interface ThreadSystemMessage {
  role: "system";
  content: string | ThreadBlock[];
}

export interface ThreadUnknownMessage {
  role: string;
  [key: string]: unknown;
}

export type ThreadMessage =
  | ThreadUserMessage
  | ThreadUserAttachmentMessage
  | ThreadAssistantMessage
  | ThreadToolResultMessage
  | ThreadBashExecutionMessage
  | ThreadCustomMessage
  | ThreadBranchSummaryMessage
  | ThreadCompactionSummaryMessage
  | ThreadSystemMessage
  | ThreadUnknownMessage;

export interface ThreadItem {
  id: string;
  message: ThreadMessage;
}

export type ThreadInteractiveReply =
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

export interface ThreadSummary {
  id: string;
  harness: HarnessKind;
  path: string | null;
  cwd: string;
  name: string | null;
  createdAt: string;
  modifiedAt: string;
  messageCount: number;
  preview: string;
  search: string;
  state: ThreadRunState;
}

export interface ThreadSnapshot extends ThreadSummary {
  model: HarnessModelRef | null;
  interactive: ThreadInteractiveState | null;
  messages: ThreadItem[];
  live: ThreadItem | null;
  working: GlassWorkingState | null;
}

export interface ThreadSummaryUpsert {
  lane: "summary";
  type: "upsert";
  threadId: string;
  summary: ThreadSummary;
  event?: HarnessRuntimeEvent;
}

export interface ThreadSummaryRemove {
  lane: "summary";
  type: "remove";
  threadId: string;
  event?: HarnessRuntimeEvent;
}

export type ThreadSummaryEvent = ThreadSummaryUpsert | ThreadSummaryRemove;

export interface ThreadSyncDelta {
  type: "sync";
  snapshot: ThreadSnapshot;
}

export interface ThreadMetaDelta {
  type: "meta";
  snapshot: ThreadSnapshot;
}

export type ThreadDelta = ThreadSyncDelta | ThreadMetaDelta;

export interface ThreadActiveEvent {
  lane: "active";
  threadId: string;
  delta: ThreadDelta;
  event?: HarnessRuntimeEvent;
}

export interface ThreadInteractiveEvent {
  threadId: string;
  state: ThreadInteractiveState | null;
}

export interface ThreadBridge {
  list: () => Promise<ThreadSummary[]>;
  listAll: () => Promise<ThreadSummary[]>;
  create: (harness?: HarnessKind) => Promise<ThreadSnapshot>;
  start: (harness: HarnessKind, input: string | ThreadPromptInput) => Promise<ThreadSnapshot>;
  read: (threadId: string) => Promise<ThreadSnapshot>;
  watch: (threadId: string) => Promise<ThreadSnapshot>;
  unwatch: (threadId: string) => Promise<void>;
  prompt: (threadId: string, input: string | ThreadPromptInput) => Promise<void>;
  abort: (threadId: string) => Promise<void>;
  readInteractive: (threadId: string) => Promise<ThreadInteractiveState | null>;
  answerInteractive: (threadId: string, reply: ThreadInteractiveReply) => Promise<void>;
  onSummary: (listener: (event: ThreadSummaryEvent) => void) => () => void;
  onActive: (listener: (event: ThreadActiveEvent) => void) => () => void;
  onInteractive: (listener: (event: ThreadInteractiveEvent) => void) => () => void;
  onRuntime: (listener: (event: HarnessRuntimeEvent) => void) => () => void;
}
