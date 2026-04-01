import { useCallback, useState } from "react";

import { resolveAndPersistPreferredEditor } from "../../editorPreferences";
import { readNativeApi } from "../../nativeApi";
import { GlassPiComposer } from "./glass-pi-composer";
import { GlassQuickActions } from "./glass-quick-actions";
import { GlassProviderKeyDialog } from "./glass-provider-key-dialog";
import { usePiSession } from "./use-pi-session";

export function GlassHeroCanvas() {
  const [draft, setDraft] = useState("");
  const session = usePiSession(null);

  const send = (text: string) => {
    session.send(text);
    setDraft("");
  };

  const open = useCallback(() => {
    const api = readNativeApi();
    if (!api) return;
    void api.server
      .getConfig()
      .then((cfg) => {
        const editor = resolveAndPersistPreferredEditor(cfg.availableEditors);
        if (editor) void api.shell.openInEditor(cfg.cwd, editor);
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
          onModel={session.setModel}
          onSend={() => send(draft)}
        />
        <GlassQuickActions onPrompt={send} onOpenInEditor={open} />
      </div>
      <GlassProviderKeyDialog
        open={session.provider !== null}
        provider={session.provider ?? ""}
        onSubmit={session.resolve}
      />
    </div>
  );
}
