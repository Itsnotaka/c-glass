import { IconSettingsGear2 } from "central-icons";

import { useGlassSettings } from "./glass-settings-context";
import { GlassUpdatePill } from "./glass-update-pill";

export function GlassSidebarFooter() {
  const settings = useGlassSettings();

  return (
    <div className="mt-auto flex shrink-0 flex-col px-1 py-1.5">
      <GlassUpdatePill />
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[11px] text-muted-foreground/50">Glass</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={settings.openSettings}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-glass-hover hover:text-foreground"
            aria-label="Settings"
          >
            <IconSettingsGear2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
