import type { PiModelRef, PiSessionSnapshot } from "@glass/contracts";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getGlass } from "../../host";
import { PI_GLASS_SETTINGS_CHANGED_EVENT } from "../../lib/pi-glass-constants";
import {
  readPiProvider,
  resolvePiDefaultModel,
  writePiApiKey,
  writePiDefaultModel,
  type PiModelItem,
} from "../../lib/pi-models";

function authError(message: string) {
  const text = message.toLowerCase();
  return text.includes("api key") || text.includes("auth") || text.includes("credential");
}

function same(left: PiModelRef | null | undefined, right: PiModelRef | null | undefined) {
  if (!left || !right) return false;
  return left.provider === right.provider && left.id === right.id;
}

export function usePiSession(sessionId: string | null) {
  const navigate = useNavigate();
  const [snap, setSnap] = useState<PiSessionSnapshot | null>(null);
  const [draftModel, setDraftModel] = useState<PiModelRef | null>(null);
  const [pick, setPick] = useState<PiModelRef | null>(null);
  const [provider, setProvider] = useState<{
    name: string;
    mode: "api_key" | "oauth";
    oauthSupported: boolean;
  } | null>(null);
  const pending = useRef<(() => Promise<void>) | null>(null);
  const sid = useRef(sessionId);

  useEffect(() => {
    sid.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) return;

    let live = true;

    const load = () => {
      setPick(null);
      setSnap(null);
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
    if (!sessionId) return;

    let live = true;
    setPick(null);
    setDraftModel(null);
    setSnap((cur) => (cur?.id === sessionId ? cur : null));
    void getGlass()
      .session.get(sessionId)
      .then((next) => {
        if (!live) return;
        setSnap(next);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [sessionId]);

  useEffect(() => {
    const off = getGlass().session.onEvent((event) => {
      if (event.sessionId !== sessionId) return;
      setSnap(event.snapshot);
    });
    return () => {
      off();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!pick || !same(pick, snap?.model)) return;
    setPick(null);
  }, [pick, snap?.model]);

  const model = pick ?? snap?.model ?? draftModel;

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
    if (snap?.id) return snap.id;
    const next = await getGlass().session.create();
    setSnap(next);
    void navigate({
      to: "/$threadId",
      params: { threadId: next.id },
      replace: true,
    });
    return next.id;
  };

  const send = (text: string) => {
    const value = text.trim();
    if (!value) return;

    const task = async () => {
      const id = await ensureSession();
      try {
        await getGlass().session.prompt(id, value);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!model?.provider || !authError(message)) throw err;
        await showProvider(task, model.provider);
      }
    };

    void task();
  };

  const abort = () => {
    if (!snap?.id) return;
    void getGlass().session.abort(snap.id);
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
        setPick(next);
        setSnap((cur) =>
          cur && cur.id === sessionId
            ? {
                ...cur,
                model: next,
              }
            : cur,
        );
        void getGlass()
          .session.get(sessionId)
          .then((cur) => {
            if (sid.current !== sessionId) return;
            setSnap(cur);
          })
          .catch(() => {});
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

  return {
    messages: snap?.messages ?? [],
    busy: snap?.isStreaming ?? false,
    model,
    provider,
    send,
    abort,
    setModel,
    resolve,
  };
}
