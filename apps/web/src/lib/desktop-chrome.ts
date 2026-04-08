import { MACOS_TRAFFIC_LIGHTS } from "@glass/shared/desktopChrome";

import { isElectronHost } from "../env";

const INSET = "--glass-electron-traffic-inset";
const TOP = "--glass-electron-traffic-padding-top";

export function applyDesktopChromeMetrics() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!isElectronHost()) {
    root.style.removeProperty(INSET);
    root.style.removeProperty(TOP);
    return;
  }
  root.style.setProperty(INSET, `${MACOS_TRAFFIC_LIGHTS.spacerWidth}px`);
  root.style.setProperty(TOP, `${MACOS_TRAFFIC_LIGHTS.paddingTop}px`);
}
