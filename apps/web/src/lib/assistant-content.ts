import type { GlassBlock } from "@glass/contracts";

import type { ChatMessage } from "../types";

function hasText(text: string) {
  return text.trim().length > 0;
}

function hasThinking(block: NonNullable<ChatMessage["content"]>[number]) {
  if (block.type !== "thinking") {
    return false;
  }
  return hasText(block.thinking) || hasText(block.summary ?? "");
}

export function assistantBlocks(message: Pick<ChatMessage, "text" | "content">): GlassBlock[] {
  if (!message.content || message.content.length === 0) {
    return message.text.length > 0 ? [{ type: "text", text: message.text }] : [];
  }

  let rest = message.text;
  const out: GlassBlock[] = [];

  for (const block of message.content) {
    if (block.type === "thinking") {
      if (!hasThinking(block)) {
        continue;
      }
      out.push({
        type: "thinking",
        thinking: block.thinking,
        ...(block.summary !== undefined ? { summary: block.summary } : {}),
      });
      continue;
    }

    if (block.type !== "text") {
      continue;
    }

    const size = Math.min(rest.length, block.text.length);
    if (size <= 0) {
      continue;
    }
    out.push({
      type: "text",
      text: rest.slice(0, size),
    });
    rest = rest.slice(size);
  }

  if (rest.length > 0) {
    out.push({ type: "text", text: rest });
  }

  return out;
}

export function hasStreamingThinking(
  messages: ReadonlyArray<Pick<ChatMessage, "role" | "streaming" | "content">>,
) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "assistant" || !message.streaming) {
      continue;
    }
    return Boolean(message.content?.some(hasThinking));
  }
  return false;
}
