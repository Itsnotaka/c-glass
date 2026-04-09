import { MACOS_TRAFFIC_LIGHTS, TITLEBAR_CONTROL_OFFSET_TOP_PX } from "@glass/shared/desktop-chrome";

import { isElectronHost } from "../env";

const INSET = "--glass-electron-traffic-inset";
const TOP = "--glass-electron-traffic-padding-top";
const ROW_TOP = "--glass-titlebar-control-row-top";

export function applyDesktopChromeMetrics() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!isElectronHost()) {
    root.style.removeProperty(INSET);
    root.style.removeProperty(TOP);
    root.style.removeProperty(ROW_TOP);
    return;
  }
  root.style.setProperty(INSET, `${MACOS_TRAFFIC_LIGHTS.spacerWidth}px`);
  root.style.setProperty(TOP, `${MACOS_TRAFFIC_LIGHTS.paddingTop}px`);
  root.style.setProperty(ROW_TOP, `${TITLEBAR_CONTROL_OFFSET_TOP_PX}px`);
}
