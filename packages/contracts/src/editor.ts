import { Schema } from "effect";
import { TrimmedNonEmptyString } from "./baseSchemas";

export const EDITORS = [
  { id: "cursor", label: "Cursor", command: "cursor", app: "Cursor", supportsGoto: true },
  {
    id: "vscode",
    label: "VS Code",
    command: "code",
    app: "Visual Studio Code",
    supportsGoto: true,
  },
  {
    id: "vscode-insiders",
    label: "VS Code Insiders",
    command: "code-insiders",
    app: "Visual Studio Code - Insiders",
    supportsGoto: true,
  },
  {
    id: "vscodium",
    label: "VSCodium",
    command: "codium",
    app: "VSCodium",
    supportsGoto: true,
  },
  { id: "zed", label: "Zed", command: "zed", app: "Zed", supportsGoto: false },
  {
    id: "antigravity",
    label: "Antigravity",
    command: "agy",
    app: "Antigravity",
    supportsGoto: false,
  },
  { id: "file-manager", label: "File Manager", command: null, app: null, supportsGoto: false },
] as const;

export const EditorId = Schema.Literals(EDITORS.map((e) => e.id));
export type EditorId = typeof EditorId.Type;

export const OpenInEditorInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  editor: EditorId,
});
export type OpenInEditorInput = typeof OpenInEditorInput.Type;
