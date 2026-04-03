import { GlassAgentList } from "./glass-agent-list";
import { GlassSidebarHeader } from "./glass-sidebar-header";
import type { GlassSidebarSection } from "../../lib/glass-view-model";

export function GlassThreadRail(props: {
  sections: GlassSidebarSection[];
  selectedId: string | null;
  onSelectAgent: (id: string) => void;
  onNewAgent: () => void;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <>
      <GlassSidebarHeader onNewAgent={props.onNewAgent} />
      <GlassAgentList
        sections={props.sections}
        selectedId={props.selectedId}
        onSelectAgent={props.onSelectAgent}
        {...(props.loading !== undefined ? { loading: props.loading } : {})}
        {...(props.error !== undefined ? { error: props.error } : {})}
      />
    </>
  );
}
