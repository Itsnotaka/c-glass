import type { PiSessionItem } from "@glass/contracts";
import { FileDiff } from "@pierre/diffs/react";
import { Collapsible } from "~/components/ui/collapsible";
import { code } from "@streamdown/code";
import {
  IconChevronBottom,
  IconClipboard,
  IconConsole,
  IconFileBend,
  IconImages1,
  IconLoader,
  IconToolbox,
} from "central-icons";
import React from "react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import { buildPiRows, type PiRow, type PiUserAttachment } from "../../lib/pi-chat-timeline";
import { VsFileIcon } from "../../lib/vscode-file-icon";
import {
  isFileTool,
  isShellTool,
  toolBody,
  toolFileDiff,
  toolPathFromCall,
} from "../../lib/tool-renderers";
import { cn } from "../../lib/utils";

const plugins = { code };

const controls = {
  code: { copy: true, download: false },
  mermaid: false,
  table: false,
} as const;

function useSyncedExpand(expanded: boolean) {
  const [open, setOpen] = useState(expanded);
  useEffect(() => {
    setOpen(expanded);
  }, [expanded]);
  return [open, setOpen] as const;
}

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
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[12px] leading-tight",
        s === "errored" ? "text-destructive/85" : "text-foreground/48",
      )}
    >
      {(s === "pending" || s === "running") && (
        <IconLoader className="size-2.5 shrink-0 animate-spin text-foreground/48" />
      )}
      {labels[s]}
    </span>
  );
}

