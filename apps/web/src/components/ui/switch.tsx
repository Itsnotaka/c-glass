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
        "group relative inline-flex h-[1.625rem] w-11 shrink-0 cursor-pointer rounded-full border border-input bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary",
        props.className,
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-background shadow-sm ring-1 ring-border transition-transform translate-x-[2px] translate-y-[2px] group-data-[checked]:translate-x-[22px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
});

export { Switch };
