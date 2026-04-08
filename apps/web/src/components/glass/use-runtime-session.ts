import type {
  CommandId,
  GlassAskReply,
  GlassAskState,
  GlassPromptInput,
  GlassSessionItem,
  HarnessKind,
  MessageId,
  ThinkingLevel,
  ThreadId,
} from "@glass/contracts";
import { startTransition, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useRuntimeDefaults } from "../../hooks/use-runtime-models";
import { useShellState } from "../../hooks/use-shell-cwd";
import { readNativeApi } from "../../nativeApi";
import {
  applyThinking,
  writeRuntimeDefaultModel,
  writeRuntimeDefaultThinkingLevel,
  type RuntimeModelItem,
} from "../../lib/runtime-models";
import { useGlassChatDraftStore } from "../../lib/glass-chat-draft-store";
import { useThreadSessionStore } from "../../lib/thread-session-store";
import { derivePendingApprovals, derivePendingUserInputs } from "../../session-logic";
import { useStore } from "../../store";

const empty: GlassSessionItem[] = [];

const commandId = () => crypto.randomUUID() as CommandId;
const newThreadId = () => crypto.randomUUID() as ThreadId;
const newMessageId = () => crypto.randomUUID() as MessageId;

function foldAttachments(input: GlassPromptInput) {
  const inline = (input.attachments ?? []).flatMap((item) => {
    if (item.type !== "inline") return [];
    return [
      {
        type: "image" as const,
        name: item.name,
        mimeType: item.mimeType,
        sizeBytes: Math.floor((item.data.length * 3) / 4),
        dataUrl: `data:${item.mimeType};base64,${item.data}`,
      },
    ];
  });
  const refs = (input.attachments ?? [])
    .flatMap((item) => (item.type === "path" ? [item.path] : []))
    .map((item) => `@${item}`)
    .join("\n");
  const text = refs ? `${input.text.trim()}\n\n${refs}`.trim() : input.text.trim();
  return { text, attachments: inline };
}

function approvalAsk(threadId: string, requestId: string, detail?: string): GlassAskState {
  return {
    sessionId: threadId,
    toolCallId: requestId,
    kind: "select",
    current: 0,
    values: {},
    custom: {},
    questions: [
      {
        id: "approval",
        text: detail?.trim() || "Choose how to respond to this approval request.",
        options: [
          { id: "accept", label: "Accept", recommended: true },
          { id: "acceptForSession", label: "Accept For Session" },
          { id: "decline", label: "Decline" },
          { id: "cancel", label: "Cancel" },
        ],
      },
    ],
  };
}

function inputAsk(
  threadId: string,
  requestId: string,
  questions: ReturnType<typeof derivePendingUserInputs>[number]["questions"],
): GlassAskState {
  return {
    sessionId: threadId,
    toolCallId: requestId,
    kind: "select",
    current: 0,
    values: {},
    custom: {},
    questions: questions.map((item) => ({
      id: item.id,
      text: `${item.header}\n\n${item.question}`,
      options: item.options.map((option) => ({
        id: option.label,
        label: option.label,
      })),
      ...(item.multiSelect ? { multi: item.multiSelect } : {}),
    })),
  };
}

