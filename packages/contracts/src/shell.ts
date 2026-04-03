import type { EditorId } from "./editor";

export interface ShellState {
  cwd: string;
  name: string;
  availableEditors: EditorId[];
}

export type ShellFileKind = "file" | "dir" | "image";

export interface ShellFileHit {
  path: string;
  name: string;
  kind: ShellFileKind;
}

export interface ShellPickedFile {
  path: string;
  name: string;
  kind: Exclude<ShellFileKind, "dir">;
  size: number;
  mimeType: string | null;
}

export interface ShellFilePreview {
  path: string;
  kind: "text" | "image";
  text?: string;
  truncated?: boolean;
  mimeType?: string | null;
  data?: string;
}

export interface ShellBridge {
  getState: () => Promise<ShellState>;
  pickWorkspace: () => Promise<ShellState | null>;
  setWorkspace: (cwd: string) => Promise<ShellState>;
  openInEditor: (path: string, editor: EditorId) => Promise<void>;
  openExternal: (url: string) => Promise<boolean>;
  suggestFiles: (query: string) => Promise<ShellFileHit[]>;
  previewFile: (path: string) => Promise<ShellFilePreview | null>;
  pickFiles: () => Promise<ShellPickedFile[]>;
  inspectFiles: (paths: string[]) => Promise<ShellPickedFile[]>;
}
