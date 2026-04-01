import { RefreshCwIcon, SettingsIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { isElectron } from "../../env";
import {
  setDesktopUpdateStateQueryData,
  useDesktopUpdateState,
} from "../../lib/desktopUpdateReactQuery";
import { canCheckForUpdate } from "../desktopUpdate.logic";
import { toastManager } from "../ui/toast";
import { GlassUpdatePill } from "./GlassUpdatePill";

export function GlassSidebarFooter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const state = useDesktopUpdateState().data ?? null;
  const [checking, setChecking] = useState(false);

  const check = useCallback(() => {
    const bridge = window.desktopBridge;
    if (!bridge || !canCheckForUpdate(state)) return;
    setChecking(true);
    void bridge
      .checkForUpdate()
      .then((result) => {
        setDesktopUpdateStateQueryData(queryClient, result.state);
        if (!result.checked) return;
        if (result.state.status === "up-to-date") {
          toastManager.add({ type: "success", title: "Already up to date" });
        }
      })
      .finally(() => setChecking(false));
  }, [queryClient, state]);

  const showCheck = isElectron && canCheckForUpdate(state);

  return (
    <div className="mt-auto flex shrink-0 flex-col border-t border-glass-panel-border px-1 py-1.5">
      <GlassUpdatePill />
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[11px] text-muted-foreground/50">Glass</span>
        <div className="flex items-center gap-0.5">
          {showCheck && (
            <button
              type="button"
              onClick={check}
              disabled={checking}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-[var(--glass-sidebar-hover)] hover:text-foreground disabled:opacity-40"
              aria-label="Check for updates"
              title="Check for updates"
            >
              <RefreshCwIcon className={`size-3.5 ${checking ? "animate-spin" : ""}`} />
            </button>
          )}
          <button
            type="button"
            onClick={() => void navigate({ to: "/settings" })}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-[var(--glass-sidebar-hover)] hover:text-foreground"
            aria-label="Settings"
          >
            <SettingsIcon className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
