import type { GlassBlock, GlassMessage } from "@glass/contracts";

const tag = /<file\s+name="([^"]+)"\s*>([\s\S]*?)<\/file>/g;

function clean(text: string) {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parts(text: string) {
  const files = [] as string[];
  let body = "";
  let last = 0;

  for (const hit of text.matchAll(tag)) {
    const pos = hit.index ?? 0;
    body += text.slice(last, pos);
    last = pos + hit[0].length;
    files.push(hit[1] ?? "");
  }

  body += text.slice(last);
  return {
    text: clean(body),
    files: files.map((item) => item.split(/[\\/]/).at(-1) ?? item),
  };
}

function text(blocks: readonly GlassBlock[]) {
  const out = blocks.reduce(
    (state, item) => {
      if (item.type === "text") {
        const next = parts(typeof item.text === "string" ? item.text : "");
        return {
          text: `${state.text}${state.text && next.text ? "\n" : ""}${next.text}`,
          files: [...state.files, ...next.files],
          imgs: state.imgs,
        };
      }
      if (item.type === "thinking") {
        return {
          text: `${state.text}${state.text ? "\n" : ""}${typeof item.thinking === "string" ? item.thinking : ""}`,
          files: state.files,
          imgs: state.imgs,
        };
      }
      if (item.type === "toolCall") {
        return {
          text: `${state.text}${state.text ? "\n" : ""}[${typeof item.name === "string" ? item.name : "tool"}]`,
          files: state.files,
          imgs: state.imgs,
        };
      }
      if (item.type === "image") {
        return { text: state.text, files: state.files, imgs: state.imgs + 1 };
      }
      return {
        text: `${state.text}${state.text ? "\n" : ""}[${item.type}]`,
        files: state.files,
        imgs: state.imgs,
      };
    },
    { text: "", files: [] as string[], imgs: 0 },
  );

  const more = Math.max(0, out.imgs - out.files.length);
  return [
    out.text,
    ...out.files.map((item) => `[${item}]`),
    ...Array.from({ length: more }, () => "[image]"),
  ]
    .filter(Boolean)
    .join("\n");
}

export function previewAgentMessage(message: GlassMessage) {
  if (message.role === "user" || message.role === "user-with-attachments") {
    if (typeof message.content === "string") {
      const out = parts(message.content);
      return [out.text, ...out.files.map((item) => `[${item}]`)].filter(Boolean).join("\n");
    }
    if (Array.isArray(message.content)) return text(message.content as readonly GlassBlock[]);
    return "";
  }
  if (message.role === "assistant") {
    const body = Array.isArray(message.content)
      ? text(message.content as readonly GlassBlock[])
      : "";
    if (typeof message.errorMessage === "string" && message.errorMessage.trim()) {
      return `${body}${body ? "\n" : ""}(${message.errorMessage})`;
    }
    return body;
  }
  if (message.role === "toolResult") {
    const body = Array.isArray(message.content)
      ? text(message.content as readonly GlassBlock[])
      : "";
    if (body) return body;
    return typeof message.toolName === "string" ? `[${message.toolName}]` : "";
  }
  if (message.role === "system") {
    if (typeof message.content === "string") {
      return parts(message.content).text;
    }
    if (Array.isArray(message.content)) return text(message.content as readonly GlassBlock[]);
    return "";
  }
  return "";
}
