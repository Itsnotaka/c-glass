import type { PiSessionItem } from "@glass/contracts";
import { Collapsible } from "@base-ui/react/collapsible";
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import { code } from "@streamdown/code";
import {
  IconCheckmark1Small,
  IconChevronRight,
  IconConsole,
  IconFileBend,
  IconImages1,
  IconSearchIntelligence,
  IconToolbox,
} from "central-icons";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { buildPiRows, type PiRow, type PiUserAttachment } from "../../lib/pi-chat-timeline";
import {
  resolvedToolName,
  toolBody,
  toolHint,
  toolLabel,
  toolStats,
} from "../../lib/tool-renderers";
import { cn } from "../../lib/utils";
import { ScrollArea } from "~/components/ui/scroll-area";

const plugins = { code };

const controls = {
  code: { copy: true, download: false },
  mermaid: false,
  table: false,
} as const;

function draw(row: PiRow, expanded: boolean, wide: number) {
  if (row.kind === "user") {
    return <HumanBubble key={row.id} text={row.text || ""} attachments={row.attachments} />;
  }

  if (row.kind === "assistant") {
    return <AssistantBlock key={row.id} text={row.text} />;
  }

  if (row.kind === "tool") {
    return <ToolCard key={row.id} row={row} expanded={expanded} />;
  }

  if (row.kind === "explored") {
    return <ExploredCard key={row.id} row={row} expanded={expanded} />;
  }

  if (row.kind === "bash") {
    return <BashCard key={row.id} row={row} expanded={expanded} wide={wide} />;
  }

  if (row.kind === "custom") {
    return (
      <TextCard key={row.id} label={row.name} text={row.text} expanded={expanded} wide={wide} />
    );
  }

  if (row.kind === "compaction") {
    return (
      <TextCard
        key={row.id}
        label="Compaction"
        text={`Compacted from ${row.tokens.toLocaleString()} tokens\n\n${row.summary}`}
        expanded={expanded}
        wide={wide}
      />
    );
  }

  if (row.kind === "branch") {
    return (
      <TextCard key={row.id} label="Branch" text={row.summary} expanded={expanded} wide={wide} />
    );
  }

  if (row.kind === "system") {
    return <TextCard key={row.id} label="System" text={row.text} expanded={expanded} wide={wide} />;
  }

  if (row.kind === "other") {
    return (
      <TextCard key={row.id} label={row.role} text={row.text} expanded={expanded} wide={wide} />
    );
  }

  return null;
}

function clip(text: string, wide: number) {
  const prep = prepareWithSegments(text, "12px ui-monospace", { whiteSpace: "pre-wrap" });
  const out = layoutWithLines(prep, Math.max(160, wide), 20);
  if (out.lines.length <= 8) return text;
  return `${out.lines
    .slice(0, 8)
    .map((line) => line.text)
    .join("\n")}\n...`;
}

function meta(row: PiRow) {
  if (row.kind === "bash") {
    if (row.cancelled) return "cancelled";
    if (row.code === null) return "exit unknown";
    return `exit ${row.code}`;
  }
  return null;
}

function wrap(text: string, lang: string) {
  const body = text.replace(/\r\n/g, "\n");
  const head = body.trimStart();
  if (head.startsWith("```") || head.startsWith("~~~")) return body;

  let mark = "```";
  while (body.includes(mark)) mark += "`";

  return `${mark}${lang}\n${body}\n${mark}`;
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
    <li className="flex min-w-0 justify-end">
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
          <div className="max-w-[min(100%,36rem)] whitespace-pre-wrap break-words rounded-[20px] border border-glass-border/40 bg-glass-active px-3.5 py-2 text-[13px]/5 text-foreground shadow-glass-card backdrop-blur-sm">
            {props.text}
          </div>
        ) : null}
      </div>
    </li>
  );
});

