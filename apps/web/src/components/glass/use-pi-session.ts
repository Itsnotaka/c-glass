import type { PiModelRef, PiSessionSnapshot } from "@glass/contracts";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { getGlass } from "../../host";
import {
  resolvePiDefaultModel,
  writePiApiKey,
  writePiDefaultModel,
  type PiModelItem,
} from "../../lib/pi-models";

function authError(message: string) {
  const text = message.toLowerCase();
  return text.includes("api key") || text.includes("auth") || text.includes("credential");
}

export function usePiSession(sessionId: string | null) {
  const navigate = useNavigate();
  const [snap, setSnap] = useState<PiSessionSnapshot | null>(null);
  const [draftModel, setDraftModel] = useState<PiModelRef | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const pending = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let live = true;

    if (!sessionId) {
      setSnap(null);
      void resolvePiDefaultModel().then((model) => {
        if (!live) return;
        setDraftModel(model);
      });
    }

    if (!sessionId) {
      return () => {
        live = false;
      };
    }

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

  const model = snap?.model ?? draftModel;

  const showProvider = async (task: () => Promise<void>) => {
    if (!model?.provider) throw new Error("Missing model provider");
    pending.current = task;
    setProvider(model.provider);
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
        await showProvider(task);
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
      if (!snap?.id) {
        setDraftModel(next);
        await writePiDefaultModel(next);
        return;
      }
      try {
        await getGlass().session.setModel(snap.id, next.provider, next.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!authError(message)) throw err;
        pending.current = task;
        setProvider(next.provider);
      }
    };

    void task();
  };

  const resolve = async (key: string | undefined) => {
    const name = provider;
    setProvider(null);
    if (key && name) {
      await writePiApiKey(name, key);
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
