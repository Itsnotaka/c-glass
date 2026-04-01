import type { PiModelRef } from "@glass/contracts";
import type { VariantProps } from "class-variance-authority";
import { ChevronDownIcon, HexagonIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { filterPiModels, type PiModelItem } from "../../lib/pi-models";
import { cn } from "../../lib/utils";
import { Button, buttonVariants } from "../ui/button";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxTrigger,
} from "../ui/combobox";

function value(model: PiModelRef | null | undefined) {
  if (!model) return "";
  return `${model.provider}/${model.id}`;
}

function tag(item: PiModelRef) {
  return item.reasoning ? "Thinking" : "Fast";
}

export function PiModelPicker(props: {
  items: readonly PiModelItem[];
  model: PiModelRef | null;
  disabled?: boolean;
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"];
  triggerClassName?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  onSelect: (model: PiModelItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterPiModels(props.items, query), [props.items, query]);
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

  return (
    <Combobox
      items={props.items.map((item) => item.key)}
      filteredItems={filtered.map((item) => item.key)}
      autoHighlight
      onOpenChange={(next) => {
        if (props.disabled) {
          setOpen(false);
          return;
        }
        setOpen(next);
      }}
      open={open}
      value={value(props.model)}
    >
      <ComboboxTrigger
        render={
          <Button
            size="sm"
            variant={props.triggerVariant ?? "outline"}
            className={cn(
              "min-w-0 max-w-none justify-between gap-2 text-foreground/90 hover:text-foreground",
              props.triggerClassName,
            )}
            disabled={props.disabled || props.items.length === 0}
          />
        }
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span className="min-w-0 truncate text-[13px]/4 font-medium">
            {cur?.name ?? cur?.id ?? props.model?.id ?? "Select model"}
          </span>
          {cur ? (
            <span
              className="shrink-0 rounded border border-[var(--glass-stroke-tertiary)] bg-[var(--glass-sidebar-hover)]/60 px-1.5 py-px text-[10px] font-medium text-muted-foreground tabular-nums"
              aria-hidden
            >
              {tag(cur)}
            </span>
          ) : null}
        </span>
        <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0 opacity-60" />
      </ComboboxTrigger>
      <ComboboxPopup
        align={props.align ?? "end"}
        side={props.side ?? "bottom"}
        sideOffset={6}
        className="glass-model-picker-popup w-[min(100vw-24px,22rem)] overflow-hidden p-0 before:shadow-none"
      >
        <div className="border-b border-[var(--glass-stroke-tertiary)] px-2.5 pt-2.5 pb-2">
          <ComboboxInput
            startAddon={<SearchIcon className="size-3.5 text-muted-foreground/70" aria-hidden />}
            className="[&_input]:font-sans [&_[data-slot=input-control]]:rounded-md [&_[data-slot=input-control]]:border-0 [&_[data-slot=input-control]]:bg-[var(--glass-sidebar-hover)]/55 [&_[data-slot=input-control]]:shadow-none [&_[data-slot=input-control]]:ring-0 dark:[&_[data-slot=input-control]]:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)]"
            inputClassName="placeholder:text-muted-foreground/55"
            placeholder="Search models"
            showTrigger={false}
            size="sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <ComboboxEmpty className="py-6 text-muted-foreground/80">
          {props.items.length === 0 ? "No Pi models available yet." : "No matching models."}
        </ComboboxEmpty>
        <ComboboxList className="max-h-72 py-1.5">
          {filtered.map((item, index) => (
            <ComboboxItem
              key={item.key}
              index={index}
              value={item.key}
              className="mx-1 my-0.5 rounded-md border-0 py-1.5 ps-2 hover:bg-[var(--glass-sidebar-hover)] data-highlighted:bg-[var(--glass-sidebar-hover)] data-selected:bg-[var(--glass-sidebar-active)] data-selected:shadow-none [&[data-highlighted][data-selected]]:bg-[var(--glass-sidebar-active)]"
              onClick={() => {
                setOpen(false);
                props.onSelect(item);
              }}
            >
              <div className="flex w-full min-w-0 items-center gap-2.5">
                <HexagonIcon
                  className="size-3.5 shrink-0 text-muted-foreground/45"
                  aria-hidden
                  strokeWidth={1.5}
                />
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[13px]/4 font-medium text-foreground">
                    {item.name || item.id}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground/75">
                    {item.provider}
                  </div>
                </div>
                <span className="shrink-0 rounded border border-[var(--glass-stroke-tertiary)] bg-[var(--glass-sidebar-hover)]/40 px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground">
                  {tag(item)}
                </span>
              </div>
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
