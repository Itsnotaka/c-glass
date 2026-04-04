/**
 * Composer token launcher: Cursor upstream class names in `glass-slash-cursor-refs.ts`.
 * Uses Base UI Popover (see `Popover.Positioner` `anchor`) — not Menu/Combobox, because the query
 * lives in the multiline textarea (`docs/cursor-slash-menu-recreation-plan.md`).
 */
import type { ShellFileHit, ShellFilePreview } from "@glass/contracts";
import { Popover } from "@base-ui/react/popover";
import {
  IconBolt,
  IconChevronRight,
  IconFileBend,
  IconFolder1,
  IconImages1,
  IconSettingsGear2,
  IconSparklesSoft,
} from "central-icons";
import type { RefObject } from "react";
import { cn } from "../../lib/utils";
import { ScrollArea } from "~/components/ui/scroll-area";
import { GlassComposerFilePreview } from "./glass-composer-file-preview";
import type { GlassSlashItem, SlashMenuRow } from "./glass-slash-registry";

function kindGlyph(kind: GlassSlashItem["kind"]) {
  if (kind === "skill") return IconSparklesSoft;
  if (kind === "app") return IconSettingsGear2;
  if (kind === "subagent") return IconBolt;
  return IconBolt;
}

export function GlassComposerTokenMenu(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: RefObject<Element | null> | null;
  variant: "hero" | "dock";
  mode: "slash" | "file";
  slashRows: SlashMenuRow[];
  slashActive: number;
  onSlashHover: (optionIndex: number) => void;
  onSlashPick: (item: GlassSlashItem) => void;
  hits: ShellFileHit[];
  fileActive: number;
  onFileHover: (i: number) => void;
  onFilePick: (hit: ShellFileHit) => void;
  filePick: ShellFileHit | null;
  preview: ShellFilePreview | null;
  loading: boolean;
}) {
  const side = props.variant === "dock" ? "top" : "bottom";
  const anchor = props.anchor ?? undefined;

  return (
    <Popover.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Popover.Portal>
        <Popover.Positioner
          anchor={anchor}
          side={side}
          align="start"
          sideOffset={8}
          className="z-50 outline-none"
        >
          <Popover.Popup
            initialFocus={false}
            finalFocus={false}
            className={cn(
              "glass-slash-menu-popup glass-composer-token-menu",
              "origin-[var(--transform-origin)]",
              "overflow-hidden rounded-[18px] border border-glass-stroke bg-glass-bubble shadow-glass-popup backdrop-blur-xl",
              "w-[min(28rem,calc(100vw-2rem))] max-w-[min(28rem,calc(100vw-2rem))]",
            )}
          >
            {props.mode === "file" ? (
              <div className="grid bg-glass-border/20 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
                <div className="min-w-0 border-b border-glass-border/20 md:border-r md:border-b-0">
                  <ScrollArea className="max-h-74">
                    <div
                      className="px-2 py-2"
                      role="listbox"
                      aria-label="File mentions"
                      aria-busy={props.loading}
                    >
                      {props.loading ? (
                        <div className="px-2.5 py-3 text-[12px] text-muted-foreground/72">
                          Loading…
                        </div>
                      ) : (
                        props.hits.map((item, i) => {
                          const active = i === props.fileActive;
                          return (
                            <button
                              key={item.path}
                              type="button"
                              role="option"
                              aria-selected={active}
                              data-highlighted={active ? "" : undefined}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-2xl px-2.5 py-2 text-left transition-colors motion-reduce:transition-none",
                                active
                                  ? "bg-glass-active text-foreground"
                                  : "text-foreground/82 hover:bg-glass-hover/40",
                              )}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                props.onFileHover(i);
                                props.onFilePick(item);
                              }}
                              onMouseEnter={() => props.onFileHover(i)}
                            >
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-glass-hover/18 text-muted-foreground/72">
                                {item.kind === "dir" ? (
                                  <IconFolder1 className="size-4.5" />
                                ) : item.kind === "image" ? (
                                  <IconImages1 className="size-4.5" />
                                ) : (
                                  <IconFileBend className="size-4.5" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12px]/[1.2] font-medium">
                                  {item.name}
                                </span>
                                <span className="block truncate text-[11px]/[1.2] text-muted-foreground/72">
                                  {item.path}
                                </span>
                              </span>
                              {item.kind === "dir" ? (
                                <IconChevronRight className="size-3.5 shrink-0 text-muted-foreground/62" />
                              ) : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </div>
                <GlassComposerFilePreview item={props.filePick} preview={props.preview} />
              </div>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="px-2 py-2" role="listbox" aria-label="Slash commands">
                  {props.slashRows.map((row) => {
                    if (row.kind === "header") {
                      return (
                        <div
                          key={row.key}
                          className="px-2.5 pb-1 pt-2 text-[10px]/[1.2] font-medium tracking-wide text-muted-foreground/62 uppercase"
                          role="presentation"
                        >
                          {row.label}
                        </div>
                      );
                    }
                    const active = row.optionIndex === props.slashActive;
                    const Glyph = kindGlyph(row.item.kind);
                    return (
                      <button
                        key={`${row.item.id}:${row.optionIndex}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        data-highlighted={active ? "" : undefined}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors motion-reduce:transition-none",
                          active
                            ? "bg-glass-active text-foreground"
                            : "text-foreground/82 hover:bg-glass-hover/40",
                        )}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          props.onSlashHover(row.optionIndex);
                          props.onSlashPick(row.item);
                        }}
                        onMouseEnter={() => props.onSlashHover(row.optionIndex)}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-glass-hover/18 text-muted-foreground/72">
                          <Glyph className="size-4.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px]/[1.2] font-medium">
                            /{row.item.name}
                          </span>
                          <span className="block truncate text-[11px]/[1.2] text-muted-foreground/72">
                            {row.item.description || "Command"}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full border border-glass-border/40 px-1.5 py-0.5 text-[10px]/[1] text-muted-foreground/68">
                          {row.item.pill}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
