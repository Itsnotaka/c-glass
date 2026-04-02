import type { PiModelRef, PiThinkingLevel } from "./pi";

export interface PiTextBlock {
  type: "text";
  text: string;
}

export interface PiThinkingBlock {
  type: "thinking";
  thinking: string;
}

export interface PiToolCallBlock {
  type: "toolCall";
  name: string;
  [key: string]: unknown;
}

export interface PiUnknownBlock {
  type: string;
  [key: string]: unknown;
}

export type PiBlock = PiTextBlock | PiThinkingBlock | PiToolCallBlock | PiUnknownBlock;

export interface PiUserMessage {
  role: "user";
  content: string | PiBlock[];
}

export interface PiUserAttachmentMessage {
  role: "user-with-attachments";
  content: string | PiBlock[];
}

export interface PiAssistantMessage {
  role: "assistant";
  content: PiBlock[];
  stopReason?: string;
  errorMessage?: string;
}

export interface PiToolResultMessage {
  role: "toolResult";
  toolCallId?: string;
  content: PiBlock[];
  toolName?: string;
  isError?: boolean;
}

export interface PiBashExecutionMessage {
  role: "bashExecution";
  command: string;
  output: string;
  exitCode?: number;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string;
  excludeFromContext?: boolean;
}

export interface PiCustomMessage {
  role: "custom";
  customType: string;
  content: string | PiBlock[];
  display: boolean;
  details?: unknown;
}

export interface PiBranchSummaryMessage {
  role: "branchSummary";
  summary: string;
  fromId: string;
}

export interface PiCompactionSummaryMessage {
  role: "compactionSummary";
  summary: string;
  tokensBefore: number;
}

export interface PiSystemMessage {
  role: "system";
  content: string | PiBlock[];
}

export interface PiUnknownMessage {
  role: string;
  [key: string]: unknown;
}

export type PiMessage =
  | PiUserMessage
  | PiUserAttachmentMessage
  | PiAssistantMessage
  | PiToolResultMessage
  | PiBashExecutionMessage
  | PiCustomMessage
  | PiBranchSummaryMessage
  | PiCompactionSummaryMessage
  | PiSystemMessage
  | PiUnknownMessage;

export interface PiSessionMessageEntry {
  type: "message";
  id: string;
  parentId: string | null;
  timestamp: string;
  message: PiMessage;
}

export interface PiSessionThinkingEntry {
  type: "thinking_level_change";
  id: string;
  parentId: string | null;
  timestamp: string;
  thinkingLevel: string;
}

export interface PiSessionModelEntry {
  type: "model_change";
  id: string;
  parentId: string | null;
  timestamp: string;
  provider: string;
  modelId: string;
}

export interface PiSessionCompactionEntry {
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

export interface PiSessionBranchSummaryEntry {
  type: "branch_summary";
  id: string;
  parentId: string | null;
  timestamp: string;
  fromId: string;
  summary: string;
  details?: unknown;
  fromHook?: boolean;
}

export interface PiSessionCustomEntry {
  type: "custom";
  id: string;
  parentId: string | null;
  timestamp: string;
  customType: string;
  data?: unknown;
}

export interface PiSessionCustomMessageEntry {
  type: "custom_message";
  id: string;
  parentId: string | null;
  timestamp: string;
  customType: string;
  content: string | PiBlock[];
  details?: unknown;
  display: boolean;
}

export interface PiSessionLabelEntry {
  type: "label";
  id: string;
  parentId: string | null;
  timestamp: string;
  targetId: string;
  label: string | undefined;
}

export interface PiSessionInfoEntry {
  type: "session_info";
  id: string;
  parentId: string | null;
  timestamp: string;
  name?: string;
}

export type PiSessionEntry =
  | PiSessionMessageEntry
  | PiSessionThinkingEntry
  | PiSessionModelEntry
  | PiSessionCompactionEntry
  | PiSessionBranchSummaryEntry
  | PiSessionCustomEntry
  | PiSessionCustomMessageEntry
  | PiSessionLabelEntry
  | PiSessionInfoEntry;

export interface PiSessionTreeNode {
  entry: PiSessionEntry;
  children: PiSessionTreeNode[];
  label?: string;
}

export interface PiSessionSummary {
  id: string;
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

export interface PiSessionPending {
  steering: string[];
  followUp: string[];
}

export interface PiSessionMeta {
  model: PiModelRef | null;
  thinkingLevel: PiThinkingLevel;
  isStreaming: boolean;
  pending: PiSessionPending;
}

export interface PiSessionSnapshot {
  id: string;
  file: string | null;
  cwd: string;
  name: string | null;
  model: PiModelRef | null;
  thinkingLevel: PiThinkingLevel;
  messages: PiMessage[];
  tree: PiSessionTreeNode[];
  isStreaming: boolean;
  pending: PiSessionPending;
}

export interface PiSessionEvent {
  type: string;
  [key: string]: unknown;
}

export interface PiSessionSummaryUpsert {
  lane: "summary";
  type: "upsert";
  sessionId: string;
  summary: PiSessionSummary;
  event?: PiSessionEvent;
}

export interface PiSessionSummaryRemove {
  lane: "summary";
  type: "remove";
  sessionId: string;
  event?: PiSessionEvent;
}

export type PiSessionSummaryEvent = PiSessionSummaryUpsert | PiSessionSummaryRemove;

export interface PiSessionSyncDelta {
  type: "sync";
  snapshot: PiSessionSnapshot;
}

export interface PiSessionAppendDelta {
  type: "append";
  message: PiMessage;
  meta: PiSessionMeta;
}

export interface PiSessionReplaceDelta {
  type: "replace";
  message: PiMessage;
  meta: PiSessionMeta;
}

export interface PiSessionMetaDelta {
  type: "meta";
  meta: PiSessionMeta;
}

export type PiSessionDelta =
  | PiSessionSyncDelta
  | PiSessionAppendDelta
  | PiSessionReplaceDelta
  | PiSessionMetaDelta;

export interface PiSessionActiveEvent {
  lane: "active";
  sessionId: string;
  delta: PiSessionDelta;
  event: PiSessionEvent;
}

export type PiSessionBridgeEvent = PiSessionSummaryEvent | PiSessionActiveEvent;

export interface SessionBridge {
  list: () => Promise<PiSessionSummary[]>;
  create: () => Promise<PiSessionSnapshot>;
  get: (sessionId: string) => Promise<PiSessionSnapshot>;
  watch: (sessionId: string) => Promise<PiSessionSnapshot>;
  unwatch: () => Promise<void>;
  prompt: (sessionId: string, text: string) => Promise<void>;
  abort: (sessionId: string) => Promise<void>;
  setModel: (sessionId: string, provider: string, model: string) => Promise<void>;
  onSummary: (listener: (event: PiSessionSummaryEvent) => void) => () => void;
  onActive: (listener: (event: PiSessionActiveEvent) => void) => () => void;
}
