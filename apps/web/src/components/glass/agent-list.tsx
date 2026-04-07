import { IconChevronBottom, IconDotGrid1x3HorizontalTight } from "central-icons";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "~/components/ui/skeleton";

import type { GlassSidebarSection } from "../../lib/glass-view-model";
import { cn } from "../../lib/utils";
import { GlassAgentRow } from "./agent-row";

/** Matches Cursor `workbench.desktop.main.js`: `E$i=5,H_l=8` (SidebarPaginatedMenu). */
const initialMaxVisible = 5;
const pageStep = 8;

function minVisibleForSelection(ids: readonly string[], selectedId: string | null) {
  if (ids.length === 0) return 0;
  const firstPage = Math.min(ids.length, initialMaxVisible);
  if (!selectedId) return firstPage;
  const i = ids.indexOf(selectedId);
  if (i < 0) return firstPage;
  return Math.min(ids.length, Math.max(firstPage, i + 1));
}

function Section(props: {
  section: GlassSidebarSection;
  selectedId: string | null;
  onSelectAgent: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const ids = props.section.ids;
  const minVisible = useMemo(
    () => minVisibleForSelection(ids, props.selectedId),
    [ids, props.selectedId],
  );
  const [extra, setExtra] = useState(0);

  useEffect(() => {
    setExtra((b) => {
      const need = Math.max(0, minVisible - initialMaxVisible);
      const minB = need === 0 ? 0 : Math.ceil(need / pageStep);
      return Math.max(b, minB);
    });
  }, [minVisible]);

  const firstPage = Math.min(ids.length, initialMaxVisible);
  const rawVisible = Math.min(ids.length, initialMaxVisible + extra * pageStep);
  let visible = Math.max(rawVisible, minVisible);
  if (ids.length - visible === 1 && visible < ids.length) visible = ids.length;

  const shouldPaginate = ids.length > firstPage;
  const showMore = shouldPaginate && visible < ids.length;

  return (
    <section className="min-w-0 w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full min-w-0 items-center justify-start gap-1 px-2 py-1 text-left text-detail font-medium hover:text-muted-foreground",
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
          {ids.slice(0, visible).map((id) => (
            <GlassAgentRow
              key={id}
              id={id}
              selectedId={props.selectedId}
              onSelectAgent={props.onSelectAgent}
            />
          ))}
          {showMore ? (
            <button
              type="button"
              onClick={() => setExtra((b) => b + 1)}
              className={cn(
                "font-glass flex min-h-7.5 w-full items-center justify-start gap-2 rounded-glass-control px-2 py-1 text-left text-detail/4 text-muted-foreground/70 transition-colors",
                "hover:bg-glass-hover hover:text-muted-foreground",
              )}
            >
              <IconDotGrid1x3HorizontalTight className="size-3 shrink-0 opacity-55" aria-hidden />
              <span className="min-w-0">More</span>
            </button>
          ) : null}
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
            <Skeleton className="h-3 w-16 rounded-glass-control bg-muted/35" />
            <div className="flex flex-col gap-1">
              {Array.from({ length: 3 }, (_, j) => (
                <Skeleton key={j} className="h-8 w-full rounded-glass-control bg-muted/28" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (props.error) {
    return (
      <p className="px-2 py-4 text-detail text-muted-foreground/60">
        Unable to load threads right now.
      </p>
    );
  }

  if (props.sections.length === 0) {
    return (
      <p className="px-2 py-4 text-detail text-muted-foreground/60">
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
