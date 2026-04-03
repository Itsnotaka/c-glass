import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useHotkey } from "@tanstack/react-hotkeys";

import { resolveAndPersistPreferredEditor } from "../../editor-preferences";
import { getGlass } from "../../host";
import { usePiSummary } from "../../lib/pi-session-store";
import { GlassPiComposer } from "./glass-pi-composer";
import { GlassPiMessages } from "./glass-pi-messages";
import { GlassQuickActions } from "./glass-quick-actions";
import { usePiSession } from "./use-pi-session";

export function GlassChatSession(props: { sessionId: string }) {
  const sum = usePiSummary(props.sessionId);

  if (sum?.messageCount === 0) {
    return <HeroSession sessionId={props.sessionId} />;
  }

  return <DockSession sessionId={props.sessionId} />;
}

function HeroSession(props: { sessionId: string }) {
  const [draft, setDraft] = useState("");
  const session = usePiSession(props.sessionId);

  useLayoutEffect(() => {
    setDraft("");
  }, [props.sessionId]);

  const open = useCallback(() => {
    void getGlass()
      .shell.getState()
      .then((state) => {
        const editor = resolveAndPersistPreferredEditor(state.availableEditors);
        if (!editor) return;
        return getGlass().shell.openInEditor(state.cwd, editor);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-glass-editor">
      <div className="flex h-full flex-1 flex-col items-center justify-center px-6 py-12 outline-hidden">
        <div className="flex w-full max-w-[640px] flex-col items-start gap-2 px-4 pt-2 pb-8">
          <GlassPiComposer
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
          <GlassQuickActions onOpenInEditor={open} />
        </div>
      </div>
    </div>
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-glass-editor">
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
    </div>
  );
}
