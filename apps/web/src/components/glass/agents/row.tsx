import { IconFormCircle } from "central-icons";
import { memo } from "react";

import type { GlassSidebarChat } from "~/lib/glass-view-model";
import { GlassRowButton } from "~/components/glass/shared/row-button";

function StatusDot(props: { item: GlassSidebarChat }) {
  if (props.item.kind === "draft") {
    return <IconFormCircle className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />;
  }
  if (props.item.state === "running") {
    return (
      <span className="relative flex size-3 shrink-0 items-center justify-center">
        <span className="absolute size-2 animate-ping rounded-full bg-emerald-500/40" />
        <span className="size-2 rounded-full bg-emerald-500" />
      </span>
    );
  }
  if (props.item.state === "error") {
    return <span className="size-2 shrink-0 rounded-full bg-destructive/80" aria-hidden />;
  }
  return <span className="size-2 shrink-0 rounded-full bg-muted-foreground/45" aria-hidden />;
}

export const GlassAgentRow = memo(
  function GlassAgentRow(props: {
    item: GlassSidebarChat;
    selected: boolean;
    onSelectAgent: (id: string) => void;
  }) {
    return (
      <GlassRowButton
        variant="agent"
        data-selected={props.selected}
        data-chat-item=""
        onClick={() => props.onSelectAgent(props.item.id)}
      >
        <StatusDot item={props.item} />
        <span className="min-w-0 flex-1 truncate">{props.item.title}</span>
        <span className="shrink-0 text-detail text-muted-foreground/50">{props.item.ago}</span>
      </GlassRowButton>
    );
  },
  (left, right) =>
    left.item === right.item &&
    left.selected === right.selected &&
    left.onSelectAgent === right.onSelectAgent,
);
