import { IconChevronBottom } from "central-icons";
import { useState } from "react";
import { Skeleton } from "~/components/ui/skeleton";

import type { GlassSidebarSection } from "../../lib/glass-view-model";
import { cn } from "../../lib/utils";
import { GlassAgentRow } from "./glass-agent-row";

function Section(props: {
  section: GlassSidebarSection;
  selectedId: string | null;
  onSelectAgent: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section className="min-w-0 w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full min-w-0 items-center justify-start gap-1 px-2 py-1 text-left text-[11px] font-medium hover:text-muted-foreground",
          props.section.active ? "text-foreground/80" : "text-muted-foreground/60",
        )}
      >
        <IconChevronBottom
          className="size-3 shrink-0 opacity-60 transition-transform duration-150"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
        <span className="min-w-0 flex-1 truncate">{props.section.label}</span>
      </button>
      {open && (
        <div className="flex flex-col">
          {props.section.ids.map((id) => (
            <GlassAgentRow
              key={id}
              id={id}
              selectedId={props.selectedId}
              onSelectAgent={props.onSelectAgent}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function GlassAgentList(props: {
  sections: GlassSidebarSection[];
  selectedId: string | null;
  onSelectAgent: (threadId: string) => void;
  loading?: boolean;
  error?: boolean;
}) {
  if (props.loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 py-3 [scrollbar-gutter:stable]">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16 rounded-sm bg-muted/35" />
            <div className="flex flex-col gap-1">
              {Array.from({ length: 3 }, (_, j) => (
                <Skeleton key={j} className="h-8 w-full rounded-lg bg-muted/28" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (props.error) {
    return (
      <p className="px-2 py-4 text-xs text-muted-foreground/60">
        Unable to load threads right now.
      </p>
    );
  }

  if (props.sections.length === 0) {
    return (
      <p className="px-2 py-4 text-xs text-muted-foreground/60">
        No threads yet. Create a new agent to begin.
      </p>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 py-1 [scrollbar-gutter:stable]">
      {props.sections.map((section) => (
        <Section
          key={section.id}
          section={section}
          selectedId={props.selectedId}
          onSelectAgent={props.onSelectAgent}
        />
      ))}
    </div>
  );
}
