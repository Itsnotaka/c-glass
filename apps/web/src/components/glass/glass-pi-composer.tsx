import { cva, type VariantProps } from "class-variance-authority";
import { ArrowUpIcon, PlusIcon, SquareIcon } from "lucide-react";
import type { Model } from "@mariozechner/pi-ai";

import { usePiModels } from "../../hooks/use-pi-models";
import { PiModelPicker } from "./pi-model-picker";

const root = cva("", {
  variants: {
    variant: {
      hero: "w-full",
      dock: "glass-dock-composer",
    },
  },
});

const wrap = cva("", {
  variants: {
    variant: {
      hero: "w-full",
      dock: "shrink-0 px-4 pb-4 pt-2 md:px-6",
    },
  },
});

const constraint = cva("", {
  variants: {
    variant: {
      hero: "",
      dock: "mx-auto w-full max-w-3xl",
    },
  },
});

type Props = {
  draft: string;
  onDraft: (v: string) => void;
  onSend: () => void;
  onModel: (model: Model<any>) => void;
  model: Model<any> | null;
  busy: boolean;
} & Required<VariantProps<typeof root>>;

export function GlassPiComposer(props: Props) {
  const empty = !props.draft.trim();
  const models = usePiModels(props.model);

  return (
    <div className={root({ variant: props.variant })}>
      <div className={wrap({ variant: props.variant })}>
        <div className={constraint({ variant: props.variant })}>
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
              <div className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-[var(--glass-sidebar-hover)] hover:text-foreground"
                  aria-label="Add context"
                >
                  <PlusIcon className="size-4" />
                </button>
                <PiModelPicker
                  items={models.items}
                  model={props.model}
                  disabled={props.busy || models.loading}
                  side={props.variant === "dock" ? "top" : "bottom"}
                  triggerVariant="ghost"
                  triggerClassName="h-7 max-w-52 min-w-0 border-transparent px-2 text-muted-foreground/70 hover:bg-[var(--glass-sidebar-hover)] hover:text-foreground"
                  onSelect={props.onModel}
                />
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
                {props.busy ? (
                  <SquareIcon className="size-3" />
                ) : (
                  <ArrowUpIcon className="size-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
