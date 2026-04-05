import type { ComponentProps } from "react";

import { cn } from "~/lib/utils";

function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-glass-control bg-muted/50", className)}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
