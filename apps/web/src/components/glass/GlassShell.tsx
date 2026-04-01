import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export function GlassShell(props: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "glass-shell glass-shell-main flex min-h-0 min-w-0 flex-1 flex-col",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
