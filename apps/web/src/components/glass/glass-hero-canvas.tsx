import { useCallback, useState } from "react";
import { resolveAndPersistPreferredEditor } from "../../editorPreferences";
import { getGlass } from "../../host";
import { GlassPiComposer } from "./glass-pi-composer";
import { GlassProviderKeyDialog } from "./glass-provider-key-dialog";
import { GlassQuickActions } from "./glass-quick-actions";
import { usePiSession } from "./use-pi-session";

export function GlassHeroCanvas() {
  const [draft, setDraft] = useState("");
  const session = usePiSession(null);

  const send = (text: string) => {
    session.send(text);
    setDraft("");
  };

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
    <div className="glass-empty-state">
      <div className="glass-empty-state-column">
        <GlassPiComposer
          draft={draft}
          onDraft={setDraft}
          busy={session.busy}
          model={session.model}
          variant="hero"
          onAbort={session.abort}
          onModel={session.setModel}
          onSend={() => send(draft)}
        />
        <GlassQuickActions onPrompt={send} onOpenInEditor={open} />
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
