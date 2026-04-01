import type { AgentMessage } from "@mariozechner/pi-agent-core";

export function shouldPersistSession(messages: AgentMessage[]): boolean {
  const hasUser = messages.some(
    (m) => m.role === "user" || (m as { role?: string }).role === "user-with-attachments",
  );
  const hasAssistant = messages.some((m) => m.role === "assistant");
  return hasUser && hasAssistant;
}

export function titleFromMessages(messages: AgentMessage[]): string {
  const first = messages.find(
    (m) => m.role === "user" || (m as { role?: string }).role === "user-with-attachments",
  );
  if (!first) return "";

  let text = "";
  const content = (first as { content?: unknown }).content;
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .filter((c): c is { type: string; text?: string } => (c as { type?: string }).type === "text")
      .map((c) => c.text ?? "")
      .join(" ");
  }

  text = text.trim();
  if (!text) return "";

  const end = text.search(/[.!?]/);
  if (end > 0 && end <= 50) return text.substring(0, end + 1);
  return text.length <= 50 ? text : `${text.substring(0, 47)}...`;
}
