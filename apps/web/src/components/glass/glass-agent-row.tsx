import { memo } from "react";
import { buildPiSessionSidebarAgent, type GlassSidebarAgent } from "../../lib/glass-view-model";
import { usePiSummary } from "../../lib/pi-session-store";

function StatusDot(props: { state: GlassSidebarAgent["state"] }) {
  if (props.state === "running") {
    return (
      <span className="relative flex size-3 shrink-0 items-center justify-center">
        <span className="absolute size-2 animate-ping rounded-full bg-emerald-500/40" />
        <span className="size-1.5 rounded-full bg-emerald-500" />
      </span>
    );
  }
  if (props.state === "error") {
    return <span className="size-1.5 shrink-0 rounded-full bg-destructive/80" aria-hidden />;
  }
  return <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />;
}

export const GlassAgentRow = memo(
  function GlassAgentRow(props: {
    id: string;
    selectedId: string | null;
    onSelectAgent: (id: string) => void;
  }) {
    const session = usePiSummary(props.id);
    if (!session) return null;

    const agent = buildPiSessionSidebarAgent(session, props.selectedId);

    return (
      <button
        type="button"
        data-selected={agent.selected}
        data-thread-item
        onClick={() => props.onSelectAgent(props.id)}
        className="font-glass flex min-h-7.5 w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-left text-[13px]/[18px] text-muted-foreground transition-colors hover:bg-glass-hover hover:text-foreground data-[selected=true]:border-glass-border/90 data-[selected=true]:bg-glass-active data-[selected=true]:text-foreground"
      >
        <StatusDot state={agent.state} />
        <span className="min-w-0 flex-1 truncate">{agent.title}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground/50">{agent.ago}</span>
      </button>
    );
  },
  (left, right) =>
    left.id === right.id &&
    left.selectedId === right.selectedId &&
    left.onSelectAgent === right.onSelectAgent,
);
