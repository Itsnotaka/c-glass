import { code } from "@streamdown/code";
import type { BundledTheme } from "streamdown";

export const chatStreamdownPlugins = { code };

export const chatStreamdownControls = {
  code: { copy: true, download: false },
  mermaid: false,
  table: true,
} as const;

/** Light / dark syntax themes; layout colors come from `.chat-markdown` VS Code token bridge. */
export const chatStreamdownShikiTheme: [BundledTheme, BundledTheme] = [
  "github-light",
  "github-dark",
];
