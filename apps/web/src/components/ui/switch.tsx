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
        "group relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-input transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary data-[unchecked]:bg-muted",
        props.className,
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-6 translate-x-0.5 translate-y-0.5 rounded-full bg-background shadow-sm ring-1 ring-border transition-transform group-data-[checked]:translate-x-5",
        )}
      />
    </SwitchPrimitive.Root>
  );
});

export { Switch };
