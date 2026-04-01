import type { DesktopBridge } from "./desktop";
import type { PiBridge } from "./pi";
import type { SessionBridge } from "./session";
import type { ShellBridge } from "./shell";

export interface GlassBridge {
  session: SessionBridge;
  pi: PiBridge;
  shell: ShellBridge;
  desktop: DesktopBridge;
}
