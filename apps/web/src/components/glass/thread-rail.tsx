import type { GlassSidebarSection } from "../../lib/glass-view-model";
import { GlassAgentList } from "./agent-list";
import { GlassSidebarHeader } from "./sidebar-header";

export function GlassThreadRail(props: {
  sections: GlassSidebarSection[];
  selectedId: string | null;
  onSelectAgent: (id: string) => void;
  onNewChat: () => void;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <>
      <GlassSidebarHeader onNewChat={props.onNewChat} />
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
