import type { EditorId } from "./editor";

export interface ShellState {
  cwd: string;
  name: string;
  availableEditors: EditorId[];
}

export interface ShellBridge {
  getState: () => Promise<ShellState>;
  pickWorkspace: () => Promise<ShellState | null>;
  openInEditor: (path: string, editor: EditorId) => Promise<void>;
  openExternal: (url: string) => Promise<boolean>;
}
