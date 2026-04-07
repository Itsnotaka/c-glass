"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useHotkey } from "@tanstack/react-hotkeys";

import { usePiStore, usePiSummary } from "../../lib/pi-session-store";
import { GlassOpenPicker } from "./open-picker";
import { GlassPiComposer, type GlassPiComposerHandle } from "./pi-composer";
import { GlassPiMessages } from "./pi-messages";
import { GlassShell } from "./shell";
import { usePiSession } from "./use-pi-session";

export function GlassChatSession(props: { sessionId: string }) {
  const sum = usePiSummary(props.sessionId);
  const snap = usePiStore((state) => state.snaps[props.sessionId]);
  const count = sum?.messageCount ?? snap?.messages.length ?? 0;

  if (count === 0) {
    return <HeroSession sessionId={props.sessionId} />;
  }

  return <DockSession sessionId={props.sessionId} />;
}

function HeroSession(props: { sessionId: string }) {
  const [draft, setDraft] = useState("");
  const session = usePiSession(props.sessionId);
  const composerRef = useRef<GlassPiComposerHandle>(null);
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
          <GlassPiComposer
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
          />
          <GlassOpenPicker variant="hero" />
        </div>
      </div>
    </GlassShell>
  );
}

function DockSession(props: { sessionId: string }) {
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const session = usePiSession(props.sessionId);

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
      <GlassPiMessages messages={session.messages} live={session.live} expanded={expanded} />
      <GlassPiComposer
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
      />
    </GlassShell>
  );
}
