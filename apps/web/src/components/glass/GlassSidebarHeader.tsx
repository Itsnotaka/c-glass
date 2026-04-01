import { LayoutGridIcon, PlusIcon } from "lucide-react";

import { isElectron } from "../../env";
import { useGlassShellView } from "./GlassShellContext";

export function GlassSidebarHeader(props: { onNewAgent: () => void }) {
  const { setCenterMode } = useGlassShellView();

  return (
    <div className="flex shrink-0 flex-col">
      {isElectron && <div className="glass-traffic-spacer" />}
      <div className="flex flex-col gap-px px-2 pb-2">
        <button
          type="button"
          onClick={props.onNewAgent}
          className="glass-agent-row font-normal text-foreground"
        >
          <PlusIcon className="size-4 shrink-0 opacity-60" />
          <span className="text-[13px]">New Agent</span>
        </button>
        <button
          type="button"
          onClick={() => setCenterMode("marketplace")}
          className="glass-agent-row font-normal"
        >
          <LayoutGridIcon className="size-4 shrink-0 opacity-60" />
          <span className="text-[13px]">Marketplace</span>
        </button>
      </div>
    </div>
  );
}