const AssistantBlock = memo(function AssistantBlock(props: { text: string }) {
  return (
    <li className="min-w-0 py-1">
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
  label?: string;
  text: string;
  error?: boolean | undefined;
  code?: boolean;
  lang?: string;
  minimal?: boolean;
}) {
  if (!props.text.trim()) return null;

  if (props.minimal) {
    return (
      <div
        className={cn(
          "rounded-lg border border-glass-border/25 bg-glass-hover/8",
          props.error && "border-destructive/20 bg-destructive/5",
        )}
      >
        {props.code ? (
          <Streamdown
            className="font-glass-mono text-[11px]/[1.4] text-foreground/72"
            controls={{ code: { copy: true, download: false }, mermaid: false, table: false }}
            dir="auto"
            lineNumbers={false}
            plugins={plugins}
          >
            {wrap(props.text, props.lang ?? "")}
          </Streamdown>
        ) : (
          <pre className="whitespace-pre-wrap px-2.5 py-1.5 text-[11px]/[1.4] text-foreground/72">
            {props.text}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border px-2.5 py-2",
        props.error
          ? "border-destructive/25 bg-destructive/6"
          : "border-glass-border/30 bg-glass-hover/12",
      )}
    >
      {props.label ? (
        <div className="mb-1.5 text-[11px]/[1.1] font-medium text-muted-foreground/60">
          {props.label}
        </div>
      ) : null}
      {props.code ? (
        <Streamdown
          className="font-glass chat-markdown text-[11px]/[1.45] text-foreground/78"
          controls={controls}
          dir="auto"
          lineNumbers={false}
          plugins={plugins}
        >
          {wrap(props.text, props.lang ?? "")}
        </Streamdown>
      ) : (
        <pre className="font-glass-mono whitespace-pre-wrap text-[11px]/[1.45] text-foreground/78">
          {props.text}
        </pre>
      )}
    </div>
  );
});

function explored(row: Extract<PiRow, { kind: "explored" }>) {
  const parts: string[] = [];
  if (row.reads > 0) parts.push(`${row.reads} file${row.reads === 1 ? "" : "s"}`);
  if (row.searches > 0) parts.push(`${row.searches} search${row.searches === 1 ? "" : "es"}`);
  return `Explored ${parts.join(", ")}`;
}

const fileTools = new Set(["edit", "write"]);
const shellTools = new Set(["bash", "shell"]);

function toolIcon(name: string, done: boolean) {
  if (fileTools.has(name)) return <IconFileBend className="size-3.5" />;
  if (shellTools.has(name) && done) return <IconCheckmark1Small className="size-3.5" />;
  if (shellTools.has(name)) return <IconConsole className="size-3.5" />;
  return <IconToolbox className="size-3.5" />;
}

const ExploredCard = memo(function ExploredCard(props: {
  row: Extract<PiRow, { kind: "explored" }>;
  expanded: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(props.expanded);
  }, [props.expanded]);

  return (
    <li className="group min-w-0">
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger
          className={cn(
            "flex w-full cursor-pointer items-center gap-1.5 rounded-xl border py-1.5 pl-2 pr-1.5 text-left transition-all",
            "border-glass-border/30 bg-glass-bubble/35 shadow-glass-card backdrop-blur-sm",
            "hover:border-glass-border/50 hover:bg-glass-hover/20",
            open && "border-glass-stroke/50 bg-glass-active/15",
          )}
        >
          <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground/60">
            <IconSearchIntelligence className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px]/[1.3] font-medium text-muted-foreground/80">
            {explored(props.row)}
          </span>
          <IconChevronRight
            className={cn(
              "size-3 shrink-0 text-muted-foreground/50 transition-transform",
              open && "rotate-90",
            )}
          />
        </Collapsible.Trigger>
        <Collapsible.Panel className="mt-1.5 border-l border-glass-border/30 pl-2.5">
          <ul className="flex list-none flex-col gap-1.5">
            {props.row.tools.map((tool) => (
              <ToolCard key={tool.id} row={tool} expanded={props.expanded} nested />
            ))}
          </ul>
        </Collapsible.Panel>
      </Collapsible.Root>
    </li>
  );
});

