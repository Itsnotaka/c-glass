import type {
  CommandId,
  GlassAskReply,
  GlassAskState,
  GlassPromptInput,
  GlassSessionItem,
  HarnessKind,
  MessageId,
  ProviderInteractionMode,
  ThinkingLevel,
  ThreadId,
} from "@glass/contracts";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useRuntimeDefaults } from "~/hooks/use-runtime-models";
import { useShellState } from "~/hooks/use-shell-cwd";
import { readNativeApi } from "~/native-api";
import { useServerProviders } from "~/rpc/server-state";
import {
  applyFastMode,
  applyThinking,
  resolveRuntimeSelection,
  selectionSupportsFastMode,
  selectionToFastMode,
  writeRuntimeDefaultFastMode,
  writeRuntimeDefaultModel,
  writeRuntimeDefaultThinkingLevel,
  type RuntimeModelItem,
} from "~/lib/runtime-models";
import { hasTurnThinking } from "~/lib/assistant-content";
import { useGlassChatDraftStore } from "~/lib/glass-chat-draft-store";
import {
  clearThreadPending,
  markThreadPending,
  useThreadSessionStore,
} from "~/lib/thread-session-store";
import { derivePendingApprovals, derivePendingUserInputs } from "~/session-logic";
import { useStore } from "~/store";

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
    current: 1,
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
    current: 1,
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

type InputDraft = {
  current: number;
  values: Record<string, string[]>;
  custom: Record<string, string>;
};

