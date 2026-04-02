import type { PiMessage, PiToolCallBlock } from "@glass/contracts";
import { Collapsible } from "@base-ui/react/collapsible";
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import { ChevronRightIcon, TerminalIcon, WrenchIcon } from "lucide-react";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { buildPiRows, type PiRow } from "../../lib/pi-chat-timeline";
import { cn } from "../../lib/utils";
import { ScrollArea } from "../ui/scroll-area";

function clip(text: string) {
  const prep = prepareWithSegments(text, "12px ui-monospace", { whiteSpace: "pre-wrap" });
  const out = layoutWithLines(prep, 640, 20);
  if (out.lines.length <= 8) return text;
  return `${out.lines
    .slice(0, 8)
    .map((line) => line.text)
    .join("\n")}\n...`;
}

function first(call: PiToolCallBlock | null) {
  const args = call?.arguments;
  if (!args || typeof args !== "object") {
    if (typeof args === "string" && args.trim()) return args.trim().slice(0, 72);
    return null;
  }

  for (const key of ["command", "path", "query", "file", "url", "prompt", "target"]) {
    const val = (args as Record<string, unknown>)[key];
    if (typeof val === "string" && val.trim()) return val.trim().slice(0, 72);
  }

  const keys = Object.keys(args as Record<string, unknown>);
  if (keys.length === 0) return null;
  return `${keys.length} prop${keys.length === 1 ? "" : "s"}`;
}

function meta(row: PiRow) {
  if (row.kind === "tool") {
    if (row.error) return "errored";
    if (row.result.trim()) return "returned output";
    return "waiting";
  }
  if (row.kind === "bash") {
    if (row.cancelled) return "cancelled";
    if (row.code === null) return "exit unknown";
    return `exit ${row.code}`;
  }
  return null;
}

const HumanBubble = memo(function HumanBubble(props: { text: string }) {
  return (
    <li className="flex justify-end">
      <div className="max-w-[min(100%,36rem)] rounded-2xl bg-glass-active px-3.5 py-2 text-[13px]/5 text-foreground shadow-glass-card backdrop-blur-sm">
        {props.text}
      </div>
    </li>
  );
});

const AssistantBlock = memo(function AssistantBlock(props: { text: string }) {
  return (
    <li className="py-1">
      <div className="font-glass chat-markdown text-[13px]/5 text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{props.text}</ReactMarkdown>
      </div>
    </li>
  );
});

const Section = memo(function Section(props: {
  label: string;
  text: string;
  error?: boolean | undefined;
}) {
  if (!props.text.trim()) return null;

  return (
    <div
      className={cn(
        "rounded border px-2 py-1.5",
        props.error
          ? "border-destructive/25 bg-destructive/5"
          : "border-glass-border/50 bg-glass-hover/20",
      )}
    >
      <div className="mb-0.5 text-[11px]/4 font-medium tracking-[0.08em] text-muted-foreground/70 uppercase">
        {props.label}
      </div>
      <pre className="font-glass-mono whitespace-pre-wrap text-[11px]/4 text-foreground/82">
        {props.text}
      </pre>
    </div>
  );
});

const ToolCard = memo(function ToolCard(props: {
  row: Extract<PiRow, { kind: "tool" }>;
  expanded: boolean;
  onFlip: () => void;
}) {
  const txt = useMemo(
    () => clip(props.row.result || props.row.args || ""),
    [props.row.args, props.row.result],
  );
  const sum = first(props.row.call);
  const info = meta(props.row);

  return (
    <li className="relative bg-glass-editor">
      <Collapsible.Root open={props.expanded}>
        <Collapsible.Trigger
          onClick={props.onFlip}
          className="flex h-7 w-full cursor-pointer items-center gap-2 px-[6px] text-left hover:bg-glass-hover"
        >
          <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground/70">
            <WrenchIcon className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px]/4 text-foreground/82">
            {props.row.name}
          </span>
          {sum ? (
            <span className="truncate text-[11px] text-muted-foreground/70">{sum}</span>
          ) : null}
          {info ? (
            <span className="shrink-0 text-[11px] text-muted-foreground/70">{info}</span>
          ) : null}
          <ChevronRightIcon
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground/70 transition-transform",
              props.expanded && "rotate-90",
            )}
          />
        </Collapsible.Trigger>
        {props.expanded ? (
          <Collapsible.Panel className="px-[6px] py-1">
            <Section label="Props" text={props.row.args} />
            <Section label="Output" text={props.row.result} error={props.row.error} />
          </Collapsible.Panel>
        ) : txt ? (
          <div className="px-[6px] py-1">
            <Section label="Preview" text={txt} error={props.row.error} />
          </div>
        ) : null}
      </Collapsible.Root>
    </li>
  );
});