export function useRuntimeSession(sessionId: string | null, harness?: HarnessKind | null) {
  const api = readNativeApi();
  const navigate = useNavigate();
  const shell = useShellState();
  const defs = useRuntimeDefaults();
  const threads = useStore((state) => state.threads);
  const projects = useStore((state) => state.projects);
  const messages = useThreadSessionStore(
    useMemo(
      () => (state) => (sessionId ? (state.snaps[sessionId]?.messages ?? empty) : empty),
      [sessionId],
    ),
  );
  const live = useThreadSessionStore(
    useMemo(
      () => (state) => (sessionId ? (state.snaps[sessionId]?.live ?? null) : null),
      [sessionId],
    ),
  );
  const busy = useThreadSessionStore(
    useMemo(
      () => (state) => (sessionId ? (state.snaps[sessionId]?.isStreaming ?? false) : false),
      [sessionId],
    ),
  );
  const sessionModel = useThreadSessionStore(
    useMemo(
      () => (state) => (sessionId ? (state.snaps[sessionId]?.model ?? null) : null),
      [sessionId],
    ),
  );
  const thread = sessionId ? (threads.find((item) => item.id === sessionId) ?? null) : null;
  const project = useMemo(() => {
    const shellProject = projects.find((item) => item.cwd === shell.cwd) ?? null;
    const threadProject = thread
      ? (projects.find((item) => item.id === thread.projectId) ?? null)
      : null;
    return shellProject ?? threadProject ?? projects[0] ?? null;
  }, [projects, shell.cwd, thread]);

  const askBox = useMemo(() => {
    if (!thread) return null;
    const input = derivePendingUserInputs(thread.activities)[0];
    if (input) {
      return {
        mode: "input" as const,
        requestId: input.requestId,
        state: inputAsk(thread.id, input.requestId, input.questions),
      };
    }
    const approval = derivePendingApprovals(thread.activities)[0];
    if (approval) {
      return {
        mode: "approval" as const,
        requestId: approval.requestId,
        state: approvalAsk(thread.id, approval.requestId, approval.detail),
      };
    }
    return null;
  }, [thread]);

  const model = sessionId ? sessionModel : defs.model;
  const modelLoading = !sessionId && defs.status === "loading";

  const ensureThread = async (
    seed: string,
    draft?: { id: string; title: string | null } | null,
  ) => {
    if (sessionId) return sessionId as ThreadId;
    if (!api || !project) {
      throw new Error("No active project available.");
    }

    const nextThreadId = newThreadId();
    const kind: "codex" | "claudeAgent" = harness === "claudeCode" ? "claudeAgent" : "codex";
    const modelSelection =
      !defs.stored && harness
        ? {
            provider: kind,
            model: defs.items.find((item) => item.provider === kind)?.id ?? defs.selection.model,
          }
        : defs.selection;

    await api.orchestration.dispatchCommand({
      type: "thread.create",
      commandId: commandId(),
      threadId: nextThreadId,
      projectId: project.id,
      title: draft?.title?.trim() || seed || "New chat",
      modelSelection,
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: null,
      worktreePath: null,
      createdAt: new Date().toISOString(),
    });
    if (draft?.id) {
      useGlassChatDraftStore.getState().promote(draft.id);
    }

    startTransition(() => {
      void navigate({ to: "/$threadId", params: { threadId: nextThreadId }, replace: true });
    });
    return nextThreadId;
  };

  const send = async (
    input: string | GlassPromptInput,
    draft?: { id: string; title: string | null } | null,
  ) => {
    const payload =
      typeof input === "string" ? { text: input.trim(), attachments: [] } : foldAttachments(input);
    if (!payload.text && payload.attachments.length === 0) return false;
    if (!api) return false;

    try {
      const nextThreadId = await ensureThread(payload.text.slice(0, 80), draft);
      const current = useStore.getState().threads.find((item) => item.id === nextThreadId) ?? null;
      await api.orchestration.dispatchCommand({
        type: "thread.turn.start",
        commandId: commandId(),
        threadId: nextThreadId,
        message: {
          messageId: newMessageId(),
          role: "user",
          text: payload.text,
          attachments: payload.attachments,
        },
        ...(current ? {} : { titleSeed: payload.text.slice(0, 80) || "New chat" }),
        createdAt: new Date().toISOString(),
        runtimeMode: current?.runtimeMode ?? "full-access",
        interactionMode: current?.interactionMode ?? "default",
      });
      return { clear: !draft?.id };
    } catch {
      return false;
    }
  };

  const abort = () => {
    if (!api || !thread?.session?.activeTurnId) return;
    void api.orchestration.dispatchCommand({
      type: "thread.turn.interrupt",
      commandId: commandId(),
      threadId: thread.id,
      turnId: thread.session.activeTurnId,
      createdAt: new Date().toISOString(),
    });
  };

  const setModel = (next: RuntimeModelItem) => {
    if (!sessionId) {
      void writeRuntimeDefaultModel(next);
      return;
    }
    if (!api || !thread) return;
    const selection = {
      provider: next.provider as "codex" | "claudeAgent",
      model: next.id,
    };
    void api.orchestration.dispatchCommand({
      type: "thread.meta.update",
      commandId: commandId(),
      threadId: thread.id,
      modelSelection: applyThinking(
        selection,
        useThreadSessionStore.getState().snaps[thread.id]?.thinkingLevel ?? "off",
      ),
    });
  };

  const setThinkingLevel = (level: ThinkingLevel) => {
    if (!sessionId) {
      void writeRuntimeDefaultThinkingLevel(level);
      return;
    }
    if (!api || !thread) return;
    void api.orchestration.dispatchCommand({
      type: "thread.meta.update",
      commandId: commandId(),
      threadId: thread.id,
      modelSelection: applyThinking(thread.modelSelection, level),
    });
  };

  const answerAsk = (reply: GlassAskReply) => {
    if (!api || !thread || !askBox) return;
    if (askBox.mode === "approval") {
      const decision =
        reply.type === "abort"
          ? "cancel"
          : "values" in reply
            ? ((reply.values[0] ?? "cancel") as
                | "accept"
                | "acceptForSession"
                | "decline"
                | "cancel")
            : "cancel";
      void api.orchestration.dispatchCommand({
        type: "thread.approval.respond",
        commandId: commandId(),
        threadId: thread.id,
        requestId: askBox.requestId,
        decision,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    if (reply.type === "abort") return;

    const answers = {
      [reply.questionId]: reply.custom?.trim() ? reply.custom.trim() : reply.values,
    };
    void api.orchestration.dispatchCommand({
      type: "thread.user-input.respond",
      commandId: commandId(),
      threadId: thread.id,
      requestId: askBox.requestId,
      answers,
      createdAt: new Date().toISOString(),
    });
  };

  return {
    messages,
    live,
    ask: askBox?.state ?? null,
    busy,
    model,
    modelLoading,
    answerAsk,
    send,
    abort,
    setModel,
    setThinkingLevel,
  };
}