const ToolCard = memo(function ToolCard(props: {
  row: Extract<PiRow, { kind: "tool" }>;
  expanded: boolean;
  nested?: boolean;
}) {
  const canon = resolvedToolName(props.row.name);
  const label = toolLabel(props.row.name, props.row.call);
  const stats = toolStats(props.row.name, props.row.call);
  const hint = label ? null : toolHint(props.row.call);
  const done = !props.row.error && props.row.result.length > 0;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(props.expanded);
  }, [props.expanded]);

  const body = toolBody({
    name: props.row.name,
    call: props.row.call,
    args: props.row.args,
    result: props.row.result,
    error: props.row.error,
    details: props.row.details,
    expanded: open,
  });

  const inner = (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger
        className={cn(
          "flex w-full cursor-pointer items-center gap-1.5 rounded-xl border py-1.5 pl-2 pr-1.5 text-left transition-all",
          "border-glass-border/30 bg-glass-bubble/35 shadow-glass-card backdrop-blur-sm",
          "hover:border-glass-border/50 hover:bg-glass-hover/20",
          open && "border-glass-stroke/50 bg-glass-active/15",
        )}
      >
        <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground/60">
          {toolIcon(canon, done)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px]/[1.3] font-medium text-foreground/80">
          {label ?? props.row.name}
        </span>
        {stats ? (
          <span className="flex shrink-0 items-center gap-1 text-[10px]/[1.2] font-medium tabular-nums">
            <span className="text-glass-diff-addition">+{stats.add}</span>
            <span className="text-glass-diff-deletion">-{stats.del}</span>
          </span>
        ) : null}
        {hint ? (
          <span className="hidden max-w-32 truncate text-[10px]/[1.2] text-muted-foreground/55 md:block">
            {hint}
          </span>
        ) : null}
        <IconChevronRight
          className={cn(
            "size-3 shrink-0 text-muted-foreground/50 transition-transform",
            open && "rotate-90",
          )}
        />
      </Collapsible.Trigger>
      {body ? <Collapsible.Panel className="mt-1 px-0 pb-0.5">{body}</Collapsible.Panel> : null}
    </Collapsible.Root>
  );

  if (props.nested) {
    return <li className="min-w-0">{inner}</li>;
  }

  return <li className="group min-w-0">{inner}</li>;
});

