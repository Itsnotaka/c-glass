import { useCallback, useState } from "react";
import { resolveAndPersistPreferredEditor } from "../../editor-preferences";
import { getGlass } from "../../host";
import { GlassPiComposer } from "./glass-pi-composer";
import { GlassProviderKeyDialog } from "./glass-provider-key-dialog";
import { GlassQuickActions } from "./glass-quick-actions";
import { usePiSession } from "./use-pi-session";

export function GlassHeroCanvas() {
  const [draft, setDraft] = useState("");
  const session = usePiSession(null);

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
          sessionId={null}
          draft={draft}
          onDraft={setDraft}
          busy={session.busy}
          model={session.model}
          variant="hero"
          onAbort={session.abort}
          onModel={session.setModel}
          onThinkingLevel={session.setThinkingLevel}
          onSend={session.send}
        />
        <GlassQuickActions onOpenInEditor={open} />
      </div>
      <GlassProviderKeyDialog
        open={session.provider !== null}
        provider={session.provider?.name ?? ""}
        mode={session.provider?.mode ?? "api_key"}
        oauthSupported={session.provider?.oauthSupported}
        onSubmit={session.resolve}
      />
    </div>
  );
}
