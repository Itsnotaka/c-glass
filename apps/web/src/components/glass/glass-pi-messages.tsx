import type { PiSessionItem } from "@glass/contracts";
import { Collapsible } from "@base-ui/react/collapsible";
import { code } from "@streamdown/code";
import {
  IconChevronBottom,
  IconCircleCheck,
  IconCircleX,
  IconClipboard,
  IconConsole,
  IconFileBend,
  IconImages1,
  IconLoader,
  IconToolbox,
} from "central-icons";
import React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function ToolSubtitle(props: { row: Extract<PiRow, { kind: "tool" } | { kind: "bash" }> }) {
  const s = state(props.row);
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground/70">
      {s === "pending" && <IconLoader className="size-3.5 animate-spin text-muted-foreground/60" />}
      {s === "running" && <IconLoader className="size-3.5 animate-spin text-info-foreground" />}
      {s === "completed" && <IconCircleCheck className="size-3.5 text-success-foreground" />}
      {s === "errored" && <IconCircleX className="size-3.5 text-destructive" />}
      {labels[s]}
    </span>
  );
}

function draw(row: PiRow, expanded: boolean, onFlip: () => void) {
  if (row.kind === "user") {
    return <HumanBubble key={row.id} text={row.text || ""} attachments={row.attachments} />;
  }

  if (row.kind === "thinking") {
    return <ThinkingRow key={row.id} text={row.text} expanded={expanded} onFlip={onFlip} />;
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

const ThinkingRow = memo(function ThinkingRow(props: {
  text: string;
  expanded: boolean;
  onFlip: () => void;
}) {
  return (
    <li className="py-0.5">
      <Collapsible.Root open={props.expanded}>
        <Collapsible.Trigger
          onClick={props.onFlip}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-0 py-0.5 text-left transition-colors hover:bg-glass-hover/10"
        >
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground/70">
            Thinking
          </span>
          <IconChevronBottom
            className={cn(
              "size-3 shrink-0 text-muted-foreground/55 transition-transform duration-200",
              !props.expanded && "-rotate-90",
            )}
          />
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="mt-1 border-l border-glass-border/35 pb-1 pl-3 text-[13px]/5 text-muted-foreground/85">
            {props.text}
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
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

function renderValue(value: unknown, depth: number): React.ReactNode {
  if (value === null) return <span className="text-destructive/80">null</span>;
  if (value === undefined) return <span className="text-muted-foreground/60">undefined</span>;
  if (typeof value === "boolean")
    return <span className="text-accent-foreground">{String(value)}</span>;
  if (typeof value === "number") return <span className="text-info-foreground">{value}</span>;
  if (typeof value === "string") {
    if (value.length > 200 && depth > 0) {
      return (
        <span className="text-success-foreground/90">
          &ldquo;{value.slice(0, 200)}&hellip;&rdquo;
        </span>
      );
    }
    return <span className="text-success-foreground/90">&ldquo;{value}&rdquo;</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground/50">[]</span>;
    return (
      <span>
        <span className="text-muted-foreground/50">[</span>
        <div className="pl-4" style={{ borderLeft: "1px solid hsl(var(--glass-border) / 0.25)" }}>
          {value.map((item, i) => (
            <div key={i}>
              {renderValue(item, depth + 1)}
              {i < value.length - 1 && <span className="text-muted-foreground/50">,</span>}
            </div>
          ))}
        </div>
        <span className="text-muted-foreground/50">]</span>
      </span>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted-foreground/50">{"{}"}</span>;
    return (
      <span>
        <span className="text-muted-foreground/50">{"{"}</span>
        <div
          className="grid grid-cols-[auto_1fr] gap-x-3 pl-4"
          style={{ borderLeft: "1px solid hsl(var(--glass-border) / 0.25)" }}
        >
          {entries.map(([key, val], i) => (
            <React.Fragment key={key}>
              <span className="text-primary/80 font-medium">{key}</span>
              <span className="text-muted-foreground/40">:</span>
              <span className="min-w-0">{renderValue(val, depth + 1)}</span>
              {i < entries.length - 1 && <span className="text-muted-foreground/50">,</span>}
            </React.Fragment>
          ))}
        </div>
        <span className="text-muted-foreground/50">{"}"}</span>
      </span>
    );
  }
  return <span className="text-muted-foreground/60">{String(value)}</span>;
}

function JsonSection(props: { label: string; text: string; error?: boolean | undefined }) {
  if (!props.text.trim()) return null;

  const parsed = useMemo(() => {
    try {
      return JSON.parse(props.text);
    } catch {
      return null;
    }
  }, [props.text]);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(props.text);
  }, [props.text]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px]/[1.1] font-medium tracking-wide text-muted-foreground/55 uppercase">
          {props.label}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded p-1 text-muted-foreground/40 transition-colors hover:bg-glass-hover/20 hover:text-muted-foreground/70"
        >
          <IconClipboard className="size-3" />
          <span>copy</span>
        </button>
      </div>
      {parsed !== null ? (
        <div className="font-glass-mono text-[11px]/[1.45] [&_span]:leading-[1.5]">
          {renderValue(parsed, 0)}
        </div>
      ) : (
        <pre className="whitespace-pre-wrap text-[11px]/[1.45] text-foreground/75">
          {props.text}
        </pre>
      )}
    </div>
  );
}

function ToolRailCard(props: {
  icon: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
  expanded: boolean;
  onFlip: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="overflow-hidden rounded-2xl border border-glass-border/40 bg-glass-bubble/45 shadow-glass-card backdrop-blur-sm">
      <Collapsible.Root open={props.expanded}>
        <Collapsible.Trigger
          onClick={props.onFlip}
          className="flex w-full cursor-pointer items-stretch text-left transition-colors hover:bg-glass-hover/12"
        >
          <div className="flex w-[7.25rem] shrink-0 items-center justify-center border-r border-glass-border/35 bg-glass-bubble/70 py-4">
            {props.icon}
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 pl-6 sm:pl-7">
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1 text-[13px] font-medium text-foreground/90">
                {props.title}
              </div>
              <div className="mt-0.5">{props.subtitle}</div>
            </div>
            <IconChevronBottom
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground/55 transition-transform duration-200",
                !props.expanded && "-rotate-90",
              )}
            />
          </div>
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="flex flex-col gap-3 px-4 py-3 sm:pl-[calc(7.25rem+1.75rem)]">
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
  const s = state(props.row);
  const args = useMemo(() => {
    try {
      return JSON.parse(props.row.args);
    } catch {
      return null;
    }
  }, [props.row.args]);

  const result = useMemo(() => {
    try {
      return JSON.parse(props.row.result);
    } catch {
      return null;
    }
  }, [props.row.result]);

  const summary = useMemo(() => {
    if (!args || typeof args !== "object") return null;
    const entries = Object.entries(args);
    if (entries.length === 0) return null;

    const label = props.row.name.toLowerCase().includes("read")
      ? "Read"
      : props.row.name.toLowerCase().includes("grep")
        ? "Grepped"
        : props.row.name.toLowerCase().includes("write")
          ? "Wrote"
          : props.row.name.toLowerCase().includes("edit")
            ? "Edited"
            : props.row.name.toLowerCase().includes("bash") ||
                props.row.name.toLowerCase().includes("shell")
              ? "Ran"
              : props.row.name.toLowerCase().includes("search")
                ? "Searched"
                : props.row.name.toLowerCase().includes("fetch") ||
                    props.row.name.toLowerCase().includes("web")
                  ? "Fetched"
                  : null;

    if (label) {
      const parts: string[] = [];
      for (const [key, val] of entries) {
        if (key === "path" || key === "file" || key === "files") {
          const files = Array.isArray(val) ? val : [val];
          parts.push(`${files.length} ${files.length === 1 ? "file" : "files"}`);
        } else if (key === "query" || key === "pattern") {
          parts.push(`"${String(val).slice(0, 50)}"`);
        } else if (key === "command") {
          parts.push(String(val).slice(0, 30));
        }
      }
      if (parts.length > 0) {
        return `${label} ${parts.join(", ")}`;
      }
    }
    return null;
  }, [args, props.row.name]);

  return (
    <ToolRailCard
      icon={
        <IconToolbox
          className={cn(
            "size-[18px]",
            s === "errored" && "text-destructive",
            s === "completed" && "text-success-foreground/90",
            (s === "pending" || s === "running") && "text-muted-foreground/75",
          )}
        />
      }
      title={summary ?? props.row.name}
      subtitle={<ToolSubtitle row={props.row} />}
      expanded={props.expanded}
      onFlip={props.onFlip}
    >
      {args && typeof args === "object" && (
        <div className="flex flex-col gap-2">
          {Object.entries(args).map(([key, val]) => (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <span className="text-[13px] font-medium text-foreground/90 line-clamp-1">
                  {formatArgValue(key, val)}
                </span>
                <IconChevronBottom className="size-3 shrink-0 text-muted-foreground/40 -rotate-90" />
              </div>
              {shouldShowContent(val) && (
                <div className="rounded-lg overflow-hidden bg-glass-hover/5 border border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] p-2">
                  <div className="max-h-48 overflow-auto">
                    <pre className="font-glass-mono whitespace-pre-wrap text-[11px]/3.5 text-foreground/70">
                      {formatContentValue(val)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!args && props.row.args.trim() && <JsonSection label="Parameters" text={props.row.args} />}
      {props.row.result.trim() && (
        <JsonSection
          label={props.row.error ? "Error" : "Result"}
          text={props.row.result}
          error={props.row.error}
        />
      )}
    </ToolRailCard>
  );
});

function formatArgValue(key: string, value: unknown): string {
  if (key === "path" || key === "file") {
    const str = Array.isArray(value) ? value.join(", ") : String(value);
    return str.split(/[\\/]/).at(-1) ?? str;
  }
  if (key === "query" || key === "pattern" || key === "search") {
    return `"${String(value)}"`;
  }
  if (key === "command") {
    const cmd = String(value);
    return cmd.length > 50 ? `${cmd.slice(0, 50)}…` : cmd;
  }
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string" || v === null)) {
      return (
        value
          .filter(Boolean)
          .map((v) => String(v).split(/[\\/]/).at(-1))
          .join(", ") || key
      );
    }
  }
  if (typeof value === "string") {
    return value;
  }
  return key;
}

function shouldShowContent(value: unknown): boolean {
  if (typeof value === "string") return value.includes("\n") || value.length > 200;
  if (Array.isArray(value))
    return value.some((v) => typeof v === "string" && (v.includes("\n") || v.length > 200));
  if (typeof value === "object" && value !== null) return true;
  return false;
}

function formatContentValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join("\n");
  if (typeof value === "object" && value !== null) return JSON.stringify(value, null, 2);
  return String(value);
}

const BashCard = memo(function BashCard(props: {
  row: Extract<PiRow, { kind: "bash" }>;
  expanded: boolean;
  wide: number;
}) {
  const err = props.row.code !== null && props.row.code !== 0;

  return (
    <li className="overflow-hidden rounded-lg border border-glass-border/40 bg-glass-bubble/45 shadow-glass-card backdrop-blur-sm">
      <Collapsible.Root open={props.expanded}>
        <Collapsible.Trigger
          onClick={props.onFlip}
          className="flex w-full cursor-pointer items-center gap-1.5 px-2 py-1 text-left transition-colors hover:bg-glass-hover/12"
        >
          <div className="flex h-5 w-3 shrink-0 items-center justify-center font-glass-mono text-xs font-semibold text-muted-foreground/70">
            $
          </div>
          <div className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground/85">
            {props.row.command}
          </div>
          <IconChevronBottom
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground/55 transition-transform duration-200",
              !props.expanded && "-rotate-90",
            )}
          />
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="grid gap-3 border-t border-glass-border/25 px-3 py-3">
            <div className="flex items-center gap-2">
              <IconConsole className="size-4 shrink-0 text-muted-foreground/65" />
              <ToolSubtitle row={props.row} />
            </div>
            <JsonSection label="Command" text={props.row.command} />
            <JsonSection
              label="Output"
              text={`${props.row.output}${props.row.truncated ? "\n\n[truncated]" : ""}`}
              error={err}
            />
            {props.row.path ? <JsonSection label="Full output path" text={props.row.path} /> : null}
          </div>
        </Collapsible.Panel>
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
  return (
    <ToolRailCard
      icon={<IconToolbox className="size-[18px] text-muted-foreground/75" />}
      title={props.label}
      subtitle={<span className="text-[13px] text-muted-foreground/70">Completed</span>}
      expanded={props.expanded}
      onFlip={props.onFlip}
    >
      <JsonSection label="Content" text={props.text} error={props.error} />
    </ToolRailCard>
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
      <ul className="mx-auto flex max-w-[43.875rem] flex-col gap-2 px-4 py-4 md:px-8">
        <GlassPiTranscript items={props.messages} expanded={props.expanded} onFlip={props.onFlip} />
        <GlassPiLive item={props.live} expanded={props.expanded} onFlip={props.onFlip} />
      </ul>
    </ScrollArea>
  );
});
