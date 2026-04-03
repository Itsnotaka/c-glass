import type { PiSessionItem } from "@glass/contracts";
import { Collapsible } from "@base-ui/react/collapsible";
import { code } from "@streamdown/code";
import {
  IconChevronBottom,
  IconCircleCheck,
  IconCircleX,
  IconConsole,
  IconFileBend,
  IconImages1,
  IconLoader,
  IconToolbox,
} from "central-icons";
import type React from "react";
import { memo, useEffect, useMemo, useRef } from "react";
import { Streamdown } from "streamdown";
import { buildPiRows, type PiRow, type PiUserAttachment } from "../../lib/pi-chat-timeline";
import { cn } from "../../lib/utils";
import { ScrollArea } from "../ui/scroll-area";

const plugins = { code };

const controls = {
  code: { copy: true, download: false },
  mermaid: false,
  table: false,
} as const;

type ToolState = "pending" | "running" | "completed" | "errored";

function state(row: PiRow): ToolState {
  if (row.kind === "tool") {
    if (row.error) return "errored";
    if (row.result.trim()) return "completed";
    if (row.args.trim()) return "running";
    return "pending";
  }
  if (row.kind === "bash") {
    if (row.cancelled) return "errored";
    if (row.code !== null && row.code !== 0) return "errored";
    if (row.output.trim() || row.code !== null) return "completed";
    return "running";
  }
  return "completed";
}

const labels: Record<ToolState, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  errored: "Error",
};

function Badge(props: { state: ToolState }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px]/[1.2] font-medium",
        props.state === "pending" && "bg-muted-foreground/10 text-muted-foreground/70",
        props.state === "running" && "bg-info/10 text-info-foreground",
        props.state === "completed" && "bg-success/10 text-success-foreground",
        props.state === "errored" && "bg-destructive/10 text-destructive",
      )}
    >
      {props.state === "pending" && <IconLoader className="size-3 animate-spin" />}
      {props.state === "running" && <IconLoader className="size-3 animate-spin" />}
      {props.state === "completed" && <IconCircleCheck className="size-3" />}
      {props.state === "errored" && <IconCircleX className="size-3" />}
      {labels[props.state]}
    </span>
  );
}

function draw(row: PiRow, expanded: boolean, onFlip: () => void) {
  if (row.kind === "user") {
    return <HumanBubble key={row.id} text={row.text || ""} attachments={row.attachments} />;
  }

  if (row.kind === "assistant") {
    return <AssistantBlock key={row.id} text={row.text} />;
  }

  if (row.kind === "tool") {
    return <ToolCard key={row.id} row={row} expanded={expanded} onFlip={onFlip} />;
  }

  if (row.kind === "bash") {
    return <BashCard key={row.id} row={row} expanded={expanded} onFlip={onFlip} />;
  }

  if (row.kind === "custom") {
    return (
      <TextCard key={row.id} label={row.name} text={row.text} expanded={expanded} onFlip={onFlip} />
    );
  }

  if (row.kind === "compaction") {
    return (
      <TextCard
        key={row.id}
        label="Compaction"
        text={`Compacted from ${row.tokens.toLocaleString()} tokens\n\n${row.summary}`}
        expanded={expanded}
        onFlip={onFlip}
      />
    );
  }

  if (row.kind === "branch") {
    return (
      <TextCard
        key={row.id}
        label="Branch"
        text={row.summary}
        expanded={expanded}
        onFlip={onFlip}
      />
    );
  }

  if (row.kind === "system") {
    return (
      <TextCard key={row.id} label="System" text={row.text} expanded={expanded} onFlip={onFlip} />
    );
  }

  return (
    <TextCard key={row.id} label={row.role} text={row.text} expanded={expanded} onFlip={onFlip} />
  );
}

