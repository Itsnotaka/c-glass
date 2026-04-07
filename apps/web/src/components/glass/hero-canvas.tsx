import { useLayoutEffect, useState } from "react";
import type { HarnessKind } from "@glass/contracts";
import { useGlassNewChatStore } from "../../lib/glass-new-chat-store";
import { useDefaultHarness, HarnessPicker } from "../../lib/harness-picker";
import { useHarnessDescriptor } from "../../lib/harness-store";
import { GlassOpenPicker } from "./open-picker";
import { GlassChatComposer } from "./chat-composer";
import { useRuntimeSession } from "./use-runtime-session";

export function GlassHeroCanvas() {
  const [draft, setDraft] = useState("");
  const tick = useGlassNewChatStore((state) => state.tick);
  const { kind: defaultKind, loading: harnessLoading } = useDefaultHarness();
  const [selectedHarness, setSelectedHarness] = useState<HarnessKind>("pi");
  const harnessDescriptor = useHarnessDescriptor(selectedHarness);
  const session = useRuntimeSession(null, selectedHarness);

  useLayoutEffect(() => {
    setDraft("");
  }, [tick]);

  useLayoutEffect(() => {
    if (!harnessLoading) {
      setSelectedHarness(defaultKind);
    }
  }, [defaultKind, harnessLoading]);

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center px-6 py-12 outline-hidden">
      <div className="flex w-full max-w-[640px] flex-col items-start gap-2 px-4 pt-2 pb-8">
        <div className="flex items-center gap-3 px-1 pb-2">
          <span className="text-detail text-muted-foreground">New conversation with</span>
          <HarnessPicker value={selectedHarness} onChange={setSelectedHarness} />
        </div>
        <GlassChatComposer
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
          harness={selectedHarness}
          harnessDescriptor={harnessDescriptor}
        />
        <GlassOpenPicker variant="hero" />
      </div>
    </div>
  );
}
