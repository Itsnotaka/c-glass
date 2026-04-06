import { memo, type ReactNode } from "react";
import { cn } from "~/lib/utils";

interface Props {
  leftSidebar?: ReactNode;
  center: ReactNode;
  rightSidebar?: ReactNode;
  leftWidth?: "w-56" | "w-64" | "w-72";
  rightWidth?: "w-80" | "w-96" | "w-[28rem]";
  rightCollapsed?: boolean;
  className?: string;
}

export const GlassWorkbenchLayout = memo(function GlassWorkbenchLayout(props: Props) {
  const leftWidth = props.leftWidth ?? "w-64";
  const rightWidth = props.rightWidth ?? "w-96";

  return (
    <div className={cn("flex h-full min-w-0", props.className)}>
      {/* Left sidebar - Agents panel */}
      {props.leftSidebar && (
        <aside
          className={cn(
            "flex shrink-0 flex-col border-r border-glass-border/50 bg-glass-sidebar",
            leftWidth,
          )}
        >
          {props.leftSidebar}
        </aside>
      )}

      {/* Center - Chat + Composer */}
      <main className="flex min-w-0 flex-1 flex-col bg-glass-chat">{props.center}</main>

      {/* Right sidebar - Changes/Diff panel */}
      {props.rightSidebar && (
        <aside
          className={cn(
            "flex shrink-0 flex-col border-l border-glass-border/50 bg-glass-surface transition-all duration-300",
            props.rightCollapsed ? "w-0 overflow-hidden" : rightWidth,
          )}
        >
          {props.rightSidebar}
        </aside>
      )}
    </div>
  );
});