const AttachmentTile = memo(function AttachmentTile(props: { item: PiUserAttachment }) {
  if (props.item.kind === "image") {
    return (
      <div className="w-full overflow-hidden rounded-2xl border border-glass-border/45 bg-glass-bubble/70 shadow-glass-card backdrop-blur-sm sm:w-52">
        {props.item.data ? (
          <img
            alt={props.item.name}
            className="aspect-[4/3] w-full object-cover"
            src={`data:${props.item.mimeType ?? "image/png"};base64,${props.item.data}`}
          />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-glass-hover/20 text-muted-foreground/70">
            <IconImages1 className="size-7" />
          </div>
        )}
        <div className="flex flex-col gap-1 px-3 py-2">
          <div className="truncate text-[12px]/[1.2] font-medium text-foreground/85">
            {props.item.name}
          </div>
          {props.item.note ? (
            <div className="line-clamp-2 text-[11px]/[1.35] text-muted-foreground/80">
              {props.item.note}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-44 max-w-full items-start gap-2 rounded-2xl border border-glass-border/45 bg-glass-bubble/70 px-3 py-2 text-left shadow-glass-card backdrop-blur-sm sm:max-w-72">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-glass-hover/25 text-muted-foreground/75">
        <IconFileBend className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px]/[1.2] font-medium text-foreground/85">
          {props.item.name}
        </span>
        <span className="block truncate text-[11px]/[1.2] text-muted-foreground/75">
          {props.item.path}
        </span>
        {props.item.note ? (
          <span className="mt-1 line-clamp-2 block text-[11px]/[1.35] text-muted-foreground/75">
            {props.item.note}
          </span>
        ) : null}
      </span>
    </div>
  );
});

const HumanBubble = memo(function HumanBubble(props: {
  text: string;
  attachments: PiUserAttachment[];
}) {
  return (
    <li className="flex justify-end">
      <div className="flex max-w-[min(100%,38rem)] flex-col items-end gap-2">
        {props.attachments.length ? (
          <div className="flex max-w-full flex-wrap justify-end gap-2">
            {props.attachments.map((item) => (
              <AttachmentTile
                key={`${item.kind}:${item.path ?? item.name}:${item.note}`}
                item={item}
              />
            ))}
          </div>
        ) : null}
        {props.text ? (
          <div className="max-w-[min(100%,36rem)] rounded-[20px] border border-glass-border/40 bg-glass-active px-3.5 py-2 text-[13px]/5 text-foreground shadow-glass-card backdrop-blur-sm">
            {props.text}
          </div>
        ) : null}
      </div>
    </li>
  );
});

const AssistantBlock = memo(function AssistantBlock(props: { text: string }) {
  return (
    <li className="py-1">
      <Streamdown
        className="font-glass chat-markdown text-[13px]/5 text-foreground"
        controls={controls}
        dir="auto"
        lineNumbers={false}
        plugins={plugins}
      >
        {props.text}
      </Streamdown>
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
    <div>
      <div className="mb-1.5 text-[11px]/[1.1] font-medium tracking-wide text-muted-foreground/55 uppercase">
        {props.label}
      </div>
      <div
        className={cn(
          "rounded-lg border px-2.5 py-2",
          props.error
            ? "border-destructive/20 bg-destructive/5"
            : "border-glass-border/25 bg-glass-hover/8",
        )}
      >
        <pre className="font-glass-mono whitespace-pre-wrap text-[11px]/[1.45] text-foreground/75">
          {props.text}
        </pre>
      </div>
    </div>
  );
});

function CardShell(props: {
  icon: React.ReactNode;
  name: string;
  badge: ToolState;
  expanded: boolean;
  onFlip: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="overflow-hidden rounded-lg border border-glass-border/40 bg-glass-bubble/45 shadow-glass-card backdrop-blur-sm">
      <Collapsible.Root open={props.expanded}>
        <Collapsible.Trigger
          onClick={props.onFlip}
          className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-glass-hover/15"
        >
          <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground/70">
            {props.icon}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px]/[1.3] font-medium text-foreground/80">
            {props.name}
          </span>
          <Badge state={props.badge} />
          <IconChevronBottom
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground/55 transition-transform duration-200",
              !props.expanded && "-rotate-90",
            )}
          />
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="grid gap-3 border-t border-glass-border/25 px-3 py-3">
            {props.children}
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </li>
  );
}

