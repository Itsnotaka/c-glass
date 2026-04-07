"use client";

import { AnimatePresence } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useHotkey } from "@tanstack/react-hotkeys";

import { useHarnessDescriptor } from "../../lib/harness-store";
import { useThreadSessionStore, useThreadSummary } from "../../lib/thread-session-store";
import { GlassAskTool } from "./ask-tool";
import { GlassOpenPicker } from "./open-picker";
import { GlassChatComposer, type GlassChatComposerHandle } from "./chat-composer";
import { GlassChatMessages } from "./chat-messages";
import { GlassShell } from "./shell";
import { useRuntimeSession } from "./use-runtime-session";

export function GlassChatSession(props: { sessionId: string }) {
  const sum = useThreadSummary(props.sessionId);
  const snap = useThreadSessionStore((state) => state.snaps[props.sessionId]);
  const count = sum?.messageCount ?? snap?.messages.length ?? 0;
  const live = Boolean(snap?.live) || Boolean(snap?.isStreaming);

  if (count === 0 && !live) {
    return <HeroSession sessionId={props.sessionId} />;
  }

  return <DockSession sessionId={props.sessionId} />;
}

function HeroSession(props: { sessionId: string }) {
  const [draft, setDraft] = useState("");
  const sum = useThreadSummary(props.sessionId);
  const snap = useThreadSessionStore((state) => state.snaps[props.sessionId]);
  const kind = sum?.harness ?? snap?.harness ?? "pi";
  const harnessDescriptor = useHarnessDescriptor(kind);
  const session = useRuntimeSession(props.sessionId, kind);
  const composerRef = useRef<GlassChatComposerHandle>(null);
  const prevSession = useRef(props.sessionId);

  useLayoutEffect(() => {
    setDraft("");
  }, [props.sessionId]);

  useEffect(() => {
    if (prevSession.current !== props.sessionId) {
      prevSession.current = props.sessionId;
      composerRef.current?.focus();
    }
  }, [props.sessionId]);

  return (
    <GlassShell>
      <div className="flex h-full flex-1 flex-col items-center justify-center px-6 py-12 outline-hidden">
        <div className="flex w-full max-w-[640px] flex-col items-start gap-2 px-4 pt-2 pb-8">
          <div className="relative w-full">
            <GlassChatComposer
              ref={composerRef}
              sessionId={props.sessionId}
              draft={draft}
              onDraft={setDraft}
              busy={session.busy}
              model={session.model}
              modelLoading={session.modelLoading}
              variant="hero"
              onAbort={session.abort}
              onModel={session.setModel}
              onThinkingLevel={session.setThinkingLevel}
              onSend={session.send}
              harness={kind}
              harnessDescriptor={harnessDescriptor}
            />
            <AnimatePresence>
              {session.ask ? (
                <GlassAskTool state={session.ask} onReply={session.answerAsk} />
              ) : null}
            </AnimatePresence>
          </div>
          <GlassOpenPicker variant="hero" />
        </div>
      </div>
    </GlassShell>
  );
}

function DockSession(props: { sessionId: string }) {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const sum = useThreadSummary(props.sessionId);
  const snap = useThreadSessionStore((state) => state.snaps[props.sessionId]);
  const kind = sum?.harness ?? snap?.harness ?? "pi";
  const harnessDescriptor = useHarnessDescriptor(kind);
  const session = useRuntimeSession(props.sessionId, kind);

  useEffect(() => {
    setDraft("");
    setExpanded(false);
  }, [props.sessionId]);

  useHotkey(
    "Mod+O",
    (event) => {
      event.preventDefault();
      setExpanded((cur) => !cur);
    },
    { preventDefault: true },
  );

  return (
    <GlassShell>
      <GlassChatMessages messages={session.messages} live={session.live} expanded={expanded} />
      <div className="relative">
        <GlassChatComposer
          sessionId={props.sessionId}
          draft={draft}
          onDraft={setDraft}
          busy={session.busy}
          model={session.model}
          modelLoading={session.modelLoading}
          variant="dock"
          onAbort={session.abort}
          onModel={session.setModel}
          onThinkingLevel={session.setThinkingLevel}
          onSend={session.send}
          harness={kind}
          harnessDescriptor={harnessDescriptor}
        />
        <AnimatePresence>
          {session.ask ? <GlassAskTool state={session.ask} onReply={session.answerAsk} /> : null}
        </AnimatePresence>
      </div>
    </GlassShell>
  );
}
