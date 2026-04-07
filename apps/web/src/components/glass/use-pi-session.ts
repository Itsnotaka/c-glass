import type {
  PiAskReply,
  PiAskState,
  PiBlock,
  PiPromptInput,
  PiSessionItem,
  PiThinkingLevel,
  PiToolCallBlock,
} from "@glass/contracts";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { usePiDefaults } from "../../hooks/use-pi-models";
import { getGlass, readGlass } from "../../host";
import { PI_GLASS_SHELL_CHANGED_EVENT } from "../../lib/pi-glass-constants";
import {
  readPiProvider,
  startPiOAuthLogin,
  writePiApiKey,
  writePiDefaultModel,
  writePiDefaultThinkingLevel,
  type PiModelItem,
} from "../../lib/pi-models";
import { useGlassProviderAuthStore } from "../../lib/glass-provider-auth-store";
import { useGlassShellStore } from "../../lib/glass-shell-store";
import { usePiStore } from "../../lib/pi-session-store";

const empty: PiSessionItem[] = [];
const dbgUrl = "http://localhost:60380/debug";

function dbg(label: string, data: Record<string, unknown>) {
  void fetch(dbgUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, data }),
  }).catch(() => {});
}

function authError(message: string) {
  const text = message.toLowerCase();
  return text.includes("api key") || text.includes("auth") || text.includes("credential");
}

function paths(item: PiSessionItem | null) {
  const msg = item?.message;
  if (!msg || msg.role !== "assistant" || !Array.isArray(msg.content)) return [];

  return (msg.content as readonly PiBlock[]).reduce<string[]>((out, part) => {
    if (part.type !== "toolCall") return out;
    if (part.name !== "edit" && part.name !== "write") return out;

    const tool = part as PiToolCallBlock;
    const args = tool.arguments;
    const path = args?.path;
    if (typeof path === "string" && path.trim()) out.push(path);
    if (part.name !== "edit" || !Array.isArray(args?.multi)) return out;

    const list = args.multi as Array<{ path?: string } | null>;
    list.reduce<string[]>((next, item) => {
      if (!item || typeof item !== "object") return next;
      const path = item.path;
      if (typeof path !== "string" || !path.trim()) return next;
      next.push(path);
      return next;
    }, out);

    return out;
  }, []);
}

function dirty(item: PiSessionItem | null) {
  const msg = item?.message;
  if (!msg || msg.role !== "toolResult") return false;
  return msg.toolName === "edit" || msg.toolName === "write";
}

