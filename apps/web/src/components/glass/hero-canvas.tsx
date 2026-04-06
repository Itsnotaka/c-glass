import { useLayoutEffect, useState } from "react";
import { useGlassNewChatStore } from "../../lib/glass-new-chat-store";
import { GlassOpenPicker } from "./glass-open-picker";
import { GlassPiComposer } from "./glass-pi-composer";
import { usePiSession } from "./use-pi-session";

export function GlassHeroCanvas() {
  const [draft, setDraft] = useState("");
  const tick = useGlassNewChatStore((state) => state.tick);
  const session = usePiSession(null);

  useLayoutEffect(() => {
    setDraft("");
  }, [tick]);

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center px-6 py-12 outline-hidden">
      <div className="flex w-full max-w-[640px] flex-col items-start gap-2 px-4 pt-2 pb-8">
        <GlassPiComposer
          key={tick}
          sessionId={null}
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
  );
}
