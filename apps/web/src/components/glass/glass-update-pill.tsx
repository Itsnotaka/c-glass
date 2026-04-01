import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { isElectron } from "../../env";
import {
  setDesktopUpdateStateQueryData,
  useDesktopUpdateState,
} from "../../lib/desktopUpdateReactQuery";
import {
  getDesktopUpdateButtonTooltip,
  getDesktopUpdateInstallConfirmationMessage,
  isDesktopUpdateButtonDisabled,
  resolveDesktopUpdateButtonAction,
  shouldShowDesktopUpdateButton,
} from "../desktopUpdate.logic";
import { toastManager } from "../ui/toast";

export function GlassUpdatePill() {
  const queryClient = useQueryClient();
  const state = useDesktopUpdateState().data ?? null;
  const [dismissed, setDismissed] = useState(false);

  const visible = isElectron && shouldShowDesktopUpdateButton(state) && !dismissed;
  const disabled = isDesktopUpdateButtonDisabled(state);
  const action = state ? resolveDesktopUpdateButtonAction(state) : "none";
  const tooltip = state ? getDesktopUpdateButtonTooltip(state) : "";
  const retry = state?.errorContext === "install" && typeof state.message === "string";

  const handle = useCallback(() => {
    const bridge = window.desktopBridge;
    if (!bridge || !state || disabled || action === "none") return;

    if (action === "download") {
      void bridge.downloadUpdate().then((result) => {
        setDesktopUpdateStateQueryData(queryClient, result.state);
        if (result.completed) {
          toastManager.add({
            type: "success",
            title: "Update downloaded",
            description: "Restart the app to install it.",
          });
        }
      });
      return;
    }

    if (action === "install") {
      const ok = window.confirm(getDesktopUpdateInstallConfirmationMessage(state));
      if (!ok) return;
      void bridge.installUpdate().then((result) => {
        setDesktopUpdateStateQueryData(queryClient, result.state);
      });
    }
  }, [action, disabled, queryClient, state]);

  if (!visible) return null;

  return (
    <button
      type="button"
      title={tooltip}
      disabled={disabled}
      onClick={handle}
      onDoubleClick={() => setDismissed(true)}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
    >
      {action === "install" ? (
        <>
          <RefreshCwIcon className="size-3.5 shrink-0" />
          <span className="truncate">{retry ? "Retry update" : "Restart to update"}</span>
        </>
      ) : state?.status === "downloading" ? (
        <>
          <DownloadIcon className="size-3.5 shrink-0 animate-pulse" />
          <span className="truncate">
            Downloading
            {typeof state.downloadPercent === "number"
              ? ` ${Math.floor(state.downloadPercent)}%`
              : "..."}
          </span>
        </>
      ) : (
        <>
          <DownloadIcon className="size-3.5 shrink-0" />
          <span className="truncate">Update available</span>
        </>
      )}
    </button>
  );
}
