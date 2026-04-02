import { RefreshCwIcon, SettingsIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { isElectron } from "../../env";
import {
  setDesktopUpdateStateQueryData,
  useDesktopUpdateState,
} from "../../lib/desktop-update-react-query";
import { canCheckForUpdate } from "../desktop-update.logic";
import { toast } from "sonner";
import { useGlassSettings } from "./glass-settings-context";
import { GlassUpdatePill } from "./glass-update-pill";

export function GlassSidebarFooter() {
  const settings = useGlassSettings();
  const qc = useQueryClient();
  const state = useDesktopUpdateState().data ?? null;
  const [checking, setChecking] = useState(false);

  const check = useCallback(() => {
    const bridge = window.glass?.desktop;
    if (!bridge || !canCheckForUpdate(state)) return;
    setChecking(true);
    void bridge
      .checkForUpdate()
      .then((result) => {
        setDesktopUpdateStateQueryData(qc, result.state);
        if (!result.checked) return;
        if (result.state.status === "up-to-date") {
          toast.success("Already up to date");
        }
      })
      .finally(() => setChecking(false));
  }, [qc, state]);

  return (
    <div className="mt-auto flex shrink-0 flex-col border-t border-glass-border/80 px-1 py-1.5">
      <GlassUpdatePill />
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[11px] text-muted-foreground/50">Glass</span>
        <div className="flex items-center gap-0.5">
          {isElectron && canCheckForUpdate(state) && (
            <button
              type="button"
              onClick={check}
              disabled={checking}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-glass-hover hover:text-foreground disabled:opacity-40"
              aria-label="Check for updates"
              title="Check for updates"
            >
              <RefreshCwIcon className={`size-3.5 ${checking ? "animate-spin" : ""}`} />
            </button>
          )}
          <button
            type="button"
            onClick={settings.openSettings}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-glass-hover hover:text-foreground"
            aria-label="Settings"
          >
            <SettingsIcon className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
