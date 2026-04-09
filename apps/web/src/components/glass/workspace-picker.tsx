import { IconChevronDownSmall, IconFolder1 } from "central-icons";
import { useShellState } from "../../hooks/use-shell-cwd";
import { shortWorkspacePathLabel } from "../../lib/glass-path-label";
import { pickWorkspace } from "../../lib/glass-workspace";
import { cn } from "../../lib/utils";

export function GlassWorkspacePicker(props: { className?: string; variant?: "rail" | "composer" }) {
  const shell = useShellState();
  const rail = props.variant !== "composer";

  return (
    <button
      type="button"
      onClick={() => void pickWorkspace()}
      className={cn(
        "font-glass flex min-w-0 items-center gap-1.5 text-left transition-colors",
        rail
          ? "glass-sidebar-label justify-start gap-2 rounded-glass-control px-2 py-1 text-muted-foreground/65 hover:bg-glass-hover hover:text-foreground"
          : "glass-sidebar-label max-w-[min(100%,14rem)] justify-start rounded-glass-control px-1.5 py-0.5 text-muted-foreground/80 hover:bg-glass-hover/80 hover:text-foreground",
        props.className,
      )}
      title={shell.cwd ?? "Choose workspace"}
    >
      <IconFolder1 className="size-4 shrink-0 opacity-60" />
      <span className="min-w-0 truncate">
        {shell.cwd ? shortWorkspacePathLabel(shell.cwd, shell.home) : "Workspace"}
      </span>
      {rail ? null : <IconChevronDownSmall className="size-3.5 shrink-0 opacity-55" aria-hidden />}
    </button>
  );
}
