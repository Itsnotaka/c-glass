"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { IconCheckmark1Small } from "central-icons";
import * as React from "react";

import { cn } from "~/lib/utils";

function GlassCombobox<Value, Multiple extends boolean | undefined = false>(
  props: ComboboxPrimitive.Root.Props<Value, Multiple>,
) {
  return <ComboboxPrimitive.Root {...props} />;
}

function GlassComboboxTrigger({ className, children, ...props }: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      className={cn("flex cursor-pointer items-center outline-none", className)}
      data-slot="combobox-trigger"
      {...props}
    >
      {children}
    </ComboboxPrimitive.Trigger>
  );
}

function GlassComboboxPopup({
  className,
  children,
  side = "bottom",
  sideOffset = 8,
  align = "end",
  ...props
}: ComboboxPrimitive.Popup.Props & {
  align?: ComboboxPrimitive.Positioner.Props["align"];
  sideOffset?: ComboboxPrimitive.Positioner.Props["sideOffset"];
  side?: ComboboxPrimitive.Positioner.Props["side"];
}) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        align={align}
        anchor={undefined}
        className="z-50 select-none"
        data-slot="combobox-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <div
          className={cn(
            "flex min-h-0 max-h-[min(var(--available-height),20rem)] min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-xl border border-glass-stroke bg-glass-bubble shadow-glass-popup backdrop-blur-xl transition-[scale,opacity]",
            className,
          )}
        >
          <ComboboxPrimitive.Popup
            className="flex flex-col overflow-hidden text-foreground"
            data-slot="combobox-popup"
            {...props}
          >
            {children}
          </ComboboxPrimitive.Popup>
        </div>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function GlassComboboxSearchInput({
  className,
  value,
  onChange,
  placeholder = "Search...",
}: {
  className?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "flex h-8 w-full rounded-md border-0 bg-glass-hover/50 px-2 py-1.5 text-[12px]/[1.3] text-foreground outline-none placeholder:text-muted-foreground/50",
        className,
      )}
    />
  );
}

function GlassComboboxEmpty({ className, children, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      className={cn("py-4 text-center text-[12px]/[1.3] text-muted-foreground/70", className)}
      data-slot="combobox-empty"
      {...props}
    >
      {children}
    </ComboboxPrimitive.Empty>
  );
}

function GlassComboboxItem({
  className,
  children,
  hideIndicator = false,
  ...props
}: ComboboxPrimitive.Item.Props & {
  hideIndicator?: boolean;
}) {
  return (
    <ComboboxPrimitive.Item
      className={cn(
        "group flex min-h-7 cursor-pointer items-center gap-2 rounded-md py-1 pe-2 ps-2 text-[12px]/[1.3] outline-none transition-colors hover:bg-glass-hover data-selected:bg-glass-active data-highlighted:bg-glass-hover data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      data-slot="combobox-item"
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <ComboboxPrimitive.ItemIndicator
        className={cn(
          "flex size-4 shrink-0 items-center justify-center opacity-0 group-data-selected:opacity-100",
          hideIndicator && "hidden",
        )}
      >
        <IconCheckmark1Small className="size-3.5 text-muted-foreground/70" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

function GlassComboboxList({ className, children, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      className={cn(
        "max-h-[min(17rem,calc(min(var(--available-height),20rem)-5.25rem))] overflow-y-auto overscroll-contain py-1",
        className,
      )}
      data-slot="combobox-list"
      {...props}
    >
      {children}
    </ComboboxPrimitive.List>
  );
}

export {
  GlassCombobox,
  GlassComboboxTrigger,
  GlassComboboxPopup,
  GlassComboboxSearchInput,
  GlassComboboxEmpty,
  GlassComboboxItem,
  GlassComboboxList,
};