export function useRuntimeSession(sessionId: string | null, harness?: HarnessKind | null) {
  const api = readNativeApi();
  const navigate = useNavigate();
  const shell = useShellState();
  const defs = useRuntimeDefaults();
  const providers = useServerProviders();
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
  const work = useThreadSessionStore(
    useMemo(() => (state) => (sessionId ? (state.work[sessionId] ?? null) : null), [sessionId]),
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

  const pendingInputs = useMemo(
    () => (thread ? derivePendingUserInputs(thread.activities) : []),
    [thread],
  );
  const pendingApprovals = useMemo(
    () => (thread ? derivePendingApprovals(thread.activities) : []),
    [thread],
  );
  const [drafts, setDrafts] = useState<Record<string, InputDraft>>({});

  useEffect(() => {
    if (pendingInputs.length === 0) {
      setDrafts((cur) => (Object.keys(cur).length === 0 ? cur : {}));
      return;
    }

    setDrafts((cur) => {
      const ids = new Set<string>(pendingInputs.map((item) => item.requestId));
      const next = Object.fromEntries(Object.entries(cur).filter(([id]) => ids.has(id))) as Record<
        string,
        InputDraft
      >;
      let changed = Object.keys(next).length !== Object.keys(cur).length;

      for (const item of pendingInputs) {
        if (next[item.requestId]) {
          continue;
        }
        next[item.requestId] = { current: 1, values: {}, custom: {} };
        changed = true;
      }

      return changed ? next : cur;
    });
  }, [pendingInputs]);

  const askBox = useMemo(() => {
    if (!thread) return null;
    const input = pendingInputs[0];
    if (input) {
      const base = inputAsk(thread.id, input.requestId, input.questions);
      const draft = drafts[input.requestId];
      const current = draft?.current ?? 1;
      const max = Math.max(base.questions.length, 1);
      return {
        mode: "input" as const,
        requestId: input.requestId,
        state: {
          ...base,
          current: Math.max(1, Math.min(current, max)),
          values: draft?.values ?? {},
          custom: draft?.custom ?? {},
        },
      };
    }
    const approval = pendingApprovals[0];
    if (approval) {
      return {
        mode: "approval" as const,
        requestId: approval.requestId,
        state: approvalAsk(thread.id, approval.requestId, approval.detail),
      };
    }
    return null;
  }, [drafts, pendingApprovals, pendingInputs, thread]);

  const model = sessionId ? sessionModel : defs.model;
  const modelLoading = !sessionId && defs.status === "loading";
  const fastActive = sessionId ? selectionToFastMode(thread?.modelSelection) : defs.fastMode;
  const fastSupported = sessionId
    ? selectionSupportsFastMode(providers, thread?.modelSelection)
    : defs.fastSupported;
  const since = busy
    ? (work?.startedAt ?? thread?.latestTurn?.startedAt ?? thread?.latestTurn?.requestedAt ?? null)
    : null;
  const normalize = useCallback(
    (selection: typeof defs.selection) =>
      providers.length > 0 ? resolveRuntimeSelection(providers, selection) : selection,
    [providers],
  );
  const turn = thread?.session?.activeTurnId ?? thread?.latestTurn?.turnId ?? null;
  const thinking = thread ? hasTurnThinking(thread.messages, turn) : false;

  const ensureThread = async (
    seed: string,
    draft?: { id: string; title: string | null; interactionMode?: ProviderInteractionMode } | null,
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

    const interactionMode =
      draft?.interactionMode ?? useGlassChatDraftStore.getState().root.interactionMode;

    await api.orchestration.dispatchCommand({
      type: "thread.create",
      commandId: commandId(),
      threadId: nextThreadId,
      projectId: project.id,
      title: draft?.title?.trim() || seed || "New chat",
      modelSelection,
      runtimeMode: "full-access",
      interactionMode,
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
    draft?: { id: string; title: string | null; interactionMode?: ProviderInteractionMode } | null,
  ) => {
    const payload =
      typeof input === "string" ? { text: input.trim(), attachments: [] } : foldAttachments(input);
    if (!payload.text && payload.attachments.length === 0) return false;
    if (!api) return false;

    const nextThreadId = await ensureThread(payload.text.slice(0, 80), draft);
    markThreadPending(nextThreadId);
    try {
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
    } finally {
      clearThreadPending(nextThreadId);
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
    const selection = normalize({
      provider: next.provider as "codex" | "claudeAgent",
      model: next.id,
      ...(thread.modelSelection.provider === next.provider && thread.modelSelection.options
        ? { options: thread.modelSelection.options }
        : {}),
    });
    void api.orchestration.dispatchCommand({
      type: "thread.meta.update",
      commandId: commandId(),
      threadId: thread.id,
      modelSelection: normalize(
        applyThinking(
          selection,
          useThreadSessionStore.getState().snaps[thread.id]?.thinkingLevel ?? "off",
        ),
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
      modelSelection: normalize(applyThinking(thread.modelSelection, level)),
    });
  };

  const setFastMode = (on: boolean) => {
    if (!sessionId) {
      void writeRuntimeDefaultFastMode(on);
      return;
    }
    if (!api || !thread) return;
    void api.orchestration.dispatchCommand({
      type: "thread.meta.update",
      commandId: commandId(),
      threadId: thread.id,
      modelSelection: normalize(applyFastMode(thread.modelSelection, on)),
    });
  };

  const toggleFastMode = () => {
    if (!fastSupported) return;
    setFastMode(!fastActive);
  };

  const setInteractionMode = useCallback(
    (mode: ProviderInteractionMode) => {
      if (!sessionId || !api || !thread) return;
      void api.orchestration.dispatchCommand({
        type: "thread.interaction-mode.set",
        commandId: commandId(),
        threadId: thread.id,
        interactionMode: mode,
        createdAt: new Date().toISOString(),
      });
    },
    [api, sessionId, thread],
  );

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

    const questions = askBox.state.questions;
    const total = Math.max(questions.length, 1);
    const current = Math.max(1, Math.min(askBox.state.current, total));
    const cur = drafts[askBox.requestId] ?? {
      current,
      values: askBox.state.values,
      custom: askBox.state.custom,
    };

    const respond = (answers: Record<string, unknown>) => {
      void api.orchestration.dispatchCommand({
        type: "thread.user-input.respond",
        commandId: commandId(),
        threadId: thread.id,
        requestId: askBox.requestId,
        answers,
        createdAt: new Date().toISOString(),
      });
    };

    const build = (next: InputDraft) => {
      const answers: Record<string, unknown> = {};
      for (const question of questions) {
        const custom = next.custom[question.id]?.trim();
        if (custom && custom.length > 0) {
          answers[question.id] = custom;
          continue;
        }

        const values = (next.values[question.id] ?? [])
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
        if (values.length === 0) {
          continue;
        }

        answers[question.id] = question.multi ? values : values[0];
      }
      return answers;
    };

    const answer = (
      next: InputDraft,
      input: { questionId: string; custom?: string; values?: string[] },
    ) => {
      const custom = input.custom?.trim();
      if (custom && custom.length > 0) {
        return {
          ...next,
          custom: {
            ...next.custom,
            [input.questionId]: custom,
          },
          values: Object.fromEntries(
            Object.entries(next.values).filter(([id]) => id !== input.questionId),
          ),
        };
      }

      const values = (input.values ?? [])
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      if (values.length > 0) {
        return {
          ...next,
          values: {
            ...next.values,
            [input.questionId]: values,
          },
          custom: Object.fromEntries(
            Object.entries(next.custom).filter(([id]) => id !== input.questionId),
          ),
        };
      }

      return {
        ...next,
        values: Object.fromEntries(
          Object.entries(next.values).filter(([id]) => id !== input.questionId),
        ),
        custom: Object.fromEntries(
          Object.entries(next.custom).filter(([id]) => id !== input.questionId),
        ),
      };
    };

    if (reply.type === "abort") {
      respond({});
      return;
    }

    if (reply.type === "back") {
      const next = answer(
        {
          current,
          values: { ...cur.values },
          custom: { ...cur.custom },
        },
        reply,
      );
      setDrafts((prev) => ({
        ...prev,
        [askBox.requestId]: {
          ...next,
          current: Math.max(1, current - 1),
        },
      }));
      return;
    }

    if (reply.type === "skip") {
      const next = {
        current,
        values: Object.fromEntries(
          Object.entries(cur.values).filter(([id]) => id !== reply.questionId),
        ),
        custom: Object.fromEntries(
          Object.entries(cur.custom).filter(([id]) => id !== reply.questionId),
        ),
      };
      if (current < questions.length) {
        setDrafts((prev) => ({
          ...prev,
          [askBox.requestId]: {
            ...next,
            current: current + 1,
          },
        }));
        return;
      }
      respond(build(next));
      return;
    }

    const next = answer(
      {
        current,
        values: { ...cur.values },
        custom: { ...cur.custom },
      },
      reply,
    );
    if (current < questions.length) {
      setDrafts((prev) => ({
        ...prev,
        [askBox.requestId]: {
          ...next,
          current: current + 1,
        },
      }));
      return;
    }

    respond(build(next));
  };

  return {
    messages,
    live,
    work,
    ask: askBox?.state ?? null,
    busy,
    thinking,
    since,
    model,
    modelLoading,
    fastActive,
    fastSupported,
    answerAsk,
    send,
    abort,
    setModel,
    setThinkingLevel,
    setFastMode,
    toggleFastMode,
    setInteractionMode,
  };
}
