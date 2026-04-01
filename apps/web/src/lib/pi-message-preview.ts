import type { PiBlock, PiMessage } from "@glass/contracts";

function text(blocks: readonly PiBlock[]) {
  return blocks
    .flatMap((item) => {
      if (item.type === "text") return [item.text];
      if (item.type === "thinking") return [item.thinking];
      if (item.type === "toolCall") return [`[${item.name}]`];
      return [];
    })
    .join("");
}

export function previewAgentMessage(message: PiMessage) {
  if (message.role === "user" || message.role === "user-with-attachments") {
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) return text(message.content);
    return "";
  }
  if (message.role === "assistant") {
    const body = Array.isArray(message.content) ? text(message.content) : "";
    if (typeof message.errorMessage === "string" && message.errorMessage.trim()) {
      return `${body}\n(${message.errorMessage})`;
    }
    return body;
  }
  if (message.role === "toolResult") {
    const body = Array.isArray(message.content) ? text(message.content) : "";
    if (body) return body;
    return typeof message.toolName === "string" ? `[${message.toolName}]` : "";
  }
  if (message.role === "system") {
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) return text(message.content);
    return "";
  }
  return "";
}
