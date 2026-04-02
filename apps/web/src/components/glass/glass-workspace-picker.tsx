import { FolderIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { getGlass } from "../../host";
import { PI_GLASS_SHELL_CHANGED_EVENT } from "../../lib/pi-glass-constants";

export function GlassWorkspacePicker() {
  const [state, setState] = useState<{ cwd: string; name: string } | null>(null);

  useEffect(() => {
    let live = true;

    const load = () => {
      void getGlass()
        .shell.getState()
        .then((next) => {
          if (!live) return;
          setState(next);
        })
        .catch(() => {});
    };

    load();
    window.addEventListener(PI_GLASS_SHELL_CHANGED_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(PI_GLASS_SHELL_CHANGED_EVENT, load);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        void getGlass()
          .shell.pickWorkspace()
          .then((next) => {
            if (!next) return;
            setState(next);
            window.dispatchEvent(new CustomEvent(PI_GLASS_SHELL_CHANGED_EVENT));
          });
      }}
      className="font-glass inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground/65 transition-colors hover:bg-glass-hover hover:text-foreground"
      title={state?.cwd ?? "Choose workspace"}
    >
      <FolderIcon className="size-3 shrink-0" />
      <span className="truncate">{state?.name ?? "Workspace"}</span>
    </button>
  );
}
