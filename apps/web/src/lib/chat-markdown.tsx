import { Streamdown, type StreamdownProps } from "streamdown";
import {
  chatMarkdownThreadClassName,
  chatMarkdownToolClassName,
  chatStreamdownControls,
  chatStreamdownPlugins,
  chatStreamdownShikiTheme,
} from "./chat-streamdown";
import { cn } from "./utils";

export type ChatMarkdownProps = Omit<StreamdownProps, "controls" | "plugins" | "shikiTheme"> & {
  variant?: "thread" | "tool";
};

/**
 * Single entry point for Streamdown in Glass: `.chat-markdown` styling, shared Shiki theme, controls.
 */
export function ChatMarkdown(props: ChatMarkdownProps) {
  const { variant = "thread", className, dir = "auto", lineNumbers = false, ...rest } = props;
  const base = variant === "tool" ? chatMarkdownToolClassName : chatMarkdownThreadClassName;
  return (
    <Streamdown
      className={cn(base, className)}
      controls={chatStreamdownControls}
      dir={dir}
      lineNumbers={lineNumbers}
      plugins={chatStreamdownPlugins}
      shikiTheme={chatStreamdownShikiTheme}
      {...rest}
    />
  );
}