const BashCard = memo(function BashCard(props: {
  row: Extract<PiRow, { kind: "bash" }>;
  expanded: boolean;
  onFlip: () => void;
}) {
  const info = meta(props.row);
  const txt = useMemo(
    () => clip(props.row.output || props.row.command),
    [props.row.command, props.row.output],
  );

  return (
    <li className="relative bg-glass-editor">
      <Collapsible.Root open={props.expanded}>
        <Collapsible.Trigger
          onClick={props.onFlip}
          className="flex h-7 w-full cursor-pointer items-center gap-2 px-[6px] text-left hover:bg-glass-hover"
        >
          <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground/70">
            <TerminalIcon className="size-3.5" />
          </span>
          <span className="truncate text-[13px]/4 text-foreground/82">Ran command</span>
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground/70">
            {props.row.command}
          </span>
          {info ? (
            <span className="shrink-0 text-[11px] text-muted-foreground/70">{info}</span>
          ) : null}
          <ChevronRightIcon
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground/70 transition-transform",
              props.expanded && "rotate-90",
            )}
          />
        </Collapsible.Trigger>
        {props.expanded ? (
          <Collapsible.Panel className="px-[6px] py-1">
            <Section label="Command" text={props.row.command} />
            <Section
              label="Output"
              text={`${props.row.output}${props.row.truncated ? "\n\n[truncated]" : ""}`}
              error={props.row.code !== null && props.row.code !== 0}
            />
            {props.row.path ? <Section label="Full output path" text={props.row.path} /> : null}
          </Collapsible.Panel>
        ) : txt ? (
          <div className="px-[6px] py-1">
            <Section
              label="Preview"
              text={txt}
              error={props.row.code !== null && props.row.code !== 0}
            />
          </div>
        ) : null}
      </Collapsible.Root>
    </li>
  );
});

const TextCard = memo(function TextCard(props: {
  label: string;
  text: string;
  expanded: boolean;
  onFlip: () => void;
  error?: boolean;
}) {
  const txt = useMemo(() => clip(props.text), [props.text]);

  return (
    <li className="relative bg-glass-editor">
      <Collapsible.Root open={props.expanded}>
        <Collapsible.Trigger
          onClick={props.onFlip}
          className="flex h-7 w-full cursor-pointer items-center gap-2 px-[6px] text-left hover:bg-glass-hover"
        >
          <span className="min-w-0 flex-1 truncate text-[13px]/4 text-foreground/82">
            {props.label}
          </span>
          <ChevronRightIcon
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground/70 transition-transform",
              props.expanded && "rotate-90",
            )}
          />
        </Collapsible.Trigger>
        {props.expanded ? (
          <Collapsible.Panel className="px-[6px] py-1">
            <Section label={props.label} text={props.text} error={props.error} />
          </Collapsible.Panel>
        ) : txt ? (
          <div className="px-[6px] py-1">
            <Section label="Preview" text={txt} error={props.error} />
          </div>
        ) : null}
      </Collapsible.Root>
    </li>
  );
});

export const GlassPiMessages = memo(function GlassPiMessages(props: {
  messages: PiMessage[];
  expanded: boolean;
  onFlip: () => void;
}) {
  const rows = useMemo(() => buildPiRows(props.messages), [props.messages]);

  return (
    <ScrollArea className="min-h-0 flex-1" scrollFade scrollbarGutter>
      <ul className="mx-auto flex max-w-[44rem] flex-col gap-4 px-4 py-4 md:px-8">
        {rows.map((row, i) => {
          const key = String(i);

          if (row.kind === "user") {
            return <HumanBubble key={key} text={row.text || ""} />;
          }

          if (row.kind === "assistant") {
            return <AssistantBlock key={key} text={row.text} />;
          }

          if (row.kind === "tool") {
            return <ToolCard key={key} row={row} expanded={props.expanded} onFlip={props.onFlip} />;
          }

          if (row.kind === "bash") {
            return <BashCard key={key} row={row} expanded={props.expanded} onFlip={props.onFlip} />;
          }

          if (row.kind === "custom") {
            return (
              <TextCard
                key={key}
                label={row.name}
                text={row.text}
                expanded={props.expanded}
                onFlip={props.onFlip}
              />
            );
          }

          if (row.kind === "compaction") {
            return (
              <TextCard
                key={key}
                label="Compaction"
                text={`Compacted from ${row.tokens.toLocaleString()} tokens\n\n${row.summary}`}
                expanded={props.expanded}
                onFlip={props.onFlip}
              />
            );
          }

          if (row.kind === "branch") {
            return (
              <TextCard
                key={key}
                label="Branch"
                text={row.summary}
                expanded={props.expanded}
                onFlip={props.onFlip}
              />
            );
          }

          if (row.kind === "system") {
            return (
              <TextCard
                key={key}
                label="System"
                text={row.text}
                expanded={props.expanded}
                onFlip={props.onFlip}
              />
            );
          }

          return (
            <TextCard
              key={key}
              label={row.role}
              text={row.text}
              expanded={props.expanded}
              onFlip={props.onFlip}
            />
          );
        })}
      </ul>
    </ScrollArea>
  );
});
