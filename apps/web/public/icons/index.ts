// Editor Icons - Official brand assets
// See README.md in this directory for licensing information

// Icon metadata type
export interface EditorIcon {
  id: string;
  name: string;
  brandUrl: string;
  svg: string;
  png?: string;
}

// Cursor Editor
export const cursor: EditorIcon = {
  id: "cursor",
  name: "Cursor",
  brandUrl: "https://cursor.com",
  svg: "/icons/cursor/cursor.svg",
  png: "/icons/cursor/cursor.png",
};

// Cursor variants
export const cursorVariants = {
  "2dLight": "/icons/cursor/variants/cursor-2d-light.svg",
  "2dDark": "/icons/cursor/variants/cursor-2d-dark.svg",
  "25d": "/icons/cursor/variants/cursor-25d.svg",
} as const;

// VS Code
export const vscode: EditorIcon = {
  id: "vscode",
  name: "VS Code",
  brandUrl: "https://code.visualstudio.com",
  svg: "/icons/vscode/vscode.svg",
};

// Zed
export const zed: EditorIcon = {
  id: "zed",
  name: "Zed",
  brandUrl: "https://zed.dev",
  svg: "/icons/zed/zed.svg",
};

// All editors collection
export const editorIcons = {
  cursor,
  vscode,
  zed,
} as const;

// All editor icons as array - use this directly instead of a helper function
export const allEditorIcons: EditorIcon[] = Object.values(editorIcons);
