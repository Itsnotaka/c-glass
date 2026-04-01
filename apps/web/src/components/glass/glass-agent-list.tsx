import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import type { GlassSidebarSection } from "../../lib/glassViewModel";
import { GlassAgentRow } from "./glass-agent-row";

function Section(props: { section: GlassSidebarSection; onSelectAgent: (id: string) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <section className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="group flex w-full items-center gap-1 px-2 py-1 text-[11px] font-medium tracking-wide text-muted-foreground/60 uppercase hover:text-muted-foreground"
      >
        <ChevronDownIcon
          className="size-3 shrink-0 opacity-60 transition-transform duration-150"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
        <span className="truncate">{props.section.label}</span>
      </button>
      {open && (
        <div className="flex flex-col">
          {props.section.agents.map((agent) => (
            <GlassAgentRow
              key={agent.id}
              agent={agent}
              onSelect={() => props.onSelectAgent(agent.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function GlassAgentList(props: {
  sections: GlassSidebarSection[];
  onSelectAgent: (threadId: string) => void;
}) {
  if (props.sections.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground/60">
        No agents yet. Create one to begin.
      </p>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 py-1">
      {props.sections.map((section) => (
        <Section key={section.id} section={section} onSelectAgent={props.onSelectAgent} />
      ))}
    </div>
  );
}