const BashCard = memo(function BashCard(props: {
  row: Extract<PiRow, { kind: "bash" }>;
  expanded: boolean;
  wide: number;
}) {
  const info = meta(props.row);
  const txt = useMemo(
    () => clip(props.row.output || props.row.command, props.wide),
    [props.row.command, props.row.output, props.wide],
  );
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(props.expanded);
  }, [props.expanded]);

  return (
    <li className="group min-w-0">
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger
          className={cn(
            "flex w-full cursor-pointer items-center gap-1.5 rounded-xl border py-1.5 pl-2 pr-1.5 text-left transition-all",
            "border-glass-border/30 bg-glass-bubble/35 shadow-glass-card backdrop-blur-sm",
            "hover:border-glass-border/50 hover:bg-glass-hover/20",
            open && "border-glass-stroke/50 bg-glass-active/15",
          )}
        >
          <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground/60">
            {props.row.code === 0 ? (
              <IconCheckmark1Small className="size-3.5" />
            ) : (
              <IconConsole className="size-3.5" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px]/[1.3] font-medium text-foreground/80">
            {props.row.command}
          </span>
          {info ? (
            <span className="shrink-0 text-[10px]/[1.2] text-muted-foreground/55">{info}</span>
          ) : null}
          <IconChevronRight
            className={cn(
              "size-3 shrink-0 text-muted-foreground/50 transition-transform",
              open && "rotate-90",
            )}
          />
        </Collapsible.Trigger>
        {open ? (
          <Collapsible.Panel className="mt-1 grid gap-1.5 px-1 pb-1">
            <Section text={props.row.command} code lang="bash" minimal />
            <Section
              text={`${props.row.output}${props.row.truncated ? "\n\n[truncated]" : ""}`}
              error={props.row.code !== null && props.row.code !== 0}
              code
              lang="bash"
              minimal
            />
            {props.row.path ? <Section text={props.row.path} minimal /> : null}
          </Collapsible.Panel>
        ) : txt ? (
          <div className="mt-1 px-1 pb-1">
            <Section
              text={txt}
              error={props.row.code !== null && props.row.code !== 0}
              code
              lang="bash"
              minimal
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
  error?: boolean;
  wide: number;
}) {
  const txt = useMemo(() => clip(props.text, props.wide), [props.text, props.wide]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(props.expanded);
  }, [props.expanded]);

  return (
    <li className="group min-w-0">
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger
          className={cn(
            "flex w-full cursor-pointer items-center gap-1.5 rounded-xl border py-1.5 pl-2 pr-1.5 text-left transition-all",
            "border-glass-border/30 bg-glass-bubble/35 shadow-glass-card backdrop-blur-sm",
            "hover:border-glass-border/50 hover:bg-glass-hover/20",
            open && "border-glass-stroke/50 bg-glass-active/15",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-[11px]/[1.3] font-medium text-foreground/80">
            {props.label}
          </span>
          <IconChevronRight
            className={cn(
              "size-3 shrink-0 text-muted-foreground/50 transition-transform",
              open && "rotate-90",
            )}
          />
        </Collapsible.Trigger>
        {open ? (
          <Collapsible.Panel className="mt-1 grid gap-1.5 px-1 pb-1">
            <Section text={props.text} error={props.error} minimal />
          </Collapsible.Panel>
        ) : txt ? (
          <div className="mt-1 px-1 pb-1">
            <Section text={txt} error={props.error} minimal />
          </div>
        ) : null}
      </Collapsible.Root>
    </li>
  );
});

const GlassPiList = memo(function GlassPiList(props: {
  rows: PiRow[];
  expanded: boolean;
  wide: number;
}) {
  return props.rows.map((row) => draw(row, props.expanded, props.wide));
});

const GlassPiTranscript = memo(function GlassPiTranscript(props: {
  items: PiSessionItem[];
  expanded: boolean;
  wide: number;
}) {
  const rows = useMemo(() => buildPiRows(props.items), [props.items]);
  return <GlassPiList rows={rows} expanded={props.expanded} wide={props.wide} />;
});

const GlassPiLive = memo(function GlassPiLive(props: {
  item: PiSessionItem | null;
  expanded: boolean;
  wide: number;
}) {
  const rows = useMemo(() => (props.item ? buildPiRows([props.item]) : []), [props.item]);
  return <GlassPiList rows={rows} expanded={props.expanded} wide={props.wide} />;
});

export const GlassPiMessages = memo(function GlassPiMessages(props: {
  messages: PiSessionItem[];
  live: PiSessionItem | null;
  expanded: boolean;
}) {
  const viewport = useRef<HTMLDivElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);
  const stick = useRef(true);
  const [wide, setWide] = useState(640);

  useEffect(() => {
    const node = list.current;
    if (!node) return;

    const sync = () => {
      const css = window.getComputedStyle(node);
      const left = Number.parseFloat(css.paddingLeft || "0");
      const right = Number.parseFloat(css.paddingRight || "0");
      const next = Math.max(160, Math.floor(node.clientWidth - left - right - 48));
      setWide((cur) => (cur === next ? cur : next));
    };

    sync();

    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(sync);
    obs.observe(node);

    return () => {
      obs.disconnect();
    };
  }, []);

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
      <ul
        ref={list}
        className="mx-auto flex min-w-0 max-w-[44rem] flex-col gap-4 px-4 py-4 md:px-8"
      >
        <GlassPiTranscript items={props.messages} expanded={props.expanded} wide={wide} />
        <GlassPiLive item={props.live} expanded={props.expanded} wide={wide} />
      </ul>
    </ScrollArea>
  );
});
