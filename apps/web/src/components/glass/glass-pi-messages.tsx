import type { PiMessage } from "@glass/contracts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { previewAgentMessage } from "../../lib/pi-message-preview";
import { cn } from "../../lib/utils";
import { ScrollArea } from "../ui/scroll-area";

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

export function GlassPiMessages(props: { messages: PiMessage[] }) {
  return (
    <ScrollArea className="min-h-0 flex-1" scrollFade scrollbarGutter>
      <ul className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4 md:px-8">
        {props.messages.map((message, index) => {
          const id = String(index);
          if (message.role === "assistant") {
            return <AssistantBlock key={id} text={previewAgentMessage(message)} />;
          }
          if (message.role === "toolResult") {
            return (
              <ToolBlock
                key={id}
                text={previewAgentMessage(message)}
                error={Boolean(message.isError)}
              />
            );
          }
          return <HumanBubble key={id} text={previewAgentMessage(message) || ""} />;
        })}
      </ul>
    </ScrollArea>
  );
}
