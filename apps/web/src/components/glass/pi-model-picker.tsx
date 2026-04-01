import type { VariantProps } from "class-variance-authority";
import { ChevronDownIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Model } from "@mariozechner/pi-ai";
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

function value(model: Model<any> | null | undefined): string {
  if (!model) return "";
  return `${model.provider}/${model.id}`;
}

export function PiModelPicker(props: {
  items: ReadonlyArray<PiModelItem>;
  model: Model<any> | null;
  disabled?: boolean;
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"];
  triggerClassName?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  onSelect: (model: Model<any>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterPiModels(props.items, query), [props.items, query]);
  const cur = useMemo(
    () =>
      props.items.find(
        (item) => item.model.provider === props.model?.provider && item.id === props.model?.id,
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
      onOpenChange={(open) => {
        if (props.disabled) {
          setOpen(false);
          return;
        }
        setOpen(open);
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
        <span className="flex min-w-0 items-center gap-2 overflow-hidden">
          <span className="truncate font-medium">
            {cur?.id ?? props.model?.id ?? "Select model"}
          </span>
          <span className="truncate text-[11px] text-muted-foreground/70">
            {cur?.provider ?? props.model?.provider ?? "Pi"}
          </span>
        </span>
        <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0 opacity-60" />
      </ComboboxTrigger>
      <ComboboxPopup align={props.align ?? "end"} side={props.side ?? "bottom"} className="w-96">
        <div className="border-b p-1">
          <ComboboxInput
            className="[&_input]:font-sans rounded-md"
            inputClassName="ring-0"
            placeholder="Search models..."
            showTrigger={false}
            size="sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <ComboboxEmpty>
          {props.items.length === 0 ? "No Pi models available yet." : "No matching models."}
        </ComboboxEmpty>
        <ComboboxList className="max-h-72">
          {filtered.map((item, index) => (
            <ComboboxItem
              key={item.key}
              index={index}
              value={item.key}
              onClick={() => {
                setOpen(false);
                props.onSelect(item.model);
              }}
            >
              <div className="flex w-full min-w-0 items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{item.id}</div>
                  <div className="truncate text-[11px] text-muted-foreground/70">
                    {item.provider} · {item.name}
                  </div>
                </div>
                <div className="shrink-0 text-[10px] text-muted-foreground/55">
                  {item.model.reasoning ? "thinking" : "standard"}
                </div>
              </div>
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
