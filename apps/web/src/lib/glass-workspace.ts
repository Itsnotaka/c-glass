import { readGlass } from "../host";
import { PI_GLASS_SHELL_CHANGED_EVENT } from "./pi-glass-constants";
import { usePiStore } from "./pi-session-store";

export async function pickWorkspace(reset: () => void) {
  const glass = readGlass();
  if (!glass) return null;

  try {
    const next = await glass.shell.pickWorkspace();
    if (!next) return null;
    reset();
    window.dispatchEvent(new CustomEvent(PI_GLASS_SHELL_CHANGED_EVENT));
    return next;
  } catch {
    await Promise.all([usePiStore.getState().refreshCfg(), usePiStore.getState().refreshSums()]);
    return null;
  }
}

export async function switchWorkspace(cwd: string, reset: () => void) {
  const glass = readGlass();
  if (!glass) return false;

  try {
    reset();
    await glass.shell.setWorkspace(cwd);
    window.dispatchEvent(new CustomEvent(PI_GLASS_SHELL_CHANGED_EVENT));
    return true;
  } catch {
    await Promise.all([usePiStore.getState().refreshCfg(), usePiStore.getState().refreshSums()]);
    return false;
  }
}
