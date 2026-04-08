import type { HarnessKind, HarnessModelRef, ThreadInteractiveKind } from "./harness";
import type { ThinkingLevel } from "./pi";

export interface GlassTextBlock {
  type: "text";
  text: string;
}

export interface GlassThinkingBlock {
  type: "thinking";
  thinking: string;
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

export type GlassSlashCommandSource = "prompt" | "skill";

export interface GlassSlashCommand {
  name: string;
  description?: string;
  source: GlassSlashCommandSource;
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

export interface GlassSessionMessageEntry {
  type: "message";
  id: string;
  parentId: string | null;
  timestamp: string;
  message: GlassMessage;
}

export interface GlassSessionThinkingEntry {
  type: "thinking_level_change";
  id: string;
  parentId: string | null;
  timestamp: string;
  thinkingLevel: string;
}

export interface GlassSessionModelEntry {
  type: "model_change";
  id: string;
  parentId: string | null;
  timestamp: string;
  provider: string;
  modelId: string;
}

export interface GlassSessionCompactionEntry {
  type: "compaction";
  id: string;
  parentId: string | null;
  timestamp: string;
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  details?: unknown;
  fromHook?: boolean;
}

export interface GlassSessionBranchSummaryEntry {
  type: "branch_summary";
  id: string;
  parentId: string | null;
  timestamp: string;
  fromId: string;
  summary: string;
  details?: unknown;
  fromHook?: boolean;
}

export interface GlassSessionCustomEntry {
  type: "custom";
  id: string;
  parentId: string | null;
  timestamp: string;
  customType: string;
  data?: unknown;
}

export interface GlassSessionCustomMessageEntry {
  type: "custom_message";
  id: string;
  parentId: string | null;
  timestamp: string;
  customType: string;
  content: string | GlassBlock[];
  details?: unknown;
  display: boolean;
}

export interface GlassSessionLabelEntry {
  type: "label";
  id: string;
  parentId: string | null;
  timestamp: string;
  targetId: string;
  label: string | undefined;
}

export interface GlassSessionInfoEntry {
  type: "session_info";
  id: string;
  parentId: string | null;
  timestamp: string;
  name?: string;
}

export type GlassSessionEntry =
  | GlassSessionMessageEntry
  | GlassSessionThinkingEntry
  | GlassSessionModelEntry
  | GlassSessionCompactionEntry
  | GlassSessionBranchSummaryEntry
  | GlassSessionCustomEntry
  | GlassSessionCustomMessageEntry
  | GlassSessionLabelEntry
  | GlassSessionInfoEntry;

export interface GlassSessionTreeNode {
  entry: GlassSessionEntry;
  children: GlassSessionTreeNode[];
  label?: string;
}

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

export interface GlassSessionMeta {
  model: HarnessModelRef | null;
  thinkingLevel: ThinkingLevel;
  isStreaming: boolean;
  pending: GlassSessionPending;
}

export interface GlassSessionSnapshot {
  id: string;
  /** Present when the session is tied to a harness-backed thread. */
  harness?: HarnessKind;
  file: string | null;
  cwd: string;
  name: string | null;
  model: HarnessModelRef | null;
  thinkingLevel: ThinkingLevel;
  messages: GlassSessionItem[];
  live: GlassSessionItem | null;
  tree: GlassSessionTreeNode[];
  isStreaming: boolean;
  pending: GlassSessionPending;
}

export interface GlassSessionEvent {
  type: string;
  [key: string]: unknown;
}

export interface GlassSessionSummaryUpsert {
  lane: "summary";
  type: "upsert";
  sessionId: string;
  summary: GlassSessionSummary;
  event?: GlassSessionEvent;
}

export interface GlassSessionSummaryRemove {
  lane: "summary";
  type: "remove";
  sessionId: string;
  event?: GlassSessionEvent;
}

export type GlassSessionSummaryEvent = GlassSessionSummaryUpsert | GlassSessionSummaryRemove;

export interface GlassSessionSyncDelta {
  type: "sync";
  snapshot: GlassSessionSnapshot;
}

export interface GlassSessionCommitDelta {
  type: "commit";
  item: GlassSessionItem;
  meta: GlassSessionMeta;
}

export interface GlassSessionLiveDelta {
  type: "live";
  item: GlassSessionItem | null;
  meta: GlassSessionMeta;
}

export interface GlassSessionMetaDelta {
  type: "meta";
  meta: GlassSessionMeta;
}

export type GlassSessionDelta =
  | GlassSessionSyncDelta
  | GlassSessionCommitDelta
  | GlassSessionLiveDelta
  | GlassSessionMetaDelta;

export interface GlassSessionActiveEvent {
  lane: "active";
  sessionId: string;
  delta: GlassSessionDelta;
  event: GlassSessionEvent;
}

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

export interface GlassAskEvent {
  sessionId: string;
  state: GlassAskState | null;
}

export type GlassSessionBridgeEvent = GlassSessionSummaryEvent | GlassSessionActiveEvent;

export interface SessionBridge {
  list: () => Promise<GlassSessionSummary[]>;
  listAll: () => Promise<GlassSessionSummary[]>;
  create: () => Promise<GlassSessionSnapshot>;
  get: (sessionId: string) => Promise<GlassSessionSnapshot>;
  read: (sessionId: string) => Promise<GlassSessionSnapshot>;
  watch: (sessionId: string) => Promise<GlassSessionSnapshot>;
  unwatch: () => Promise<void>;
  prompt: (sessionId: string, input: string | GlassPromptInput) => Promise<void>;
  abort: (sessionId: string) => Promise<void>;
  setModel: (sessionId: string, provider: string, model: string) => Promise<void>;
  setThinkingLevel: (sessionId: string, thinkingLevel: ThinkingLevel) => Promise<void>;
  commands: (sessionId: string) => Promise<GlassSlashCommand[]>;
  readAsk: (sessionId: string) => Promise<GlassAskState | null>;
  answerAsk: (sessionId: string, reply: GlassAskReply) => Promise<void>;
  onAsk: (listener: (event: GlassAskEvent) => void) => () => void;
  onSummary: (listener: (event: GlassSessionSummaryEvent) => void) => () => void;
  onActive: (listener: (event: GlassSessionActiveEvent) => void) => () => void;
}
