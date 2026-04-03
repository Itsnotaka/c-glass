import type { PiModelRef, PiThinkingLevel } from "@glass/contracts";
import { IconChevronBottom, IconFormHexagon } from "central-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterPiModels, type PiModelItem } from "../../lib/pi-models";
import { cn } from "../../lib/utils";
import {
  GlassCombobox,
  GlassComboboxEmpty,
  GlassComboboxItem,
  GlassComboboxList,
  GlassComboboxPopup,
  GlassComboboxSearchInput,
  GlassComboboxTrigger,
} from "./glass-combobox";

function value(model: PiModelRef | null | undefined) {
  if (!model) return "";
  return `${model.provider}/${model.id}`;
}

const thinkingOptions: { label: string; value: PiThinkingLevel }[] = [
  { label: "Fast", value: "off" },
  { label: "Minimal", value: "minimal" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "X-High", value: "xhigh" },
];

function ThinkingDropdown(props: {
  value: PiThinkingLevel;
  onChange: (value: PiThinkingLevel) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const displayLabel =
    props.value === "off" ? "Fast" : props.value.charAt(0).toUpperCase() + props.value.slice(1);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={props.disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex h-6 items-center gap-1 rounded-full bg-glass-hover/60 px-2 text-[11px]/[1.2] font-medium tabular-nums text-muted-foreground/80 transition-colors hover:bg-glass-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <span className="capitalize">{displayLabel}</span>
        <IconChevronBottom className="size-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 flex flex-col gap-0.5 rounded-lg border border-glass-stroke bg-glass-bubble p-1 shadow-glass-popup backdrop-blur-xl">
          {thinkingOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px]/[1.3] text-foreground outline-none transition-colors hover:bg-glass-hover",
                opt.value === props.value && "bg-glass-active",
              )}
            >
              <IconFormHexagon className="size-3 shrink-0 text-muted-foreground/70" />
              <span className="capitalize">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PiModelPicker(props: {
  items: readonly PiModelItem[];
  model: PiModelRef | null;
  thinkingLevel?: PiThinkingLevel;
  disabled?: boolean;
  triggerClassName?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  onSelect: (model: PiModelItem) => void;
  onThinkingLevel?: (level: PiThinkingLevel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const list = useMemo(() => filterPiModels(props.items, query), [props.items, query]);
  const cur = useMemo(
    () =>
      props.items.find(
        (item) => item.provider === props.model?.provider && item.id === props.model?.id,
      ),
    [props.items, props.model],
  );

  useEffect(() => {
    if (open) return;
    setQuery("");
  }, [open]);

  const showThinking = cur?.reasoning === true;
  const thinkingValue = props.thinkingLevel ?? "off";

  return (
    <GlassCombobox
      items={props.items.map((item) => item.key)}
      filteredItems={list.map((item) => item.key)}
      autoHighlight
      onOpenChange={(next, detail) => {
        if (props.disabled) {
          setOpen(false);
          return;
        }
        if (!next && detail.reason === "item-press") return;
        setOpen(next);
      }}
      open={open}
      value={value(props.model)}
    >
      <GlassComboboxTrigger
        className={cn(
          "flex h-7 max-w-52 min-w-0 items-center gap-1.5 rounded-full px-1.5 text-muted-foreground/70 transition-colors hover:bg-glass-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50",
          props.triggerClassName,
        )}
        disabled={props.disabled || props.items.length === 0}
      >
        <span className="min-w-0 flex-1 truncate text-[13px]/[1.3] font-medium">
          {cur?.name ?? cur?.id ?? props.model?.id ?? "Select model"}
        </span>
        {showThinking && (
          <span className="shrink-0 rounded-full bg-glass-hover/60 px-1.5 py-px text-[10px]/[1.2] font-medium tabular-nums text-muted-foreground/70">
            {props.thinkingLevel}
          </span>
        )}
        <IconChevronBottom className="size-3 shrink-0 opacity-60" />
      </GlassComboboxTrigger>
      <GlassComboboxPopup align={props.align ?? "end"} side={props.side ?? "bottom"} sideOffset={8}>
        <div className="border-b border-glass-stroke/50 px-2 pt-2 pb-1.5">
          <GlassComboboxSearchInput value={query} onChange={setQuery} placeholder="Search models" />
        </div>
        <GlassComboboxEmpty>
          {props.items.length === 0 ? "No Pi models available yet." : "No matching models."}
        </GlassComboboxEmpty>
        <GlassComboboxList>
          {list.map((item, index) => (
            <GlassComboboxItem
              key={item.key}
              index={index}
              value={item.key}
              onClick={() => {
                props.onSelect(item);
              }}
            >
              <div className="flex w-full min-w-0 items-center gap-2">
                <IconFormHexagon className="size-3.5 shrink-0 text-muted-foreground/50" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{item.name || item.id}</div>
                  <div className="truncate text-[11px]/[1.2] text-muted-foreground/65">
                    {item.provider}
                  </div>
                </div>
                {item.reasoning && (
                  <ThinkingDropdown
                    value={thinkingValue}
                    onChange={props.onThinkingLevel ?? (() => {})}
                    disabled={props.disabled ?? false}
                  />
                )}
              </div>
            </GlassComboboxItem>
          ))}
        </GlassComboboxList>
      </GlassComboboxPopup>
    </GlassCombobox>
  );
}
