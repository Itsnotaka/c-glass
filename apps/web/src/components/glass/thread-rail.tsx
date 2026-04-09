import type { GlassSidebarSection } from "../../lib/glass-view-model";
import { GlassAgentList } from "./agent-list";

export function GlassThreadRail(props: {
  sections: GlassSidebarSection[];
  selectedId: string | null;
  onSelectAgent: (id: string) => void;
  onNewAgent?: (cwd: string) => void;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <>
      <GlassAgentList
        sections={props.sections}
        selectedId={props.selectedId}
        onSelectAgent={props.onSelectAgent}
        {...(props.onNewAgent ? { onNewAgent: props.onNewAgent } : {})}
        {...(props.loading !== undefined ? { loading: props.loading } : {})}
        {...(props.error !== undefined ? { error: props.error } : {})}
      />
    </>
  );
}
