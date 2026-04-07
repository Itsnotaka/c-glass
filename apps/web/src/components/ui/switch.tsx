"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import * as React from "react";

import { cn } from "~/lib/utils";

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
};

const Switch = React.forwardRef<HTMLElement, SwitchProps>(function Switch(props, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      id={props.id}
      checked={props.checked}
      disabled={props.disabled}
      onCheckedChange={props.onCheckedChange}
      className={cn(
        "group relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-glass-pill border border-glass-border/45 bg-glass-hover/32 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:border-emerald-500/35 data-[checked]:bg-emerald-500",
        props.className,
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-1 ring-border transition-transform translate-x-[2px] translate-y-[2px] group-data-[checked]:translate-x-[18px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
});

export { Switch };
