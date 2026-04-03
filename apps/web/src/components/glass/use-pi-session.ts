import type { PiModelRef, PiPromptInput, PiSessionItem, PiThinkingLevel } from "@glass/contracts";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getGlass } from "../../host";
import {
  PI_GLASS_SETTINGS_CHANGED_EVENT,
  PI_GLASS_SHELL_CHANGED_EVENT,
} from "../../lib/pi-glass-constants";
import {
  readPiProvider,
  resolvePiDefaultModel,
  writePiApiKey,
  writePiDefaultModel,
  writePiDefaultThinkingLevel,
  type PiModelItem,
} from "../../lib/pi-models";
import { usePiStore } from "../../lib/pi-session-store";

const empty: PiSessionItem[] = [];

function authError(message: string) {
  const text = message.toLowerCase();
  return text.includes("api key") || text.includes("auth") || text.includes("credential");
}

export function usePiSession(sessionId: string | null) {
  const navigate = useNavigate();
  const applyActs = usePiStore((state) => state.applyActs);
  const putSnap = usePiStore((state) => state.putSnap);
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
  const [draftModel, setDraftModel] = useState<PiModelRef | null>(null);
  const [tick, setTick] = useState(0);
  const [provider, setProvider] = useState<{
    name: string;
    mode: "api_key" | "oauth";
    oauthSupported: boolean;
  } | null>(null);
  const pending = useRef<(() => Promise<void>) | null>(null);
  const queued = useRef<Parameters<typeof applyActs>[0]>([]);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (sessionId) return;

    let live = true;

    const load = () => {
      void resolvePiDefaultModel().then((model) => {
        if (!live) return;
        setDraftModel(model);
      });
    };

    load();
    window.addEventListener(PI_GLASS_SETTINGS_CHANGED_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(PI_GLASS_SETTINGS_CHANGED_EVENT, load);
    };
  }, [sessionId]);

  useEffect(() => {
    const bump = () => {
      setTick((cur) => cur + 1);
    };

    window.addEventListener(PI_GLASS_SHELL_CHANGED_EVENT, bump);
    return () => {
      window.removeEventListener(PI_GLASS_SHELL_CHANGED_EVENT, bump);
    };
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    let live = true;
    setDraftModel(null);
    void getGlass()
      .session.watch(sessionId)
      .then((next) => {
        if (!live) return;
        putSnap(next);
      })
      .catch(() => {});

    return () => {
      live = false;
      void getGlass().session.unwatch();
    };
  }, [putSnap, sessionId, tick]);

  useEffect(() => {
    if (!sessionId) return;

    const cancel = () => {
      const id = frame.current;
      frame.current = null;
      if (id !== null) {
        window.cancelAnimationFrame(id);
      }
    };

    const off = getGlass().session.onActive((event) => {
      if (event.sessionId !== sessionId) return;
      queued.current.push(event);
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        const next = queued.current;
        queued.current = [];
        if (next.length === 0) return;
        startTransition(() => {
          applyActs(next);
        });
      });
    });
    return () => {
      cancel();
      queued.current = [];
      off();
    };
  }, [applyActs, sessionId, tick]);

  const model = sessionModel ?? draftModel;

  const showProvider = async (task: () => Promise<void>, name: string) => {
    if (!model?.provider) throw new Error("Missing model provider");
    const next = await readPiProvider(name);
    pending.current = task;
    setProvider({
      name,
      mode: next.credentialType === "oauth" || next.oauthSupported ? "oauth" : "api_key",
      oauthSupported: next.oauthSupported,
    });
  };

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    if (sid) return sid;
    const next = await getGlass().session.create();
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
    if (!next.text && !next.attachments?.length) return;

    const task = async () => {
      const id = await ensureSession();
      try {
        await getGlass().session.prompt(id, next);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
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
        setDraftModel(next);
        await writePiDefaultModel(next);
        return;
      }
      try {
        await getGlass().session.setModel(sessionId, next.provider, next.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!authError(message)) throw err;
        pending.current = task;
        const auth = await readPiProvider(next.provider);
        setProvider({
          name: next.provider,
          mode: auth.credentialType === "oauth" || auth.oauthSupported ? "oauth" : "api_key",
          oauthSupported: auth.oauthSupported,
        });
      }
    };

    void task();
  };

  const resolve = async (key: string | undefined) => {
    const cur = provider;
    setProvider(null);
    if (key && cur?.mode === "api_key") {
      await writePiApiKey(cur.name, key);
      const next = pending.current;
      pending.current = null;
      if (next) {
        await next();
        return;
      }
    }
    pending.current = null;
  };

  const setThinkingLevel = (level: PiThinkingLevel) => {
    void writePiDefaultThinkingLevel(level);
  };

  return {
    messages,
    live,
    busy,
    model,
    provider,
    send,
    abort,
    setModel,
    resolve,
    setThinkingLevel,
  };
}
