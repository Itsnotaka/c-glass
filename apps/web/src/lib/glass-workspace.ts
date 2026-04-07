import { readGlass } from "../host";
import { GLASS_SHELL_CHANGED_EVENT } from "./glass-runtime-constants";
import { useThreadSessionStore } from "./thread-session-store";

export async function pickWorkspace() {
  const glass = readGlass();
  if (!glass) return null;

  try {
    const next = await glass.shell.pickWorkspace();
    if (!next) return null;
    window.dispatchEvent(new CustomEvent(GLASS_SHELL_CHANGED_EVENT));
    return next;
  } catch {
    await Promise.all([
      useThreadSessionStore.getState().refreshCfg(),
      useThreadSessionStore.getState().refreshSums(),
    ]);
    return null;
  }
}

export async function switchWorkspace(cwd: string) {
  const glass = readGlass();
  if (!glass) return false;

  try {
    await glass.shell.setWorkspace(cwd);
    window.dispatchEvent(new CustomEvent(GLASS_SHELL_CHANGED_EVENT));
    return true;
  } catch {
    await Promise.all([
      useThreadSessionStore.getState().refreshCfg(),
      useThreadSessionStore.getState().refreshSums(),
    ]);
    return false;
  }
}
