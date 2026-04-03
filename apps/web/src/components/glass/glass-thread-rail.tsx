import { GlassAgentList } from "./glass-agent-list";
import { GlassSidebarFooter } from "./glass-sidebar-footer";
import { GlassSidebarHeader } from "./glass-sidebar-header";
import { useIsMobile } from "../../hooks/use-media-query";
import type { GlassSidebarSection } from "../../lib/glass-view-model";

export function GlassThreadRail(props: {
  sections: GlassSidebarSection[];
  selectedId: string | null;
  onSelectAgent: (id: string) => void;
  onNewAgent: () => void;
  onToggleLeft?: () => void;
}) {
  const mobile = useIsMobile();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <GlassSidebarHeader
        onNewAgent={props.onNewAgent}
        {...(!mobile && props.onToggleLeft ? { onToggleLeft: props.onToggleLeft } : {})}
      />
      <GlassAgentList
        sections={props.sections}
        selectedId={props.selectedId}
        onSelectAgent={props.onSelectAgent}
      />
      <GlassSidebarFooter />
    </div>
  );
}
