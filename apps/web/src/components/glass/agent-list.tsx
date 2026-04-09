import { IconChevronBottom, IconDotGrid1x3HorizontalTight, IconPlusLarge } from "central-icons";
import { useEffect, useId, useMemo, useState } from "react";
import { Skeleton } from "~/components/ui/skeleton";

import type { GlassSidebarSection } from "../../lib/glass-view-model";
import { cn } from "../../lib/utils";
import { GlassAgentRow } from "./agent-row";

const initialMaxVisible = 5;
const pageStep = 8;

function minVisibleForSelection(
  items: readonly GlassSidebarSection["items"][number][],
  selectedId: string | null,
) {
  if (items.length === 0) return 0;
  const firstPage = Math.min(items.length, initialMaxVisible);
  if (!selectedId) return firstPage;
  const i = items.findIndex((item) => item.id === selectedId);
  if (i < 0) return firstPage;
  return Math.min(items.length, Math.max(firstPage, i + 1));
}

function Section(props: {
  section: GlassSidebarSection;
  selectedId: string | null;
  onSelectAgent: (id: string) => void;
  onNewAgent?: (cwd: string) => void;
}) {
  const uid = useId();
  const labelId = `gws-l-${uid.replaceAll(":", "")}`;
  const panelId = `gws-p-${uid.replaceAll(":", "")}`;
  const [open, setOpen] = useState(true);
  const items = props.section.items;
  const minVisible = useMemo(
    () => minVisibleForSelection(items, props.selectedId),
    [items, props.selectedId],
  );
  const [extra, setExtra] = useState(0);

  useEffect(() => {
    setExtra((count) => {
      const need = Math.max(0, minVisible - initialMaxVisible);
      const min = need === 0 ? 0 : Math.ceil(need / pageStep);
      return Math.max(count, min);
    });
  }, [minVisible]);

  const firstPage = Math.min(items.length, initialMaxVisible);
  const rawVisible = Math.min(items.length, initialMaxVisible + extra * pageStep);
  let visible = Math.max(rawVisible, minVisible);
  if (items.length - visible === 1 && visible < items.length) visible = items.length;

  const shouldPaginate = items.length > firstPage;
  const showMore = shouldPaginate && visible < items.length;

  return (
    <section className="min-w-0 w-full">
      <div className="flex min-w-0 w-full items-center gap-1">
        <button
          id={labelId}
          type="button"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen(!open)}
          className={cn(
            "relative flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-glass-control px-2 py-1 text-left font-glass glass-sidebar-label outline-none touch-manipulation",
            "transition-[color] duration-150 ease motion-reduce:transition-none",
            "pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            props.section.active
              ? "text-foreground/90 [@media(hover:hover)]:hover:text-foreground"
              : "text-muted-foreground/60 [@media(hover:hover)]:hover:text-muted-foreground",
          )}
        >
          <IconChevronBottom
            className="size-3 shrink-0 opacity-60 transition-transform duration-150 ease-out motion-reduce:transition-none"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">{props.section.label}</span>
        </button>
        {props.onNewAgent ? (
          <button
            type="button"
            onClick={() => props.onNewAgent?.(props.section.cwd)}
            aria-label={`New agent in ${props.section.label}`}
            title={`New agent in ${props.section.label}`}
            className={cn(
              "relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-glass-control outline-none touch-manipulation",
              "transition-[color,background-color] duration-150 ease motion-reduce:transition-none",
              "pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              props.section.active
                ? "text-foreground/65 [@media(hover:hover)]:hover:bg-glass-hover [@media(hover:hover)]:hover:text-foreground"
                : "text-muted-foreground/55 [@media(hover:hover)]:hover:bg-glass-hover [@media(hover:hover)]:hover:text-muted-foreground",
            )}
          >
            <IconPlusLarge className="size-3.5 shrink-0" aria-hidden />
          </button>
        ) : null}
      </div>
      {open && (
        <div id={panelId} role="region" aria-labelledby={labelId} className="flex flex-col">
          {items.slice(0, visible).map((item) => (
            <GlassAgentRow
              key={item.id}
              item={item}
              selected={props.selectedId === item.id}
              onSelectAgent={props.onSelectAgent}
            />
          ))}
          {showMore ? (
            <button
              type="button"
              onClick={() => setExtra((count) => count + 1)}
              className={cn(
                "relative flex min-h-7.5 w-full cursor-pointer items-center gap-2 rounded-glass-control px-2 py-1 text-left font-glass text-detail/4 text-muted-foreground/70 outline-none touch-manipulation",
                "transition-[color,background-color] duration-150 ease motion-reduce:transition-none",
                "pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                "[@media(hover:hover)]:hover:bg-glass-hover [@media(hover:hover)]:hover:text-muted-foreground",
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
  onSelectAgent: (id: string) => void;
  onNewAgent?: (cwd: string) => void;
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
        Unable to load chats right now.
      </p>
    );
  }

  if (props.sections.length === 0) {
    return (
      <p className="px-2 py-4 text-detail text-muted-foreground/60">
        No chats yet. Start a chat to begin.
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
          {...(props.onNewAgent ? { onNewAgent: props.onNewAgent } : {})}
        />
      ))}
    </div>
  );
}