const ToolCard = memo(function ToolCard(props: {
  row: Extract<PiRow, { kind: "tool" }>;
  expanded: boolean;
  onFlip: () => void;
}) {
  return (
    <CardShell
      icon={<IconToolbox className="size-4" />}
      name={props.row.name}
      badge={state(props.row)}
      expanded={props.expanded}
      onFlip={props.onFlip}
    >
      <Section label="Parameters" text={props.row.args} />
      <Section
        label={props.row.error ? "Error" : "Result"}
        text={props.row.result}
        error={props.row.error}
      />
    </CardShell>
  );
});

const BashCard = memo(function BashCard(props: {
  row: Extract<PiRow, { kind: "bash" }>;
  expanded: boolean;
  onFlip: () => void;
}) {
  const err = props.row.code !== null && props.row.code !== 0;

  return (
    <CardShell
      icon={<IconConsole className="size-4" />}
      name="Ran command"
      badge={state(props.row)}
      expanded={props.expanded}
      onFlip={props.onFlip}
    >
      <Section label="Command" text={props.row.command} />
      <Section
        label="Output"
        text={`${props.row.output}${props.row.truncated ? "\n\n[truncated]" : ""}`}
        error={err}
      />
      {props.row.path ? <Section label="Full output path" text={props.row.path} /> : null}
    </CardShell>
  );
});

const TextCard = memo(function TextCard(props: {
  label: string;
  text: string;
  expanded: boolean;
  onFlip: () => void;
  error?: boolean;
}) {
  return (
    <CardShell
      icon={<IconToolbox className="size-4" />}
      name={props.label}
      badge="completed"
      expanded={props.expanded}
      onFlip={props.onFlip}
    >
      <Section label="Content" text={props.text} error={props.error} />
    </CardShell>
  );
});

const GlassPiList = memo(function GlassPiList(props: {
  rows: PiRow[];
  expanded: boolean;
  onFlip: () => void;
}) {
  return props.rows.map((row) => draw(row, props.expanded, props.onFlip));
});

const GlassPiTranscript = memo(function GlassPiTranscript(props: {
  items: PiSessionItem[];
  expanded: boolean;
  onFlip: () => void;
}) {
  const rows = useMemo(() => buildPiRows(props.items), [props.items]);
  return <GlassPiList rows={rows} expanded={props.expanded} onFlip={props.onFlip} />;
});

const GlassPiLive = memo(function GlassPiLive(props: {
  item: PiSessionItem | null;
  expanded: boolean;
  onFlip: () => void;
}) {
  const rows = useMemo(() => (props.item ? buildPiRows([props.item]) : []), [props.item]);
  return <GlassPiList rows={rows} expanded={props.expanded} onFlip={props.onFlip} />;
});

export const GlassPiMessages = memo(function GlassPiMessages(props: {
  messages: PiSessionItem[];
  live: PiSessionItem | null;
  expanded: boolean;
  onFlip: () => void;
}) {
  const viewport = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);

  useEffect(() => {
    const node = viewport.current;
    if (!node || !stick.current) return;

    const id = window.requestAnimationFrame(() => {
      const next = viewport.current;
      if (!next || !stick.current) return;
      next.scrollTop = next.scrollHeight;
    });

    return () => {
      window.cancelAnimationFrame(id);
    };
  }, [props.messages, props.live, props.expanded]);

  return (
    <ScrollArea
      className="min-h-0 flex-1"
      scrollFade
      scrollbarGutter
      viewportRef={viewport}
      onViewportScroll={(event) => {
        const node = event.currentTarget;
        stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
      }}
    >
      <ul className="mx-auto flex max-w-[44rem] flex-col gap-4 px-4 py-4 md:px-8">
        <GlassPiTranscript items={props.messages} expanded={props.expanded} onFlip={props.onFlip} />
        <GlassPiLive item={props.live} expanded={props.expanded} onFlip={props.onFlip} />
      </ul>
    </ScrollArea>
  );
});
