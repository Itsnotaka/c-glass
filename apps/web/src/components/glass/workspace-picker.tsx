import { IconFolder1 } from "central-icons";
import { useShellState } from "../../hooks/use-shell-cwd";
import { shortWorkspacePathLabel } from "../../lib/glass-path-label";
import { pickWorkspace } from "../../lib/glass-workspace";
import { usePiStore } from "../../lib/pi-session-store";
import { cn } from "../../lib/utils";

export function GlassWorkspacePicker(props: { className?: string }) {
  const shell = useShellState();
  const reset = usePiStore((item) => item.resetForWorkspaceChange);

  return (
    <button
      type="button"
      onClick={() => void pickWorkspace(reset)}
      className={cn(
        "font-glass glass-sidebar-label flex min-w-0 items-center justify-start gap-2 rounded-glass-control px-2 py-1 text-left text-muted-foreground/65 transition-colors hover:bg-glass-hover hover:text-foreground",
        props.className,
      )}
      title={shell.cwd ?? "Choose workspace"}
    >
      <IconFolder1 className="size-4 shrink-0 opacity-60" />
      <span className="truncate">
        {shell.cwd ? shortWorkspacePathLabel(shell.cwd, shell.home) : "Workspace"}
      </span>
    </button>
  );
}
