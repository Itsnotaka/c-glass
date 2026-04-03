import { IconArrowOutOfBox } from "central-icons";

export function GlassQuickActions(props: { onOpenInEditor: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="font-glass inline-flex min-h-7 items-center gap-1.5 rounded-full border border-glass-stroke bg-glass-bubble px-2.5 text-xs/[17px] text-muted-foreground shadow-glass-card backdrop-blur-md transition-colors hover:border-glass-stroke-strong hover:bg-glass-hover hover:text-foreground"
        onClick={props.onOpenInEditor}
      >
        <IconArrowOutOfBox className="size-3.5 shrink-0 opacity-60" />
        <span>Open in editor</span>
      </button>
    </div>
  );
}