function draw(row: PiRow, expanded: boolean) {
  if (row.kind === "user") {
    return <HumanBubble key={row.id} text={row.text || ""} attachments={row.attachments} />;
  }

  if (row.kind === "thinking") {
    return <ThinkingRow key={row.id} text={row.text} expanded={expanded} />;
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
    return <BashCard key={row.id} row={row} expanded={expanded} />;
  }

  if (row.kind === "custom") {
    return <TextCard key={row.id} label={row.name} text={row.text} expanded={expanded} />;
  }

  if (row.kind === "compaction") {
    return (
      <TextCard
        key={row.id}
        label="Compaction"
        text={`Compacted from ${row.tokens.toLocaleString()} tokens\n\n${row.summary}`}
        expanded={expanded}
      />
    );
  }

  if (row.kind === "branch") {
    return <TextCard key={row.id} label="Branch" text={row.summary} expanded={expanded} />;
  }

  if (row.kind === "system") {
    return <TextCard key={row.id} label="System" text={row.text} expanded={expanded} />;
  }

  if (row.kind === "other") {
    return <TextCard key={row.id} label={row.role} text={row.text} expanded={expanded} />;
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

const ThinkingRow = memo(function ThinkingRow(props: { text: string; expanded: boolean }) {
  const [open, setOpen] = useSyncedExpand(props.expanded);
  return (
    <li className="min-w-0">
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger className="group flex h-8 max-h-8 w-full cursor-pointer items-center gap-2 py-0 text-left transition-colors hover:bg-glass-hover/8">
          <span className="min-w-0 flex-1 truncate text-[13px] leading-none text-foreground/[0.7]">
            Thinking
          </span>
          <IconChevronBottom
            className={cn(
              "size-3 shrink-0 text-foreground/48 transition-transform duration-200",
              !open && "-rotate-90",
            )}
          />
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="mt-1 border-l border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] pl-3 text-[13px]/[1.5] text-foreground/[0.7]">
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

function extractLinksFromPayload(
  data: unknown,
): Array<{ url: string; title?: string; snippet?: string }> {
  const out: Array<{ url: string; title?: string; snippet?: string }> = [];
  const add = (u: unknown, t?: unknown, s?: unknown) => {
    if (typeof u !== "string" || !u.startsWith("http")) return;
    const item: { url: string; title?: string; snippet?: string } = { url: u };
    if (typeof t === "string") item.title = t;
    if (typeof s === "string") item.snippet = s;
    out.push(item);
  };
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        add(o.url ?? o.href ?? o.link, o.title ?? o.name, o.snippet ?? o.description);
      }
    }
    if (out.length) return out;
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const nested = o.results ?? o.links ?? o.items ?? o.visited ?? o.sources;
    if (Array.isArray(nested)) return extractLinksFromPayload(nested);
    add(o.url, o.title, o.snippet);
    if (out.length) return out;
  }
  return out;
}

function BashOutputRich(props: { text: string; error: boolean }) {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(props.text);
    } catch {
      return null;
    }
  }, [props.text]);

  const links = useMemo(() => (parsed !== null ? extractLinksFromPayload(parsed) : []), [parsed]);

  if (links.length > 0) {
    return (
      <ul className="flex flex-col gap-2">
        {links.map((l, i) => (
          <li key={`${l.url}-${String(i)}`} className="text-[12px] leading-snug">
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
            >
              {l.title ?? l.url}
            </a>
            {l.snippet ? (
              <span className="mt-0.5 block text-muted-foreground/70">{l.snippet}</span>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  if (parsed !== null) {
    return (
      <div className="max-h-[min(24rem,50vh)] overflow-auto">
        <div className="font-glass-mono text-[11px]/[1.45] [&_span]:leading-[1.5]">
          {renderValue(parsed, 0)}
        </div>
      </div>
    );
  }

  return (
    <pre
      className={cn(
        "max-h-[min(24rem,50vh)] overflow-auto whitespace-pre-wrap font-glass-mono text-[11px]/[1.45] text-foreground/75",
        props.error && "rounded-sm bg-destructive/[0.06] text-destructive/90",
      )}
    >
      {props.text}
    </pre>
  );
}

function JsonSection(props: { label: string; text: string }) {
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
  children: React.ReactNode;
}) {
  const [open, setOpen] = useSyncedExpand(props.expanded);
  return (
    <li className="min-w-0 overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--foreground)_8%,transparent)]">
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger className="group flex h-8 max-h-8 w-full cursor-pointer items-center gap-2 px-2 py-0 text-left transition-colors hover:bg-glass-hover/8">
          <span className="flex size-3.5 shrink-0 items-center justify-center text-foreground/48 [&>svg]:size-3">
            {props.icon}
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            <span className="min-w-0 flex-1 truncate text-[13px] leading-tight text-foreground/[0.94]">
              {props.title}
            </span>
            <span className="shrink-0 select-none text-foreground/40" aria-hidden>
              ·
            </span>
            <span className="shrink-0">{props.subtitle}</span>
          </div>
          <IconChevronBottom
            className={cn(
              "size-3 shrink-0 text-foreground/48 transition-transform duration-200",
              !open && "-rotate-90",
            )}
          />
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="flex flex-col gap-2 border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] px-2 py-2">
            {props.children}
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </li>
  );
}

const isDark = () =>
  typeof window !== "undefined" && document.documentElement.classList.contains("dark");

function toolArgs(row: Extract<PiRow, { kind: "tool" }>): Record<string, unknown> | null {
  const fromCall = row.call?.arguments;
  if (fromCall && typeof fromCall === "object") return fromCall as Record<string, unknown>;
  try {
    const o = JSON.parse(row.args) as unknown;
    if (o && typeof o === "object") return o as Record<string, unknown>;
  } catch {}
  return null;
}

function toolTitle(row: Extract<PiRow, { kind: "tool" }>): string {
  const path = toolPathFromCall(row.call, row.args);
  if (path) {
    const pos = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return pos < 0 ? path : path.slice(pos + 1);
  }

  const args = toolArgs(row);
  if (!args) return row.name;
  if (typeof args.pattern === "string" && args.pattern.trim()) return args.pattern;
  if (typeof args.query === "string" && args.query.trim()) return args.query;
  if (typeof args.command === "string" && args.command.trim()) return args.command;
  return row.name;
}

const ToolCard = memo(function ToolCard(props: {
  row: Extract<PiRow, { kind: "tool" }>;
  expanded: boolean;
}) {
  const s = state(props.row);
  const file = isFileTool(props.row.name);
  const title = useMemo(() => toolTitle(props.row), [props.row]);
  const path = useMemo(
    () => toolPathFromCall(props.row.call, props.row.args),
    [props.row.call, props.row.args],
  );

  const diff = useMemo(
    () => (file ? toolFileDiff(props.row.name, props.row.call) : null),
    [file, props.row.name, props.row.call],
  );

  const detail = useMemo(
    () =>
      file
        ? null
        : toolBody({
            name: props.row.name,
            call: props.row.call,
            args: props.row.args,
            result: props.row.result,
            error: props.row.error,
            details: props.row.details,
            expanded: true,
          }),
    [
      file,
      props.row.name,
      props.row.call,
      props.row.args,
      props.row.result,
      props.row.error,
      props.row.details,
    ],
  );

  const hasPayload = Boolean(props.row.args.trim() || props.row.result.trim());

  return (
    <ToolRailCard
      icon={
        path ? (
          <VsFileIcon path={path} errored={s === "errored"} />
        ) : file ? (
          <IconFileBend
            className={cn(s === "errored" && "text-destructive/80", "text-foreground/48")}
          />
        ) : isShellTool(props.row.name, props.row.call, props.row.args) ? (
          <IconConsole
            className={cn(
              "size-3 shrink-0",
              s === "errored" && "text-destructive/80",
              "text-foreground/48",
            )}
          />
        ) : (
          <IconToolbox
            className={cn(s === "errored" && "text-destructive/80", "text-foreground/48")}
          />
        )
      }
      title={title}
      subtitle={<ToolSubtitle row={props.row} />}
      expanded={props.expanded}
    >
      {file && diff ? (
        <div className="embed-diff max-h-[min(56vh,28rem)] overflow-auto">
          <FileDiff
            fileDiff={diff}
            options={{
              theme: isDark() ? "pierre-dark" : "pierre-light",
              diffStyle: "unified",
              overflow: "scroll",
              disableFileHeader: true,
              disableBackground: true,
              expandUnchanged: false,
              unsafeCSS: "[data-separator] { display: none !important; }",
            }}
          />
        </div>
      ) : null}
      {!file && hasPayload && detail ? (
        <div className="max-h-[min(56vh,28rem)] overflow-auto">{detail}</div>
      ) : null}
      {!file && hasPayload && !detail ? (
        <JsonSection
          label={props.row.error ? "Error" : "Details"}
          text={props.row.result.trim() ? props.row.result : props.row.args}
        />
      ) : null}
      {file && props.row.error && props.row.result.trim() ? (
        <div className="text-[11px]/[1.4] text-destructive/85">{props.row.result}</div>
      ) : null}
    </ToolRailCard>
  );
});

function exploredSummary(tool: Extract<PiRow, { kind: "tool" }>): string {
  const name = tool.name.toLowerCase();
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(tool.args);
  } catch {}

  const label = name.includes("read")
    ? "Read"
    : name.includes("grep")
      ? "Grepped"
      : name.includes("search")
        ? "Searched"
        : name.includes("fetch")
          ? "Fetched"
          : name.includes("list") || name.includes("ls")
            ? "Listed"
            : name.includes("find") || name.includes("glob")
              ? "Searched files"
              : tool.name;

  const parts: string[] = [];
  for (const [key, val] of Object.entries(args)) {
    if (key === "path" || key === "file" || key === "file_path") {
      const str = String(val);
      parts.push(str.split(/[\\/]/).at(-1) ?? str);
    } else if (key === "pattern" || key === "query") {
      const v = String(val);
      parts.push(v.length > 50 ? `${v.slice(0, 50)}…` : v);
    } else if (key === "glob") {
      parts.push(`(${String(val)})`);
    }
  }

  return parts.length > 0 ? `${label} ${parts.join(" ")}` : label;
}

const ExploredToolItem = memo(function ExploredToolItem(props: {
  tool: Extract<PiRow, { kind: "tool" }>;
}) {
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => exploredSummary(props.tool), [props.tool]);
  const hasContent = props.tool.result.trim().length > 0;

  const body = useMemo(
    () =>
      hasContent
        ? toolBody({
            name: props.tool.name,
            call: props.tool.call,
            args: props.tool.args,
            result: props.tool.result,
            error: props.tool.error,
            details: props.tool.details,
            expanded: true,
          })
        : null,
    [props.tool, hasContent],
  );

  if (!hasContent) {
    return (
      <div className="flex h-8 max-h-8 min-w-0 items-center">
        <div className="min-w-0 truncate text-[13px] leading-none text-foreground/[0.94]">
          {summary}
        </div>
      </div>
    );
  }

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="flex h-8 max-h-8 w-full cursor-pointer items-center gap-2 text-left">
        <div className="min-w-0 flex-1 truncate text-[13px] leading-none text-foreground/[0.94]">
          {summary}
        </div>
        <IconChevronBottom
          className={cn(
            "size-3 shrink-0 text-foreground/48 transition-transform duration-200",
            !open && "-rotate-90",
          )}
        />
      </Collapsible.Trigger>
      <Collapsible.Panel>
        <div className="max-h-60 overflow-auto border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] pt-1.5">
          {body}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
});

const ExploredCard = memo(function ExploredCard(props: {
  row: Extract<PiRow, { kind: "explored" }>;
  expanded: boolean;
}) {
  const [open, setOpen] = useSyncedExpand(props.expanded);

  const parts: string[] = [];
  if (props.row.reads > 0)
    parts.push(`${props.row.reads} ${props.row.reads === 1 ? "file" : "files"}`);
  if (props.row.searches > 0)
    parts.push(`${props.row.searches} ${props.row.searches === 1 ? "search" : "searches"}`);

  return (
    <li className="min-w-0 text-[13px] leading-none">
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger className="flex h-8 max-h-8 w-full cursor-pointer items-center gap-2 text-left">
          <span className="shrink-0 text-foreground/[0.7]">Explored</span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0">
            {parts.map((p) => (
              <span key={p} className="shrink-0 text-foreground/48">
                {p}
              </span>
            ))}
          </div>
          <IconChevronBottom
            className={cn(
              "size-3 shrink-0 text-foreground/48 transition-transform duration-200",
              !open && "-rotate-90",
            )}
          />
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="mt-1 flex flex-col gap-2">
            {props.row.tools.map((tool) => (
              <ExploredToolItem key={tool.id} tool={tool} />
            ))}
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </li>
  );
});

const BashCard = memo(function BashCard(props: {
  row: Extract<PiRow, { kind: "bash" }>;
  expanded: boolean;
}) {
  const err = props.row.code !== null && props.row.code !== 0;
  const [open, setOpen] = useSyncedExpand(props.expanded);

  return (
    <li className="min-w-0 overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--foreground)_8%,transparent)]">
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger className="group flex h-8 max-h-8 w-full cursor-pointer items-center gap-2 px-2 py-0 text-left transition-colors hover:bg-glass-hover/8">
          <span className="flex size-3.5 shrink-0 items-center justify-center text-foreground/48 [&>svg]:size-3">
            <IconConsole className="size-3 shrink-0" />
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            <span className="min-w-0 flex-1 truncate font-glass-mono text-[12px] leading-tight text-foreground/[0.94]">
              {props.row.command}
            </span>
            <span className="shrink-0 select-none text-foreground/40" aria-hidden>
              ·
            </span>
            <span className="shrink-0">
              <ToolSubtitle row={props.row} />
            </span>
          </div>
          <IconChevronBottom
            className={cn(
              "size-3 shrink-0 text-foreground/48 transition-transform duration-200",
              !open && "-rotate-90",
            )}
          />
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="flex flex-col gap-2 border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] px-2 py-2">
            <BashOutputRich
              text={`${props.row.output}${props.row.truncated ? "\n\n[truncated]" : ""}`}
              error={err}
            />
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
}) {
  const body = useMemo(() => {
    const t = props.text.trim();
    if (!t) return null;
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        const j = JSON.parse(t) as unknown;
        const links = extractLinksFromPayload(j);
        if (links.length > 0) {
          return (
            <ul className="flex flex-col gap-2">
              {links.map((l, i) => (
                <li key={`${l.url}-${String(i)}`} className="text-[12px] leading-snug">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                  >
                    {l.title ?? l.url}
                  </a>
                  {l.snippet ? (
                    <span className="mt-0.5 block text-muted-foreground/70">{l.snippet}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <div className="max-h-[min(24rem,50vh)] overflow-auto">
            <div className="font-glass-mono text-[11px]/[1.45] [&_span]:leading-[1.5]">
              {renderValue(j, 0)}
            </div>
          </div>
        );
      } catch {
        return (
          <Streamdown
            className="font-glass chat-markdown text-[13px]/5 text-foreground"
            controls={controls}
            dir="auto"
            lineNumbers={false}
            plugins={plugins}
          >
            {props.text}
          </Streamdown>
        );
      }
    }
    return (
      <Streamdown
        className="font-glass chat-markdown text-[13px]/5 text-foreground"
        controls={controls}
        dir="auto"
        lineNumbers={false}
        plugins={plugins}
      >
        {props.text}
      </Streamdown>
    );
  }, [props.text]);

  return (
    <ToolRailCard
      icon={<IconToolbox className="text-foreground/48" />}
      title={props.label}
      subtitle={<span className="text-[12px] leading-none text-foreground/48">Completed</span>}
      expanded={props.expanded}
    >
      {body ? (
        <div
          className={cn(
            "max-h-[min(56vh,28rem)] overflow-auto",
            props.error && "text-destructive/90",
          )}
        >
          {body}
        </div>
      ) : null}
    </ToolRailCard>
  );
});

const GlassPiList = memo(function GlassPiList(props: { rows: PiRow[]; expanded: boolean }) {
  return props.rows.map((row) => draw(row, props.expanded));
});

const GlassPiTranscript = memo(function GlassPiTranscript(props: {
  items: PiSessionItem[];
  expanded: boolean;
  wide: number;
}) {
  const rows = useMemo(() => buildPiRows(props.items), [props.items]);
  return <GlassPiList rows={rows} expanded={props.expanded} />;
});

const GlassPiLive = memo(function GlassPiLive(props: {
  item: PiSessionItem | null;
  expanded: boolean;
  wide: number;
}) {
  const rows = useMemo(() => (props.item ? buildPiRows([props.item]) : []), [props.item]);
  return <GlassPiList rows={rows} expanded={props.expanded} />;
});

export { GlassPiTranscript, GlassPiLive };
