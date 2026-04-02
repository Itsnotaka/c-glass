import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogPanel } from "../ui/dialog";
import { GeneralSettingsPanel } from "../settings/settings-panels";
import { useGlassSettings } from "./glass-settings-context";

export function GlassSettingsDialog() {
  const settings = useGlassSettings();

  return (
    <Dialog open={settings.open} onOpenChange={(v) => !v && settings.closeSettings()}>
      <DialogPopup className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <GeneralSettingsPanel />
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
