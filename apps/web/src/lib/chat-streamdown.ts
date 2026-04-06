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

/** Canonical root classes for assistant / tool-rail markdown (see `styles/chat-markdown.css`). */
export const chatMarkdownThreadClassName = "font-glass chat-markdown text-body/5 text-foreground";

export const chatMarkdownToolClassName =
  "font-glass-mono chat-markdown text-detail/[1.4] text-foreground";
