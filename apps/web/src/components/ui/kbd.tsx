import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

interface Props {
  keys?: string[];
  className?: string;
  children?: ReactNode;
}

function Kbd({ keys, className, children }: Props) {
  if (keys) {
    return (
      <span className={cn("inline-flex items-center gap-0.5", className)}>
        {keys.map((k) => (
          <kbd
            key={k}
            className="inline-flex items-center justify-center rounded border border-glass-border/50 bg-glass-hover/20 px-1 py-0.5 text-caption/[1] font-medium text-muted-foreground"
          >
            {k}
          </kbd>
        ))}
      </span>
    );
  }

  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded border border-glass-border/50 bg-glass-hover/20 px-1 py-0.5 text-caption/[1] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export { Kbd };
