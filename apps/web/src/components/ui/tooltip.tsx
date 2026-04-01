"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "~/lib/utils";

const Tooltip = TooltipPrimitive.Root;

function TooltipTrigger(props: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipPopup({
  className,
  align = "center",
  side = "top",
  ...props
}: TooltipPrimitive.Popup.Props & {
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner align={align} side={side} sideOffset={6}>
        <TooltipPrimitive.Popup
          className={cn(
            "z-50 overflow-hidden rounded-md border bg-popover px-2 py-1 text-popover-foreground text-xs shadow-md",
            className,
          )}
          data-slot="tooltip-popup"
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipPopup, TooltipTrigger };
