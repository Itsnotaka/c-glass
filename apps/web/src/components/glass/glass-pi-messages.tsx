import type { AgentMessage } from "@mariozechner/pi-agent-core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { previewAgentMessage } from "../../lib/pi-message-preview";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";

function HumanBubble(props: { text: string }) {
  return (
    <li className="flex justify-end">
      <div className="max-w-[min(100%,36rem)] rounded-2xl bg-glass-sidebar-active px-3.5 py-2 text-[13px] text-foreground">
        {props.text}
      </div>
    </li>
  );
}

function AssistantBlock(props: { text: string | null }) {
  if (!props.text) {
    return (
      <li className="py-1">
        <span className="text-[13px] text-muted-foreground">...</span>
      </li>
    );
  }
  return (
    <li className="py-1">
      <div className="chat-markdown text-[13px]/5 text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{props.text}</ReactMarkdown>
      </div>
    </li>
  );
}

function ToolBlock(props: { text: string | null; error: boolean }) {
  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2 font-mono text-xs",
        props.error
          ? "border-destructive/30 bg-destructive/5 text-destructive-foreground"
          : "border-glass-panel-border bg-muted/20 text-muted-foreground",
      )}
    >
      {props.text}
    </li>
  );
}

export function GlassPiMessages(props: { messages: AgentMessage[] }) {
  return (
    <ScrollArea className="min-h-0 flex-1" scrollFade scrollbarGutter>
      <ul className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4 md:px-8">
        {props.messages.map((m, i) => {
          const key = String(i);
          if (m.role === "assistant") {
            return <AssistantBlock key={key} text={previewAgentMessage(m)} />;
          }
          if (m.role === "toolResult") {
            return <ToolBlock key={key} text={previewAgentMessage(m)} error={Boolean(m.isError)} />;
          }
          return <HumanBubble key={key} text={previewAgentMessage(m) ?? ""} />;
        })}
      </ul>
    </ScrollArea>
  );
}
