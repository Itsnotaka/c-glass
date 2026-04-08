import { useCallback } from "react";

import { useGlassChatDraftStore } from "../../lib/glass-chat-draft-store";
import { useDefaultHarness } from "../../lib/harness-picker";
import { useHarnessDescriptor } from "../../lib/harness-store";
import { GlassChatComposer } from "./chat-composer";
import { GlassOpenPicker } from "./open-picker";
import { useRuntimeSession } from "./use-runtime-session";

function title(text: string, files: { name: string }[]) {
  const line = text.trim().split("\n")[0]?.trim();
  if (line) return line;
  return files[0]?.name ?? "New chat";
}

export function GlassHeroCanvas() {
  const { kind: defaultKind } = useDefaultHarness();
  const cur = useGlassChatDraftStore((state) => state.cur);
  const items = useGlassChatDraftStore((state) => state.items);
  const root = useGlassChatDraftStore((state) => state.root);
  const save = useGlassChatDraftStore((state) => state.save);
  const saveRoot = useGlassChatDraftStore((state) => state.saveRoot);
  const draft = cur ? (items[cur] ?? null) : null;
  const kind = draft?.harness ?? defaultKind;
  const harnessDescriptor = useHarnessDescriptor(kind);
  const session = useRuntimeSession(null, kind);
  const text = draft?.text ?? root.text;
  const files = draft?.files ?? root.files;

  const write = useCallback(
    (next: { text: string; files: typeof files }) => {
      if (draft) {
        save(draft.id, next.text, next.files);
        return;
      }
      saveRoot(next.text, next.files);
    },
    [draft, save, saveRoot],
  );

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center px-6 py-12 outline-hidden">
      <div className="flex w-full max-w-[640px] flex-col items-start gap-2 px-4 pt-2 pb-8">
        <GlassChatComposer
          key={draft?.id ?? "root"}
          sessionId={null}
          draft={text}
          files={files}
          onDraft={(value) => write({ text: value, files })}
          onFiles={(next) => write({ text, files: next })}
          busy={session.busy}
          model={session.model}
          modelLoading={session.modelLoading}
          variant="hero"
          onAbort={session.abort}
          onModel={session.setModel}
          onThinkingLevel={session.setThinkingLevel}
          onSend={(input) =>
            session.send(
              input,
              draft ? { id: draft.id, title: title(draft.text, draft.files) } : null,
            )
          }
          harness={kind}
          harnessDescriptor={harnessDescriptor}
        />
        <GlassOpenPicker variant="hero" />
      </div>
    </div>
  );
}
