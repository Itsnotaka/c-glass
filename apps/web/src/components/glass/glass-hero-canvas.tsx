import { useCallback, useLayoutEffect, useState } from "react";
import { resolveAndPersistPreferredEditor } from "../../editor-preferences";
import { getGlass } from "../../host";
import { useGlassNewChatStore } from "../../lib/glass-new-chat-store";
import { GlassPiComposer } from "./glass-pi-composer";
import { GlassQuickActions } from "./glass-quick-actions";
import { usePiSession } from "./use-pi-session";

export function GlassHeroCanvas() {
  const [draft, setDraft] = useState("");
  const tick = useGlassNewChatStore((state) => state.tick);
  const session = usePiSession(null);

  useLayoutEffect(() => {
    setDraft("");
  }, [tick]);

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
        <GlassQuickActions onOpenInEditor={open} />
      </div>
    </div>
  );
}
