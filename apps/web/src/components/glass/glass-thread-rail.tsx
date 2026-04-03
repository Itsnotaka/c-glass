import { GlassAgentList } from "./glass-agent-list";
import { GlassSidebarFooter } from "./glass-sidebar-footer";
import { GlassSidebarHeader } from "./glass-sidebar-header";
import type { GlassSidebarSection } from "../../lib/glass-view-model";

export function GlassThreadRail(props: {
  sections: GlassSidebarSection[];
  selectedId: string | null;
  onSelectAgent: (id: string) => void;
  onNewAgent: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GlassSidebarHeader onNewAgent={props.onNewAgent} />
      <p className="px-3 pt-1.5 pb-0.5 text-[11px] font-medium tracking-wide text-muted-foreground/60 uppercase">
        Threads
      </p>
      <GlassAgentList
        sections={props.sections}
        selectedId={props.selectedId}
        onSelectAgent={props.onSelectAgent}
      />
      <GlassSidebarFooter />
    </div>
  );
}
