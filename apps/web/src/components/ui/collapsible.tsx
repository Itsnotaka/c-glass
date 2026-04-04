"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

function Root(props: ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function Trigger({ className, ...props }: ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return (
    <CollapsiblePrimitive.Trigger
      className={cn(className)}
      data-slot="collapsible-trigger"
      {...props}
    />
  );
}

function Panel({ className, ...props }: ComponentProps<typeof CollapsiblePrimitive.Panel>) {
  return (
    <CollapsiblePrimitive.Panel
      className={cn(className)}
      data-slot="collapsible-panel"
      {...props}
    />
  );
}

export const Collapsible = {
  Root,
  Trigger,
  Panel,
};
