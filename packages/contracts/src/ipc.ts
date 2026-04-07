import type { DesktopBridge } from "./desktop";
import type { GitBridge } from "./git";
import type { HarnessRegistryBridge } from "./harness";
import type { PiBridge } from "./pi";
import type { SessionBridge } from "./session";
import type { ShellBridge } from "./shell";
import type { ThreadBridge } from "./thread";

export interface GlassBridge {
  session: SessionBridge;
  thread: ThreadBridge;
  harness: HarnessRegistryBridge;
  pi: PiBridge;
  shell: ShellBridge;
  git: GitBridge;
  desktop: DesktopBridge;
}
