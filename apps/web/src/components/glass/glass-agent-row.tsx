import type { GlassSidebarAgent } from "../../lib/glassViewModel";

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

export function GlassAgentRow(props: { agent: GlassSidebarAgent; onSelect: () => void }) {
  return (
    <button
      type="button"
      data-thread-item
      data-selected={props.agent.selected}
      onClick={props.onSelect}
      className="glass-agent-row text-left"
    >
      <StatusDot state={props.agent.state} />
      <span className="min-w-0 flex-1 truncate text-[13px]">{props.agent.title}</span>
      <span className="shrink-0 text-[11px] text-muted-foreground/50">{props.agent.ago}</span>
    </button>
  );
}
