import { useState } from "react";

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
        <GlassQuickActions onAction={send} />
      </div>
      <GlassProviderKeyDialog
        open={session.provider !== null}
        provider={session.provider ?? ""}
        onSubmit={session.resolve}
      />
    </div>
  );
}
