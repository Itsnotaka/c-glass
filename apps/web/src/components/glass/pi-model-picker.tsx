import type { PiModelRef, PiThinkingLevel } from "@glass/contracts";
import { Menu } from "@base-ui/react/menu";
import { IconBrain, IconCheckmark1Small, IconChevronRight } from "central-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { usePretextOneLine } from "../../hooks/use-glass-pretext-one-line";
import { displayModelName, filterPiModels, type PiModelItem } from "../../lib/pi-models";
import { cn } from "../../lib/utils";

function PretextOneLine(props: {
  text: string;
  className?: string;
  fontPx?: number;
  lineHeightPx?: number;
}) {
  const { ref, shown, fallback } = usePretextOneLine({
    text: props.text,
    ...(props.fontPx !== undefined ? { fontPx: props.fontPx } : {}),
    ...(props.lineHeightPx !== undefined ? { lineHeightPx: props.lineHeightPx } : {}),
  });
  return (
    <span ref={ref} className={cn(props.className, fallback && "truncate")}>
      {shown}
    </span>
  );
}

/** Pi `thinkingLevel`: `off` disables extended reasoning; other values set depth. */
const thinkingOptions: { label: string; value: PiThinkingLevel }[] = [
  { label: "Off", value: "off" },
  { label: "Minimal", value: "minimal" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Extra High", value: "xhigh" },
];

export function thinkingDetailLabel(level: PiThinkingLevel) {
  const row = thinkingOptions.find((o) => o.value === level);
  return row?.label ?? level;
}

function clamp(level: PiThinkingLevel, xhigh: boolean) {
  if (level === "xhigh" && !xhigh) return "high";
  return level;
}

export type PiModelPickerSelection = {
  model: PiModelRef | null;
  thinkingLevel?: PiThinkingLevel;
};

function stopMenuSearchBubbling(e: React.KeyboardEvent) {
  e.stopPropagation();
}

export function PiModelPicker(props: {
  items: readonly PiModelItem[];
  selection: PiModelPickerSelection;
  disabled?: boolean;
  loading?: boolean;
  status?: "loading" | "ready" | "error";
  variant?: "hero" | "dock" | "settings";
  onSelect: (item: PiModelItem) => void;
  onThinkingLevel?: (level: PiThinkingLevel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const list = useMemo(() => filterPiModels(props.items, query), [props.items, query]);
  const cur = useMemo(
    () =>
      props.items.find(
        (item) =>
          item.provider === props.selection.model?.provider &&
          item.id === props.selection.model?.id,
      ),
    [props.items, props.selection.model],
  );
  const xhigh = Boolean(cur?.supportsXhigh);
  const thinkingItems = useMemo(
    () => (xhigh ? thinkingOptions : thinkingOptions.filter((item) => item.value !== "xhigh")),
    [xhigh],
  );

  useEffect(() => {
    if (open) return;
    setQuery("");
  }, [open]);

  // Focus search input when menu opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const thinkingValue = clamp(props.selection.thinkingLevel ?? "off", xhigh);
  const status = props.status ?? (props.loading ? "loading" : "ready");
  const busy = status === "loading";
  const failed = status === "error";
  const idle = !props.disabled && !busy && !failed && props.items.length > 0;
  const locked = (props.disabled ?? false) || busy || failed;
  const showThinking = Boolean(props.onThinkingLevel && cur?.reasoning);

  const triggerLabel = busy
    ? "Loading models"
    : cur != null
      ? displayModelName(cur.name || cur.id)
      : props.selection.model?.id
        ? displayModelName(props.selection.model.name ?? props.selection.model.id)
        : failed
          ? "Pi unavailable"
          : "Select model";

  const side = props.variant === "dock" ? "top" : "bottom";
  const align = props.variant === "settings" ? "start" : "end";
  const settings = props.variant === "settings";

  return (
    <Menu.Root
      open={open}
      onOpenChange={(next) => {
        if (locked) {
          setOpen(false);
          return;
        }
        setOpen(next);
      }}
    >
      <Menu.Trigger
        type="button"
        data-size="sm"
        aria-label={`Model: ${triggerLabel}${props.onThinkingLevel ? `, thinking ${thinkingDetailLabel(thinkingValue)}` : ""}`}
        disabled={!idle}
        className={cn(
          "ui-model-picker__trigger inline-flex max-w-[min(100%,280px)] min-w-0 gap-1.5 rounded border border-transparent bg-transparent text-left text-body/1 text-muted-foreground outline-none transition-colors hover:bg-glass-hover/50 hover:text-foreground/90 focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none",
          settings
            ? "h-auto min-h-6 flex-col items-start gap-0.5 py-1 pl-2 pr-1"
            : "h-6 items-center pl-2 pr-1",
          !idle && "opacity-50",
        )}
      >
        {busy ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Skeleton className={cn("h-3 rounded bg-muted/45", settings ? "w-28" : "w-20")} />
            {settings && props.onThinkingLevel ? (
              <Skeleton className="h-2 w-20 rounded bg-muted/35" />
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-1.5">
              {cur?.reasoning ? (
                <span
                  className="inline-flex shrink-0 items-center text-muted-foreground/70"
                  aria-hidden
                  title="Reasoning model"
                >
                  <IconBrain className="size-3" />
                </span>
              ) : null}
              <span className="min-w-0 flex-1 overflow-hidden">
                <PretextOneLine
                  text={triggerLabel}
                  className="block w-full min-w-0 text-left text-body text-muted-foreground"
                />
              </span>
            </div>
            {settings && props.onThinkingLevel ? (
              <span className="w-full truncate text-left text-caption text-muted-foreground/80">
                Thinking: {thinkingDetailLabel(thinkingValue)}
              </span>
            ) : null}
          </>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          className="z-50 outline-none ring-0"
          side={side}
          align={align}
          sideOffset={2}
        >
          <Menu.Popup
            className={cn(
              "flex max-h-[min(var(--available-height),20rem)] w-[min(16rem,var(--available-width))] min-w-[12rem] max-w-[16rem] flex-col overflow-hidden rounded-glass-card border border-glass-stroke bg-glass-bubble text-foreground shadow-glass-popup outline-none ring-0 backdrop-blur-xl focus:outline-none focus-visible:outline-none",
            )}
          >
            <div className="shrink-0 border-b border-glass-stroke/50 px-4 pt-2 pb-2">
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={stopMenuSearchBubbling}
                placeholder="Search models"
                className="flex min-h-0 w-full rounded border-0 bg-glass-hover/50 p-0 text-body text-foreground outline-none ring-0 placeholder:text-muted-foreground/50 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
              />
            </div>
            {list.length === 0 ? (
              <div className="shrink-0 px-4 py-3 text-center text-body text-muted-foreground/70">
                {failed
                  ? "Unable to load Pi models."
                  : props.items.length === 0
                    ? "No Pi models available yet."
                    : "No matching models."}
              </div>
            ) : null}
            {list.length > 0 ? (
              <div className="max-h-[min(17rem,calc(min(var(--available-height,100dvh),20rem)-5.25rem))] min-h-0 overflow-y-auto overscroll-contain pb-1 pt-0">
                {list.map((item) => {
                  const selected =
                    item.provider === props.selection.model?.provider &&
                    item.id === props.selection.model?.id;
                  const modeLabel = item.reasoning
                    ? selected
                      ? thinkingDetailLabel(thinkingValue)
                      : "Reasoning"
                    : undefined;
                  return (
                    <Menu.Item
                      key={item.key}
                      label={displayModelName(item.name || item.id)}
                      closeOnClick={false}
                      onClick={() => {
                        props.onSelect(item);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "group flex min-h-7 cursor-pointer items-center gap-2 rounded px-4 py-1 text-body outline-none ring-0 transition-colors hover:bg-glass-hover data-highlighted:bg-glass-hover focus-visible:outline-none focus-visible:ring-0",
                        selected && "bg-glass-active",
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="min-w-0 flex-1 overflow-hidden">
                          <PretextOneLine
                            text={displayModelName(item.name || item.id)}
                            className="block w-full min-w-0 text-left text-body text-foreground"
                          />
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          {item.reasoning ? (
                            <span className="inline-flex shrink-0" title={modeLabel}>
                              <IconBrain
                                className="size-3 shrink-0 text-muted-foreground/75"
                                aria-hidden
                              />
                            </span>
                          ) : null}
                          {selected ? (
                            <IconCheckmark1Small className="size-3.5 shrink-0 text-muted-foreground/70" />
                          ) : null}
                        </div>
                      </div>
                    </Menu.Item>
                  );
                })}
              </div>
            ) : null}
            {showThinking ? (
              <>
                <Menu.Separator className="mx-0 my-0 h-px shrink-0 bg-glass-stroke/50" />
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger
                    disabled={locked}
                    className="flex min-h-7 cursor-pointer items-center gap-2 rounded px-4 py-1 text-body outline-none ring-0 hover:bg-glass-hover data-[highlighted]:bg-glass-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-40 focus-visible:outline-none focus-visible:ring-0"
                    label="Thinking"
                  >
                    <span className="min-w-0 flex-1 text-left">Thinking</span>
                    <span className="shrink-0 text-muted-foreground/70">
                      {thinkingDetailLabel(thinkingValue)}
                    </span>
                    <IconChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner
                      className="z-50 outline-none ring-0"
                      side="right"
                      align="end"
                      sideOffset={2}
                    >
                      <Menu.Popup
                        className={cn(
                          "w-[min(14rem,var(--available-width))] min-w-[10rem] max-w-[14rem] overflow-hidden rounded-glass-card border border-glass-stroke bg-glass-bubble py-1 text-foreground shadow-glass-popup outline-none ring-0 backdrop-blur-md focus:outline-none focus-visible:outline-none",
                        )}
                      >
                        <Menu.Group>
                          <Menu.GroupLabel className="px-4 pb-1 pt-2 text-detail text-muted-foreground/70">
                            Reasoning
                          </Menu.GroupLabel>
                          <Menu.RadioGroup
                            value={thinkingValue}
                            onValueChange={(v) => {
                              props.onThinkingLevel?.(v as PiThinkingLevel);
                            }}
                          >
                            {thinkingItems.map((opt) => (
                              <Menu.RadioItem
                                key={opt.value}
                                value={opt.value}
                                closeOnClick={false}
                                className="flex min-h-7 cursor-pointer items-center gap-2 rounded px-4 py-1 text-body outline-none ring-0 hover:bg-glass-hover data-[highlighted]:bg-glass-hover focus-visible:outline-none focus-visible:ring-0"
                              >
                                <span className="min-w-0 flex-1">{opt.label}</span>
                                <Menu.RadioItemIndicator className="flex size-4 shrink-0 items-center justify-center">
                                  <IconCheckmark1Small className="size-3.5 text-muted-foreground/80" />
                                </Menu.RadioItemIndicator>
                              </Menu.RadioItem>
                            ))}
                          </Menu.RadioGroup>
                        </Menu.Group>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