export function usePiSession(sessionId: string | null) {
  const navigate = useNavigate();
  const defs = usePiDefaults();
  const applyActs = usePiStore((state) => state.applyActs);
  const putSnap = usePiStore((state) => state.putSnap);
  const openAuth = useGlassProviderAuthStore((state) => state.open);
  const note = useGlassShellStore((state) => state.note);
  const bumpPaths = useGlassShellStore((state) => state.bump);
  const sid = usePiStore(
    useMemo(
      () => (state) => (sessionId ? (state.snaps[sessionId]?.id ?? null) : null),
      [sessionId],
    ),
  );
  const messages = usePiStore(
    useMemo(
      () => (state) => (sessionId ? (state.snaps[sessionId]?.messages ?? empty) : empty),
      [sessionId],
    ),
  );
  const live = usePiStore(
    useMemo(
      () => (state) => (sessionId ? (state.snaps[sessionId]?.live ?? null) : null),
      [sessionId],
    ),
  );
  const busy = usePiStore(
    useMemo(
      () => (state) => (sessionId ? (state.snaps[sessionId]?.isStreaming ?? false) : false),
      [sessionId],
    ),
  );
  const sessionModel = usePiStore(
    useMemo(
      () => (state) => (sessionId ? (state.snaps[sessionId]?.model ?? null) : null),
      [sessionId],
    ),
  );
  const [tick, setTick] = useState(0);
  const [ask, setAsk] = useState<PiAskState | null>(null);
  const pending = useRef<(() => Promise<void>) | null>(null);
  const queued = useRef<Parameters<typeof applyActs>[0]>([]);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const glass = readGlass();
    const reload = () => {
      setTick((value) => value + 1);
    };

    const off = glass?.desktop.onBootRefresh?.(reload) ?? (() => {});
    window.addEventListener(PI_GLASS_SHELL_CHANGED_EVENT, reload);
    return () => {
      window.removeEventListener(PI_GLASS_SHELL_CHANGED_EVENT, reload);
      off();
    };
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setAsk(null);
      return;
    }

    const glass = readGlass();
    if (!glass) return;

    let live = true;

    void glass.session
      .readAsk(sessionId)
      .then((state) => {
        if (!live) return;
        setAsk(state);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const glass = readGlass();
    if (!glass) return;

    let live = true;

    void glass.session
      .watch(sessionId)
      .then((snap) => {
        if (!live) return;
        dbg("ui-watch-success", { sessionId, messageCount: snap.messages.length });
        putSnap(snap);
      })
      .catch((err) => {
        dbg("ui-watch-error", {
          sessionId,
          message: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      live = false;
      void glass.session.unwatch();
    };
  }, [putSnap, sessionId, tick]);

  useEffect(() => {
    if (!sessionId) return;

    const glass = readGlass();
    if (!glass) return;

    const cancel = () => {
      const id = frame.current;
      frame.current = null;
      if (id !== null) {
        window.cancelAnimationFrame(id);
      }
    };

    const off = glass.session.onActive((event) => {
      dbg("ui-on-active", {
        sessionId,
        eventSessionId: event.sessionId,
        deltaType: event.delta.type,
      });
      if (event.sessionId !== sessionId) return;
      queued.current.push(event);
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        const batch = queued.current;
        queued.current = [];
        if (batch.length === 0) return;
        const hits = batch.flatMap((item) =>
          item.delta.type === "commit" ? paths(item.delta.item) : [],
        );
        if (hits.length > 0) note(hits);
        if (batch.some((item) => item.delta.type === "commit" && dirty(item.delta.item))) {
          bumpPaths();
        }
        startTransition(() => {
          applyActs(batch);
        });
      });
    });
    return () => {
      cancel();
      queued.current = [];
      off();
    };
  }, [applyActs, bumpPaths, note, sessionId, tick]);

  useEffect(() => {
    if (!sessionId) return;

    const glass = readGlass();
    if (!glass) return;

    const off = glass.session.onAsk((event) => {
      dbg("ui-on-ask", {
        sessionId,
        eventSessionId: event.sessionId,
        active: Boolean(event.state),
        toolCallId: event.state?.toolCallId ?? null,
      });
      if (event.sessionId !== sessionId) return;
      setAsk(event.state);
    });

    return () => {
      off();
    };
  }, [sessionId]);

  const model = sessionId ? sessionModel : defs.model;
  const modelLoading = !sessionId && defs.status === "loading";

  const showProvider = async (task: () => Promise<void>, name: string) => {
    const next = await readPiProvider(name);
    pending.current = task;
    const mode = next.credentialType === "oauth" || next.oauthSupported ? "oauth" : "api_key";
    openAuth({
      provider: name,
      mode,
      oauthSupported: next.oauthSupported,
      run: async (key) => {
        if (key && mode === "api_key") {
          await writePiApiKey(name, key);
          const next = pending.current;
          pending.current = null;
          if (next) {
            await next();
            return;
          }
        }
        pending.current = null;
      },
      ...(mode === "oauth"
        ? {
            oauth: async () => {
              await startPiOAuthLogin(name);
              const next = pending.current;
              pending.current = null;
              if (!next) return;
              await next();
            },
          }
        : {}),
    });
  };

  const ensureSession = async () => {
    dbg("ui-ensure-session-enter", { sessionId, sid });
    if (sessionId) return sessionId;
    if (sid) return sid;
    dbg("ui-session-create-start", { sid });
    const next = await getGlass().session.create();
    dbg("ui-session-create-success", {
      id: next.id,
      cwd: next.cwd,
      file: next.file,
      messageCount: next.messages.length,
    });
    putSnap(next);
    void navigate({
      to: "/$threadId",
      params: { threadId: next.id },
      replace: true,
    });
    return next.id;
  };

  const send = (input: string | PiPromptInput) => {
    const next =
      typeof input === "string"
        ? { text: input.trim() }
        : input.attachments?.length
          ? { text: input.text.trim(), attachments: input.attachments }
          : { text: input.text.trim() };
    dbg("ui-send-called", {
      sessionId,
      sid,
      textLen: next.text.length,
      attachmentCount: next.attachments?.length ?? 0,
    });
    if (!next.text && !next.attachments?.length) return;

    const task = async () => {
      const id = await ensureSession();
      dbg("ui-prompt-start", {
        id,
        textLen: next.text.length,
        attachmentCount: next.attachments?.length ?? 0,
      });
      try {
        await getGlass().session.prompt(id, next);
        dbg("ui-prompt-success", { id });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        dbg("ui-prompt-error", {
          id,
          message,
          provider: model?.provider ?? null,
        });
        if (!model?.provider || !authError(message)) throw err;
        await showProvider(task, model.provider);
      }
    };

    void task();
  };

  const abort = () => {
    if (!sid) return;
    void getGlass().session.abort(sid);
  };

  const setModel = (next: PiModelItem) => {
    const task = async () => {
      if (!sessionId) {
        await writePiDefaultModel(next);
        return;
      }
      try {
        await getGlass().session.setModel(sessionId, next.provider, next.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!authError(message)) throw err;
        await showProvider(task, next.provider);
      }
    };

    void task();
  };

  const setThinkingLevel = (level: PiThinkingLevel) => {
    const task = async () => {
      if (!sessionId) {
        await writePiDefaultThinkingLevel(level);
        return;
      }
      await getGlass().session.setThinkingLevel(sessionId, level);
    };

    void task();
  };

  const answerAsk = (reply: PiAskReply) => {
    if (!sessionId) return;
    dbg("ui-answer-ask", {
      sessionId,
      replyType: reply.type,
      questionId: "questionId" in reply ? reply.questionId : null,
      values: "values" in reply ? (reply.values ?? null) : null,
      custom: "custom" in reply ? (reply.custom ?? null) : null,
    });
    void getGlass().session.answerAsk(sessionId, reply);
  };

  return {
    messages,
    live,
    ask,
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
