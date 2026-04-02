import type { PiModelItem } from "../../lib/pi-models";
import type { PiModelRef } from "@glass/contracts";
import { cva, type VariantProps } from "class-variance-authority";
import { ArrowUpIcon, PlusIcon, SquareIcon } from "lucide-react";
import { memo } from "react";
import { usePiModels } from "../../hooks/use-pi-models";
import { PiModelPicker } from "./pi-model-picker";

const root = cva("", {
  variants: {
    variant: {
      hero: "w-full",
      dock: "relative isolate pb-2.5 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:top-[-96px] before:bg-glass-chat before:[mask-image:linear-gradient(0deg,#000_0,rgba(0,0,0,0.86)_28%,rgba(0,0,0,0.56)_62%,rgba(0,0,0,0.22)_84%,transparent)]",
    },
  },
});

const wrap = cva("", {
  variants: {
    variant: {
      hero: "w-full",
      dock: "shrink-0 px-4 pt-2 pb-4 md:px-6",
    },
  },
});

const box =
  "overflow-hidden rounded-[12px] border border-glass-stroke bg-glass-bubble shadow-glass-card backdrop-blur-[10px] transition-none focus-within:border-glass-stroke-strong";

interface Props extends Required<VariantProps<typeof root>> {
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  onAbort: () => void;
  onModel: (model: PiModelItem) => void;
  model: PiModelRef | null;
  busy: boolean;
}

function same(left: PiModelRef | null, right: PiModelRef | null) {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.provider === right.provider &&
    left.id === right.id &&
    left.name === right.name &&
    left.reasoning === right.reasoning
  );
}

export const GlassPiComposer = memo(
  function GlassPiComposer(props: Props) {
    const empty = !props.draft.trim();
    const models = usePiModels(props.model);
    const body = props.variant === "dock" ? "mx-auto w-full max-w-3xl" : "w-full";

    return (
      <div className={root({ variant: props.variant })}>
        <div className={wrap({ variant: props.variant })}>
          <div className={body}>
            <div className={box}>
              <textarea
                value={props.draft}
                onChange={(event) => props.onDraft(event.target.value)}
                placeholder="Message..."
                rows={1}
                className="field-sizing-content font-glass block min-h-9 max-h-50 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-[13px]/5 text-foreground outline-hidden placeholder:text-muted-foreground"
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  event.preventDefault();
                  if (props.busy) {
                    props.onAbort();
                    return;
                  }
                  if (!empty) props.onSend();
                }}
              />
              <div className="flex items-center justify-between gap-1 px-1.5 pt-0 pb-1.5">
                <div className="flex min-w-0 items-center gap-1">
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-glass-hover hover:text-foreground"
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
                    triggerClassName="h-7 max-w-52 min-w-0 rounded-full border-transparent px-2 text-muted-foreground/70 hover:bg-glass-hover hover:text-foreground"
                    onSelect={props.onModel}
                  />
                </div>
                <button
                  type="button"
                  disabled={!props.busy && empty}
                  onClick={() => {
                    if (props.busy) {
                      props.onAbort();
                      return;
                    }
                    if (!empty) props.onSend();
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
  },
  (left, right) =>
    left.variant === right.variant &&
    left.draft === right.draft &&
    left.busy === right.busy &&
    same(left.model, right.model),
);
