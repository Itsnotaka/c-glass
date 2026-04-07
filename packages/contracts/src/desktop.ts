import type { PiConfig } from "./pi";
import type { GlassAskState, GlassSessionSnapshot, GlassSessionSummary } from "./session";
import type { ShellState } from "./shell";
import type { ThreadSnapshot, ThreadSummary } from "./thread";

export interface ContextMenuItem<T extends string = string> {
  id: T;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
}

export type DesktopUpdateStatus =
  | "disabled"
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

export type DesktopRuntimeArch = "arm64" | "x64" | "other";
export type DesktopTheme = "light" | "dark" | "system";

export interface DesktopRuntimeInfo {
  hostArch: DesktopRuntimeArch;
  appArch: DesktopRuntimeArch;
  runningUnderArm64Translation: boolean;
}

export interface DesktopUpdateState {
  enabled: boolean;
  status: DesktopUpdateStatus;
  currentVersion: string;
  hostArch: DesktopRuntimeArch;
  appArch: DesktopRuntimeArch;
  runningUnderArm64Translation: boolean;
  availableVersion: string | null;
  downloadedVersion: string | null;
  downloadPercent: number | null;
  checkedAt: string | null;
  message: string | null;
  errorContext: "check" | "download" | "install" | null;
  canRetry: boolean;
}

export interface DesktopUpdateActionResult {
  accepted: boolean;
  completed: boolean;
  state: DesktopUpdateState;
}

export interface DesktopUpdateCheckResult {
  checked: boolean;
  state: DesktopUpdateState;
}

export type DesktopExtUiReq =
  | {
      id: string;
      type: "select";
      title: string;
      options: string[];
      timeout?: number;
    }
  | {
      id: string;
      type: "confirm";
      title: string;
      message: string;
      timeout?: number;
    }
  | {
      id: string;
      type: "input";
      title: string;
      placeholder?: string;
      timeout?: number;
    }
  | {
      id: string;
      type: "editor";
      title: string;
      prefill?: string;
      timeout?: number;
    }
  | {
      id: string;
      type: "get-editor";
    };

export interface DesktopExtUiReply {
  id: string;
  cancelled?: boolean;
  value?: string | boolean;
}

export interface DesktopBootSnapshot {
  electron: boolean;
  shell: ShellState | null;
  pi: PiConfig | null;
  sessions: GlassSessionSummary[];
  snapshots: Record<string, GlassSessionSnapshot>;
  asks: Record<string, GlassAskState>;
  threads: ThreadSummary[];
  threadSnaps: Record<string, ThreadSnapshot>;
}

export interface DesktopBridge {
  confirm: (message: string) => Promise<boolean>;
  /** Desktop preload: canonical boot snapshot fetched before first paint. */
  readBootSnapshot?: () => DesktopBootSnapshot | null;
  /** Desktop: runs in the renderer when Pi or workspace boot state changes. */
  onBootRefresh?: (cb: () => void) => () => void;
  setTheme: (theme: DesktopTheme) => Promise<void>;
  setVibrancy: (enabled: boolean) => Promise<void>;
  showContextMenu: <T extends string>(
    items: readonly ContextMenuItem<T>[],
    position?: { x: number; y: number },
  ) => Promise<T | null>;
  onMenuAction: (listener: (action: string) => void) => () => void;
  /** Internal renderer bridge for built-in global extension UI prompts. */
  onExtensionUiRequest?: (listener: (req: DesktopExtUiReq) => void) => () => void;
  /** Internal renderer bridge for built-in global extension notifications. */
  onExtensionUiNotify?: (
    listener: (payload: { message: string; type: "info" | "warning" | "error" }) => void,
  ) => () => void;
  /** Internal renderer bridge for built-in global extension editor seeding. */
  onExtensionSetEditor?: (listener: (payload: { text: string }) => void) => () => void;
  /** Internal renderer bridge reply path for extension UI prompts. */
  replyExtensionUi?: (reply: DesktopExtUiReply) => Promise<void>;
  /** Sync composer draft to main so extension `getEditorText()` matches the Glass UI. */
  setComposerDraft?: (text: string) => void;
  getUpdateState: () => Promise<DesktopUpdateState>;
  checkForUpdate: () => Promise<DesktopUpdateCheckResult>;
  downloadUpdate: () => Promise<DesktopUpdateActionResult>;
  installUpdate: () => Promise<DesktopUpdateActionResult>;
  onUpdateState: (listener: (state: DesktopUpdateState) => void) => () => void;
}
