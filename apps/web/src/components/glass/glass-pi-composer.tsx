import { ArrowUpIcon, PlusIcon, SquareIcon } from "lucide-react";

export function GlassPiComposer(props: {
  draft: string;
  onDraft: (v: string) => void;
  onSend: () => void;
  busy: boolean;
}) {
  const empty = !props.draft.trim();

  return (
    <div className="shrink-0 px-4 pb-4 pt-2 md:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="glass-inline-composer">
          <textarea
            value={props.draft}
            onChange={(e) => props.onDraft(e.target.value)}
            placeholder="Message..."
            rows={1}
            className="field-sizing-content"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!props.busy && !empty) props.onSend();
              }
            }}
          />
          <div className="glass-inline-composer-toolbar">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-[var(--glass-sidebar-hover)] hover:text-foreground"
                aria-label="Add context"
              >
                <PlusIcon className="size-4" />
              </button>
              <span className="text-[11px] text-muted-foreground/50">Pi Agent</span>
            </div>
            <button
              type="button"
              disabled={!props.busy && empty}
              onClick={() => {
                if (!props.busy && !empty) props.onSend();
              }}
              className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
              aria-label={props.busy ? "Stop" : "Send"}
            >
              {props.busy ? <SquareIcon className="size-3" /> : <ArrowUpIcon className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
