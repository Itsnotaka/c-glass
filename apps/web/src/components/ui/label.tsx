import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

interface Props {
  size?: "default" | "section";
  htmlFor?: string;
  className?: string;
  children?: ReactNode;
}

function Label({ size = "default", htmlFor, className, children }: Props) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        size === "default" && "text-body font-medium",
        size === "section" && "text-detail font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </label>
  );
}

export { Label };
