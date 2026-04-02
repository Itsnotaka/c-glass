import { useState } from "react";

import { GlassPiComposer } from "./glass-pi-composer";
import { GlassPiMessages } from "./glass-pi-messages";
import { GlassProviderKeyDialog } from "./glass-provider-key-dialog";
import { usePiSession } from "./use-pi-session";

export function GlassChatSession(props: { sessionId: string }) {
  const [draft, setDraft] = useState("");
  const session = usePiSession(props.sessionId);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-glass-canvas">
      <GlassPiMessages messages={session.messages} />
      <GlassPiComposer
        draft={draft}
        onDraft={setDraft}
        busy={session.busy}
        model={session.model}
        variant="dock"
        onAbort={session.abort}
        onModel={session.setModel}
        onSend={() => {
          session.send(draft);
          setDraft("");
        }}
      />
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
