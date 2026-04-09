import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export function GlassShell(props: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 flex-col bg-glass-editor",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
