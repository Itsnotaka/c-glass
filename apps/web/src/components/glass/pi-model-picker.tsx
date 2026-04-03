import type { PiModelRef, PiThinkingLevel } from "@glass/contracts";
import { IconChevronBottom, IconSettingsGear2 } from "central-icons";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

const thinkingMenuMinPx = 14 * 16;

function thinkingDetailLabel(level: PiThinkingLevel) {
  const row = thinkingOptions.find((o) => o.value === level);
  return row?.label ?? level;
}

function rowMutedDetail(item: PiModelItem, selected: boolean, thinking: PiThinkingLevel) {
  if (!item.reasoning) return "Fast";
  if (selected) return thinkingDetailLabel(thinking);
  return "Reasoning";
}

function ThinkingLevelMenu(props: {
  value: PiThinkingLevel;
  onChange: (value: PiThinkingLevel) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = anchorRef.current?.getBoundingClientRect();
      if (!b) return;
      let left = b.right - thinkingMenuMinPx;
      left = Math.max(8, Math.min(left, window.innerWidth - thinkingMenuMinPx - 8));
      setBox({ top: b.bottom + 4, left });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const n = e.target as Node;
      if (anchorRef.current?.contains(n)) return;
      if (menuRef.current?.contains(n)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={anchorRef}
        type="button"
        disabled={props.disabled}
        aria-label="Thinking level"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex items-center rounded-md p-1 text-muted-foreground/80 outline-none transition-colors hover:bg-glass-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
      >
        <IconSettingsGear2 className="size-3.5" />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: box.top, left: box.left }}
            onPointerDown={(e) => e.stopPropagation()}
            className="z-[200] flex min-w-[14rem] flex-col gap-px rounded-lg border border-glass-stroke bg-glass-bubble p-1 backdrop-blur-xl"
          >
            {thinkingOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onChange(opt.value);
                }}
                className={cn(
                  "flex w-full items-center rounded-md px-2 py-1 text-left text-[11px]/[1.3] text-foreground outline-none transition-colors hover:bg-glass-hover",
                  opt.value === props.value && "bg-glass-active",
                )}
              >
                <span className="capitalize">{opt.label}</span>
              </button>
            ))}
          </div>,
          document.body,
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
        <span className="min-w-0 flex-1 truncate text-left text-[12px]/[1.3] font-medium">
          {cur?.name ?? cur?.id ?? props.model?.id ?? "Select model"}
        </span>
        <IconChevronBottom className="size-3 shrink-0 opacity-60" />
      </GlassComboboxTrigger>
      <GlassComboboxPopup
        align={props.align ?? "start"}
        className="min-w-[min(26rem,var(--available-width))]"
        side={props.side ?? "bottom"}
        sideOffset={8}
      >
        <div className="shrink-0 border-b border-glass-stroke/50 px-2 pt-2 pb-1.5">
          <GlassComboboxSearchInput value={query} onChange={setQuery} placeholder="Search models" />
        </div>
        <GlassComboboxEmpty>
          {props.items.length === 0 ? "No Pi models available yet." : "No matching models."}
        </GlassComboboxEmpty>
        <GlassComboboxList>
          {list.map((item, index) => {
            const selected = item.provider === props.model?.provider && item.id === props.model?.id;
            return (
              <GlassComboboxItem
                key={item.key}
                index={index}
                value={item.key}
                onClick={() => {
                  props.onSelect(item);
                }}
              >
                <div className="flex w-full min-w-0 items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="truncate font-medium text-foreground">
                      {item.name || item.id}
                    </span>
                    <span className="shrink-0 text-[10px]/[1.2] text-muted-foreground">
                      {rowMutedDetail(item, selected, thinkingValue)}
                    </span>
                  </div>
                  {item.reasoning && (
                    <ThinkingLevelMenu
                      value={thinkingValue}
                      onChange={props.onThinkingLevel ?? (() => {})}
                      disabled={props.disabled ?? false}
                    />
                  )}
                </div>
              </GlassComboboxItem>
            );
          })}
        </GlassComboboxList>
      </GlassComboboxPopup>
    </GlassCombobox>
  );
}
