import { IconPlusLarge } from "central-icons";

import { isElectron } from "../../env";

const row =
  "font-glass flex min-h-7.5 w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-left text-[13px]/[18px] text-muted-foreground transition-colors hover:bg-glass-hover hover:text-foreground data-[selected=true]:border-glass-border/90 data-[selected=true]:bg-glass-active data-[selected=true]:text-foreground";

export function GlassSidebarHeader(props: { onNewAgent: () => void }) {
  return (
    <div className="flex shrink-0 flex-col">
      {isElectron ? <div className="h-[var(--glass-sidebar-gap)] shrink-0 drag-region" /> : null}
      <div className="flex flex-col gap-px px-2 pb-2">
        <button type="button" onClick={props.onNewAgent} className={row}>
          <IconPlusLarge className="size-4 shrink-0 opacity-60" />
          <span>New Agent</span>
        </button>
      </div>
    </div>
  );
}
