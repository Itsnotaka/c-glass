"use client";

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ThreadId } from "@glass/contracts";
import type { AgentEvent } from "@mariozechner/pi-agent-core";
import { Agent, type AgentState } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";

import { PI_GLASS_SESSIONS_CHANGED_EVENT } from "../../lib/pi-glass-constants";
import { convertToLlm } from "../../lib/pi-convert-to-llm";
import { ensurePiGlassStorage } from "../../lib/pi-glass-storage";
import { shouldPersistSession, titleFromMessages } from "../../lib/pi-session-title";

import { GlassPiComposer } from "./glass-pi-composer";
import { GlassPiMessages } from "./glass-pi-messages";
import { GlassProviderKeyDialog } from "./glass-provider-key-dialog";

const defaultState = (): Partial<AgentState> => ({
  systemPrompt: "You are a helpful coding assistant.",
  model: getModel("anthropic", "claude-sonnet-4-5-20250929"),
  thinkingLevel: "off",
  messages: [],
  tools: [],
});

export function GlassChatSession({ sessionId }: { sessionId: string | null }) {
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  const [draft, setDraft] = useState("");
  const [keyProvider, setKeyProvider] = useState<string | null>(null);
  const agentRef = useRef<Agent | null>(null);
  const sessionRef = useRef<string | undefined>(undefined);
  const titleRef = useRef("");
  const keyResolverRef = useRef<((v: string | undefined) => void) | null>(null);

  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | undefined;

    void (async () => {
      const storage = await ensurePiGlassStorage();
      if (!alive) return;

      let initial: Partial<AgentState> = defaultState();
      const sid = sessionId;
      sessionRef.current = sid ?? undefined;
      titleRef.current = "";

      if (sid) {
        const data = await storage.sessions.get(sid);
        if (data) {
          const meta = await storage.sessions.getMetadata(sid);
          titleRef.current = meta?.title ?? "";
          initial = {
            ...defaultState(),
            model: data.model,
            thinkingLevel: data.thinkingLevel,
            messages: data.messages,
          };
        }
      }

      const agent = new Agent({
        initialState: initial,
        convertToLlm,
        getApiKey: async (provider) => {
          const cur = await storage.providerKeys.get(provider);
          if (cur) return cur;
          return new Promise<string | undefined>((resolve) => {
            keyResolverRef.current = resolve;
            setKeyProvider(provider);
          });
        },
      });

      agentRef.current = agent;

      const persist = async () => {
        const id = sessionRef.current;
        const a = agentRef.current;
        if (!id || !a) return;
        if (!shouldPersistSession(a.state.messages)) return;

        const msgs = a.state.messages;
        const t = titleRef.current || titleFromMessages(msgs) || "Chat";
        if (!titleRef.current) titleRef.current = t;

        const now = new Date().toISOString();
        const sessionData = {
          id,
          title: t,
          model: a.state.model!,
          thinkingLevel: a.state.thinkingLevel,
          messages: msgs,
          createdAt: now,
          lastModified: now,
        };

        const metadata = {
          id,
          title: t,
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
          modelId: a.state.model?.id ?? null,
          thinkingLevel: a.state.thinkingLevel,
          preview: titleFromMessages(msgs),
        };

        await storage.sessions.save(sessionData, metadata);
        window.dispatchEvent(new CustomEvent(PI_GLASS_SESSIONS_CHANGED_EVENT));
      };

      const afterTurn = () => {
        const a = agentRef.current;
        if (!a) return;
        const msgs = a.state.messages;

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

      unsub = agent.subscribe((e: AgentEvent) => {
        if (!alive) return;
        setTick((n) => n + 1);
        if (e.type === "agent_end") afterTurn();
      });

      setTick((n) => n + 1);
    })();

    return () => {
      alive = false;
      unsub?.();
      agentRef.current = null;
    };
  }, [navigate, sessionId]);

  const agent = agentRef.current;
  const messages = agent?.state.messages ?? [];
  const busy = Boolean(agent?.signal);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-glass-canvas">
      <GlassPiMessages messages={messages} />
      <GlassPiComposer
        draft={draft}
        onDraft={setDraft}
        busy={busy}
        onSend={() => {
          const a = agentRef.current;
          const t = draft.trim();
          if (!a || !t) return;
          void a.prompt(t);
          setDraft("");
        }}
      />
      <GlassProviderKeyDialog
        open={keyProvider !== null}
        provider={keyProvider ?? ""}
        onSubmit={async (key) => {
          const r = keyResolverRef.current;
          keyResolverRef.current = null;
          const p = keyProvider;
          setKeyProvider(null);
          if (key && p) {
            const s = await ensurePiGlassStorage();
            await s.providerKeys.set(p, key);
          }
          r?.(key);
        }}
      />
    </div>
  );
}
