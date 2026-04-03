import { IconPlusLarge, IconSidebarHiddenLeftWide } from "central-icons";

import { isElectron } from "../../env";
import { cn } from "../../lib/utils";
import { GlassWorkspacePicker } from "./glass-workspace-picker";

export function GlassSidebarHeader(props: { onNewAgent: () => void; onToggleLeft?: () => void }) {
  return (
    <div className="flex shrink-0 flex-col">
      {props.onToggleLeft ? (
        <div
          className={cn(
            "no-drag flex shrink-0 items-center px-2 py-1.5",
            isElectron && "pl-[var(--glass-electron-traffic-inset)]",
          )}
        >
          <button
            type="button"
            onClick={props.onToggleLeft}
            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-black/[0.04] text-muted-foreground hover:bg-glass-hover hover:text-foreground dark:bg-white/[0.06]"
            aria-label="Collapse threads"
          >
            <IconSidebarHiddenLeftWide className="size-4" />
          </button>
        </div>
      ) : null}
      {isElectron ? (
        <div className="no-drag px-2 py-1.5">
          <GlassWorkspacePicker className="w-full justify-start" />
        </div>
      ) : null}
      <div className="flex flex-col gap-px px-2 pb-2 pt-1.5">
        <button
          type="button"
          onClick={props.onNewAgent}
          className="font-glass flex min-h-7.5 w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-left text-[13px]/[18px] text-muted-foreground transition-colors hover:bg-glass-hover hover:text-foreground data-[selected=true]:border-glass-border/90 data-[selected=true]:bg-glass-active data-[selected=true]:text-foreground"
        >
          <IconPlusLarge className="size-4 shrink-0 opacity-60" />
          <span>New Agent</span>
        </button>
      </div>
    </div>
  );
}
