import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ThreadId } from "@glass/contracts";
import type { AgentEvent, ThinkingLevel } from "@mariozechner/pi-agent-core";
import { Agent, type AgentState } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";

import {
  PI_GLASS_SESSIONS_CHANGED_EVENT,
  PI_GLASS_SETTINGS_CHANGED_EVENT,
} from "../../lib/pi-glass-constants";
import { convertToLlm } from "../../lib/pi-convert-to-llm";
import { ensurePiGlassStorage } from "../../lib/pi-glass-storage";
import {
  resolvePiDefaultModel,
  resolvePiDefaultThinkingLevel,
  writePiDefaultModel,
} from "../../lib/pi-models";
import { shouldPersistSession, titleFromMessages } from "../../lib/pi-session-title";

function boot(model: Model<any>, thinkingLevel: ThinkingLevel): Partial<AgentState> {
  return {
    systemPrompt: "You are a helpful coding assistant.",
    model,
    thinkingLevel,
    messages: [],
    tools: [],
  };
}

export function usePiSession(sessionId: string | null) {
  const navigate = useNavigate();
  const [_, setTick] = useState(0);
  const [provider, setProvider] = useState<string | null>(null);
  const agentRef = useRef<Agent | null>(null);
  const sessionRef = useRef<string | undefined>(undefined);
  const titleRef = useRef("");
  const resolverRef = useRef<((v: string | undefined) => void) | null>(null);
  const persistRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let live = true;
    let unsub: (() => void) | undefined;

    void (async () => {
      const storage = await ensurePiGlassStorage();
      if (!live) return;

      const model = await resolvePiDefaultModel();
      const thinkingLevel = await resolvePiDefaultThinkingLevel();
      let init = boot(model!, thinkingLevel);
      const sid = sessionId;
      sessionRef.current = sid ?? undefined;
      titleRef.current = "";

      if (sid) {
        const data = await storage.sessions.get(sid);
        if (data) {
          const meta = await storage.sessions.getMetadata(sid);
          titleRef.current = meta?.title ?? "";
          init = {
            ...boot(data.model, data.thinkingLevel),
            messages: data.messages,
          };
        }
      }

      const agent = new Agent({
        initialState: init,
        convertToLlm,
        getApiKey: async (provider) => {
          const cur = await storage.providerKeys.get(provider);
          if (cur) return cur;
          return new Promise<string | undefined>((resolve) => {
            resolverRef.current = resolve;
            setProvider(provider);
          });
        },
      });

      agentRef.current = agent;

      const persist = async () => {
        const id = sessionRef.current;
        const agent = agentRef.current;
        if (!id || !agent) return;
        if (!shouldPersistSession(agent.state.messages)) return;

        const msgs = agent.state.messages;
        const title = titleRef.current || titleFromMessages(msgs) || "Chat";
        if (!titleRef.current) titleRef.current = title;

        const now = new Date().toISOString();
        await storage.sessions.save(
          {
            id,
            title,
            model: agent.state.model!,
            thinkingLevel: agent.state.thinkingLevel,
            messages: msgs,
            createdAt: now,
            lastModified: now,
          },
          {
            id,
            title,
            createdAt: now,
            lastModified: now,
            messageCount: msgs.length,
            usage: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            },
            thinkingLevel: agent.state.thinkingLevel,
            preview: titleFromMessages(msgs) ?? "",
          },
        );
        window.dispatchEvent(new CustomEvent(PI_GLASS_SESSIONS_CHANGED_EVENT));
      };

      persistRef.current = persist;

      const after = () => {
        const agent = agentRef.current;
        if (!agent) return;
        const msgs = agent.state.messages;

        if (!titleRef.current && shouldPersistSession(msgs)) {
          titleRef.current = titleFromMessages(msgs);
        }

        if (!sessionRef.current && shouldPersistSession(msgs)) {
          const id = crypto.randomUUID();
          sessionRef.current = id;
          void persist().then(() => {
            navigate({
              to: "/$threadId",
              params: { threadId: ThreadId.makeUnsafe(id) },
              replace: true,
            });
          });
          return;
        }

        if (sessionRef.current && shouldPersistSession(msgs)) {
          void persist();
        }
      };

      unsub = agent.subscribe((event: AgentEvent) => {
        if (!live) return;
        setTick((n) => n + 1);
        if (event.type === "agent_end") after();
      });

      setTick((n) => n + 1);
    })();

    return () => {
      live = false;
      unsub?.();
      agentRef.current = null;
      persistRef.current = null;
    };
  }, [navigate, sessionId]);

  const agent = agentRef.current;

  const send = (text: string) => {
    const agent = agentRef.current;
    const value = text.trim();
    if (!agent || !value) return;
    void agent.prompt(value);
  };

  const setModel = async (model: Model<any>) => {
    const agent = agentRef.current;
    if (!agent || agent.signal) return;
    agent.state.model = model;
    setTick((n) => n + 1);
    await writePiDefaultModel(model);
    await persistRef.current?.();
  };

  const resolve = async (key: string | undefined) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    const name = provider;
    setProvider(null);
    if (key && name) {
      const storage = await ensurePiGlassStorage();
      await storage.providerKeys.set(name, key);
      window.dispatchEvent(new CustomEvent(PI_GLASS_SETTINGS_CHANGED_EVENT));
    }
    resolve?.(key);
  };

  return {
    messages: agent?.state.messages ?? [],
    busy: Boolean(agent?.signal),
    model: agent?.state.model ?? null,
    provider,
    send,
    setModel,
    resolve,
  };
}
