"use client";

import type * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "~/lib/utils";

const Sheet = DialogPrimitive.Root;

function SheetPopup({
  className,
  side = "right",
  showCloseButton: _showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/32 backdrop-blur-sm" />
      <DialogPrimitive.Popup
        className={cn(
          "fixed z-50 flex min-h-0 flex-col overflow-hidden border bg-popover text-popover-foreground shadow-lg",
          side === "left" &&
            "inset-y-0 left-0 w-[min(100vw-12px,var(--sidebar-width,20rem))] border-r",
          side === "right" &&
            "inset-y-0 right-0 w-[min(100vw-12px,var(--sidebar-width,20rem))] border-l",
          side === "top" && "inset-x-0 top-0 h-auto border-b",
          side === "bottom" && "inset-x-0 bottom-0 h-auto border-t",
          className,
        )}
        data-slot="sheet-popup"
        {...props}
      />
    </DialogPrimitive.Portal>
  );
}

function SheetHeader(props: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" {...props} />;
}

function SheetTitle(props: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title data-slot="sheet-title" {...props} />;
}

function SheetDescription(props: DialogPrimitive.Description.Props) {
  return <DialogPrimitive.Description data-slot="sheet-description" {...props} />;
}

export { Sheet, SheetDescription, SheetHeader, SheetPopup, SheetTitle };
