import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ImageContent, Message, TextContent } from "@mariozechner/pi-ai";

type PiAttachment = {
  type: string;
  content?: string;
  mimeType?: string;
  fileName?: string;
  extractedText?: string;
};

function convertAttachments(attachments: PiAttachment[]): (TextContent | ImageContent)[] {
  const blocks: (TextContent | ImageContent)[] = [];
  for (const a of attachments) {
    if (a.type === "image" && a.content && a.mimeType) {
      blocks.push({ type: "image", data: a.content, mimeType: a.mimeType });
    }
    if (a.type === "document" && a.extractedText) {
      blocks.push({
        type: "text",
        text: `\n\n[Document: ${a.fileName ?? "file"}]\n${a.extractedText}`,
      });
    }
  }
  return blocks;
}

function isArtifact(msg: AgentMessage): boolean {
  return (msg as { role?: string }).role === "artifact";
}

function isUserWithAttachments(msg: AgentMessage): boolean {
  return (msg as { role?: string }).role === "user-with-attachments";
}

export function convertToLlm(messages: AgentMessage[]): Message[] {
  return messages
    .filter((m) => !isArtifact(m))
    .map((m) => {
      if (isUserWithAttachments(m)) {
        const u = m as {
          content: string | (TextContent | ImageContent)[];
          timestamp: number;
          attachments?: PiAttachment[];
        };
        const text =
          typeof u.content === "string"
            ? [{ type: "text" as const, text: u.content }]
            : [...u.content];
        if (u.attachments?.length) {
          text.push(...convertAttachments(u.attachments));
        }
        return { role: "user" as const, content: text, timestamp: u.timestamp };
      }
      if (m.role === "user" || m.role === "assistant" || m.role === "toolResult") {
        return m;
      }
      return null;
    })
    .filter((m): m is Message => m !== null);
}
