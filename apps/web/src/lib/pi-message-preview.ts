import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { TextContent, ThinkingContent, ToolCall } from "@mariozechner/pi-ai";

function textFromBlocks(blocks: (TextContent | ThinkingContent | ToolCall)[]): string {
  return blocks
    .flatMap((b) => {
      if (b.type === "text") return [b.text];
      if (b.type === "thinking") return [b.thinking];
      if (b.type === "toolCall") return [`[${b.name}]`];
      return [];
    })
    .join("");
}

export function previewAgentMessage(m: AgentMessage): string {
  if (m.role === "user") {
    const c = m.content;
    if (typeof c === "string") return c;
    return c
      .filter((x): x is TextContent => x.type === "text")
      .map((x) => x.text)
      .join("");
  }
  if (m.role === "assistant") {
    const body = textFromBlocks(m.content);
    if (m.errorMessage) return `${body}\n(${m.errorMessage})`;
    return body;
  }
  if (m.role === "toolResult") {
    return (
      m.content
        .filter((x): x is TextContent => x.type === "text")
        .map((x) => x.text)
        .join("") || `[${m.toolName}]`
    );
  }
  if ((m as { role?: string }).role === "user-with-attachments") {
    const u = m as { content: string | TextContent[] };
    if (typeof u.content === "string") return u.content;
    return u.content
      .filter((x): x is TextContent => x.type === "text")
      .map((x) => x.text)
      .join("");
  }
  return "";
}
