import type { Json, PiSessionItem } from "@glass/contracts";
import type { FileDiffMetadata } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { Collapsible } from "~/components/ui/collapsible";
import {
  IconChevronBottom,
  IconClipboard,
  IconConsole,
  IconCrossSmall,
  IconFileBend,
  IconImages1,
  IconLoader,
  IconToolbox,
} from "central-icons";
import React from "react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ChatMarkdown } from "../../lib/chat-markdown";
import { useGlassDiffStylePreference } from "../../hooks/use-glass-git";
import { useTheme } from "../../hooks/use-theme";
import {
  glassUserAttachmentFileRow,
  glassUserAttachmentImageCard,
} from "../../lib/glass-attachment-styles";
import { buildPiRows, type PiRow, type PiUserAttachment } from "../../lib/pi-chat-timeline";
import { VsFileIcon } from "../../lib/vscode-file-icon";
import {
  isFileTool,
  isShellTool,
  toolBody,
  toolBodyEmbedded,
  toolDiffStat,
  toolFileDiff,
  toolPathFromCall,
} from "../../lib/tool-renderers";
import { cn } from "../../lib/utils";

/** Tool / bash cards: full border + soft fill (Cursor-like), no left accent rail. */
const toolPanelShell =
  "min-w-0 rounded-glass-card border border-glass-border/45 bg-glass-bubble/55 px-2 py-0 shadow-glass-card";

/** Base UI trigger: no browser / focus-visible ring (reads as ugly “outline on select”). */
const collapsibleTriggerFocus =
  "outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0";

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
        "inline-flex shrink-0 items-center gap-1 text-body/[1.375]",
        s === "errored"
          ? "rounded bg-destructive/10 px-1.5 py-0.5 text-destructive/90"
          : "text-foreground/48",
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

  if (row.kind === "assistantError") {
    return <AssistantErrorBlock key={row.id} text={row.text} expanded={expanded} />;
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
      <div className={glassUserAttachmentImageCard}>
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
          <div className="truncate text-body/[1.2] font-medium text-foreground/85">
            {props.item.name}
          </div>
          {props.item.note ? (
            <div className="line-clamp-2 text-detail/[1.35] text-muted-foreground/80">
              {props.item.note}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={glassUserAttachmentFileRow}>
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-glass-card bg-glass-hover/25 text-muted-foreground/75">
        <IconFileBend className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body/[1.2] font-medium text-foreground/85">
          {props.item.name}
        </span>
        <span className="block truncate text-detail/[1.2] text-muted-foreground/75">
          {props.item.path}
        </span>
        {props.item.note ? (
          <span className="mt-1 line-clamp-2 block text-detail/[1.35] text-muted-foreground/75">
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
          <div className="max-w-[min(100%,36rem)] whitespace-pre-wrap break-words rounded-[20px] border border-glass-border/40 bg-glass-active px-3.5 py-2 text-body/5 text-foreground shadow-glass-card backdrop-blur-sm">
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
        <Collapsible.Trigger
          className={cn(
            collapsibleTriggerFocus,
            "group flex h-8 max-h-8 w-full cursor-pointer items-center gap-2 py-0 text-left transition-colors hover:bg-glass-hover/8",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-body/[1.375] text-foreground/[0.7]">
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
          <div className="mt-1 rounded-glass-control border border-glass-border/35 bg-muted/20 px-3 py-2 text-body/[1.625] whitespace-pre-wrap break-words italic text-foreground/[0.7]">
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
      <ChatMarkdown>{props.text}</ChatMarkdown>
    </li>
  );
});

function linkRowKey(l: { url: string; title?: string; snippet?: string }) {
  return `${l.url}\0${l.title ?? ""}\0${l.snippet ?? ""}`;
}

function renderValue(value: Json | undefined, depth: number, path = "$"): React.ReactNode {
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
        <div className="pl-4">
          {value.map((item, i) => {
            const childPath = `${path}[${String(i)}]`;
            return (
              <div key={childPath}>
                {renderValue(item, depth + 1, childPath)}
                {i < value.length - 1 && <span className="text-muted-foreground/50">,</span>}
              </div>
            );
          })}
        </div>
        <span className="text-muted-foreground/50">]</span>
      </span>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, Json>);
    if (entries.length === 0) return <span className="text-muted-foreground/50">{"{}"}</span>;
    return (
      <span>
        <span className="text-muted-foreground/50">{"{"}</span>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 pl-4">
          {entries.map(([key, val], i) => (
            <React.Fragment key={`${path}.${key}`}>
              <span className="text-primary/80 font-medium">{key}</span>
              <span className="text-muted-foreground/40">:</span>
              <span className="min-w-0">{renderValue(val, depth + 1, `${path}.${key}`)}</span>
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
  data: Json | undefined,
): Array<{ url: string; title?: string; snippet?: string }> {
  const out: Array<{ url: string; title?: string; snippet?: string }> = [];
  const add = (u: Json | undefined, t?: Json, s?: Json) => {
    if (typeof u !== "string" || !u.startsWith("http")) return;
    const item: { url: string; title?: string; snippet?: string } = { url: u };
    if (typeof t === "string") item.title = t;
    if (typeof s === "string") item.snippet = s;
    out.push(item);
  };
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === "object") {
        const o = item as Record<string, Json>;
        add(o.url ?? o.href ?? o.link, o.title ?? o.name, o.snippet ?? o.description);
      }
    }
    if (out.length) return out;
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, Json>;
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
        {links.map((l) => (
          <li key={linkRowKey(l)} className="text-body/[1.375]">
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
      <div className="max-h-[min(24rem,50vh)] overflow-auto px-0.5 py-1">
        <div className="font-glass-mono text-detail/[1.625] [&_span]:leading-[inherit]">
          {renderValue(parsed, 0)}
        </div>
      </div>
    );
  }

  return (
    <pre
      className={cn(
        "tool-terminal max-h-[min(24rem,50vh)] overflow-y-auto whitespace-pre-wrap break-words font-glass-mono text-detail/[1.625]",
        props.error ? "text-destructive/90" : "text-foreground/80",
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
      <div className="flex items-center justify-between gap-2">
        <span className="text-detail/[1.1] font-medium tracking-wide text-muted-foreground/45 uppercase">
          {props.label}
        </span>
        <button
          onClick={copy}
          className="flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-muted-foreground/40 transition-colors hover:bg-glass-hover/20 hover:text-muted-foreground/70"
        >
          <IconClipboard className="size-3" />
          <span>copy</span>
        </button>
      </div>
      {parsed !== null ? (
        <div className="tool-output-surface font-glass-mono text-detail/[1.5]">
          {renderValue(parsed, 0)}
        </div>
      ) : (
        <pre className="tool-terminal whitespace-pre-wrap text-detail/[1.45] text-foreground/75">
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
    <li className={cn(toolPanelShell, "overflow-hidden")}>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger
          className={cn(
            collapsibleTriggerFocus,
            "group flex h-8 max-h-8 w-full cursor-pointer items-center gap-1.5 py-0 pr-0.5 text-left transition-colors hover:bg-glass-hover/6",
          )}
        >
          <span className="flex size-3.5 shrink-0 items-center justify-center text-foreground/48 [&>svg]:size-3">
            {props.icon}
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            <span className="min-w-0 flex-1 truncate text-body/[1.375] font-medium text-foreground/[0.94]">
              {props.title}
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
          <div className="flex flex-col gap-1.5 border-t border-[color-mix(in_srgb,var(--foreground)_6%,transparent)]">
            {props.children}
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </li>
  );
}

function assistantErrorTitle(text: string): string {
  const line = text.trim().split(/\r?\n/u, 1)[0] ?? "";
  if (!line) return "Error";
  if (line.length <= 52) return line;
  return `${line.slice(0, 49)}…`;
}

const AssistantErrorBlock = memo(function AssistantErrorBlock(props: {
  text: string;
  expanded: boolean;
}) {
  const title = useMemo(() => assistantErrorTitle(props.text), [props.text]);
  return (
    <ToolRailCard
      icon={<IconCrossSmall className="size-3 shrink-0 text-destructive/80" />}
      title={title}
      subtitle={
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-body/[1.375] text-destructive/90">
          Error
        </span>
      }
      expanded={props.expanded}
    >
      <div className="min-w-0 pt-1.5 pb-2">
        <pre className="tool-terminal max-h-[min(40vh,20rem)] overflow-y-auto whitespace-pre-wrap break-words font-glass-mono text-detail/[1.45] text-foreground/80">
          {props.text}
        </pre>
      </div>
    </ToolRailCard>
  );
});

/** Embedded file tool diff: same unified/split + theme as Changes panel (`GlassDiffViewer`); compact chrome. */
function embedToolDiffOptions(opts: {
  diffStyle: "unified" | "split";
  theme: "pierre-dark" | "pierre-light";
}) {
  return {
    theme: opts.theme,
    diffStyle: opts.diffStyle,
    overflow: "wrap" as const,
    disableFileHeader: true,
    disableBackground: false,
    disableLineNumbers: true,
    diffIndicators: "none" as const,
    lineDiffType: "none" as const,
    expandUnchanged: false,
    hunkSeparators: "simple" as const,
    unsafeCSS: "[data-separator] { display: none !important; }",
  };
}

function toolArgs(row: Extract<PiRow, { kind: "tool" }>): Record<string, Json> | null {
  const fromCall = row.call?.arguments;
  if (fromCall && typeof fromCall === "object") return fromCall as Record<string, Json>;
  try {
    const o = JSON.parse(row.args) as Json;
    if (o && typeof o === "object") return o as Record<string, Json>;
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
  if (row.name === "ask" && Array.isArray(args.questions) && args.questions[0]) {
    const text = (args.questions[0] as { question?: Json }).question;
    if (typeof text === "string" && text.trim()) return text.trim();
    return "Questions";
  }
  return row.name;
}

const FileEditToolCard = memo(function FileEditToolCard(props: {
  row: Extract<PiRow, { kind: "tool" }>;
  diff: FileDiffMetadata;
  path: string;
  expanded: boolean;
  toolState: ToolState;
}) {
  const [diffStyle] = useGlassDiffStylePreference();
  const { resolvedTheme } = useTheme();
  const pierreTheme =
    resolvedTheme === "dark" ? ("pierre-dark" as const) : ("pierre-light" as const);
  const [open, setOpen] = useSyncedExpand(props.expanded);
  const [full, setFull] = useState(false);
  const stat = useMemo(() => toolDiffStat(props.diff), [props.diff]);
  const base = useMemo(() => {
    const p = props.path;
    const pos = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
    return pos < 0 ? p : p.slice(pos + 1);
  }, [props.path]);

  return (
    <li className={cn(toolPanelShell, "overflow-hidden")}>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger
          className={cn(
            collapsibleTriggerFocus,
            "group flex w-full cursor-pointer items-center gap-2 py-1.5 pr-0.5 text-left transition-colors hover:bg-glass-hover/6",
          )}
          title={props.path}
          type="button"
        >
          <span className="flex size-3.5 shrink-0 items-center justify-center text-foreground/48 [&>svg]:size-3">
            <VsFileIcon path={props.path} errored={props.toolState === "errored"} />
          </span>
          <span className="min-w-0 flex-1 truncate font-glass text-body/[1.375] font-medium text-foreground/[0.94]">
            {base}
          </span>
          <span className="flex shrink-0 items-baseline gap-2 font-glass-mono text-detail tabular-nums">
            {stat.add > 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">+{stat.add}</span>
            ) : null}
            {stat.del > 0 ? (
              <span className="text-red-600 dark:text-red-400/95">-{stat.del}</span>
            ) : null}
            {stat.add === 0 && stat.del === 0 ? (
              <span className="text-muted-foreground/45">—</span>
            ) : null}
          </span>
          <span className="shrink-0">
            <ToolSubtitle row={props.row} />
          </span>
          <IconChevronBottom
            className={cn(
              "size-3 shrink-0 text-foreground/48 transition-transform duration-200",
              !open && "-rotate-90",
            )}
          />
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="flex flex-col border-t border-[color-mix(in_srgb,var(--foreground)_6%,transparent)]">
            <div
              className={cn(
                "relative min-h-0 overflow-x-auto",
                full ? "max-h-[min(56vh,28rem)] overflow-y-auto" : "max-h-[80px] overflow-y-hidden",
              )}
            >
              <div className="embed-diff min-h-[72px] bg-transparent">
                <FileDiff
                  fileDiff={props.diff}
                  options={embedToolDiffOptions({ diffStyle, theme: pierreTheme })}
                />
              </div>
              {!full ? (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[color-mix(in_srgb,var(--color-glass-bubble)_96%,var(--background))] to-transparent dark:from-[color-mix(in_srgb,var(--color-glass-bubble)_90%,var(--background))]"
                  aria-hidden
                />
              ) : null}
            </div>
            <button
              type="button"
              className={cn(
                collapsibleTriggerFocus,
                "flex w-full cursor-pointer items-center justify-center gap-1.5 border-t border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] py-1.5 text-detail text-muted-foreground transition-colors hover:bg-glass-hover/8 hover:text-foreground/85",
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setFull((v) => !v);
              }}
            >
              <IconChevronBottom
                className={cn("size-3 shrink-0 transition-transform", full && "rotate-180")}
              />
              <span>{full ? "Show less" : "Show more"}</span>
            </button>
          </div>
        </Collapsible.Panel>
      </Collapsible.Root>
    </li>
  );
});

const ToolCard = memo(function ToolCard(props: {
  row: Extract<PiRow, { kind: "tool" }>;
  expanded: boolean;
}) {
  const [diffStyle] = useGlassDiffStylePreference();
  const { resolvedTheme } = useTheme();
  const pierreTheme =
    resolvedTheme === "dark" ? ("pierre-dark" as const) : ("pierre-light" as const);
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

  if (file && diff && path) {
    return (
      <FileEditToolCard
        row={props.row}
        diff={diff}
        path={path}
        expanded={props.expanded}
        toolState={s}
      />
    );
  }

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
        <div className="embed-diff tool-output-surface max-h-[min(56vh,28rem)] overflow-auto">
          <FileDiff
            fileDiff={diff}
            options={embedToolDiffOptions({ diffStyle, theme: pierreTheme })}
          />
        </div>
      ) : null}
      {!file && hasPayload && detail ? (
        <div className="max-h-[min(56vh,28rem)] min-h-0 overflow-auto">{detail}</div>
      ) : null}
      {!file && hasPayload && !detail ? (
        <JsonSection
          label={props.row.error ? "Error" : "Details"}
          text={props.row.result.trim() ? props.row.result : props.row.args}
        />
      ) : null}
      {file && props.row.error && props.row.result.trim() ? (
        <div className="text-detail/[1.4] text-destructive/85">{props.row.result}</div>
      ) : null}
    </ToolRailCard>
  );
});

function exploredSummary(tool: Extract<PiRow, { kind: "tool" }>): string {
  const name = tool.name.toLowerCase();
  let args: Record<string, Json> = {};
  try {
    args = JSON.parse(tool.args) as Record<string, Json>;
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
        ? toolBodyEmbedded({
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
        <div className="min-w-0 truncate text-body/[1.375] text-foreground/[0.94]">{summary}</div>
      </div>
    );
  }

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger
        className={cn(
          collapsibleTriggerFocus,
          "flex h-8 max-h-8 w-full cursor-pointer items-center gap-2 text-left",
        )}
      >
        <div className="min-w-0 flex-1 truncate text-body/[1.375] text-foreground/[0.94]">
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
        <div className="max-h-60 min-h-0 overflow-auto border-t border-[color-mix(in_srgb,var(--foreground)_6%,transparent)]">
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
    <li className={cn(toolPanelShell, "text-body/[1.5]")}>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger
          className={cn(
            collapsibleTriggerFocus,
            "flex h-8 max-h-8 w-full cursor-pointer items-center gap-2 px-0.5 text-left transition-colors hover:bg-glass-hover/6",
          )}
        >
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
          <div className="mt-1 flex flex-col gap-1 rounded-glass-control border border-glass-border/35 bg-muted/15 p-2">
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
    <li className={cn(toolPanelShell, "overflow-hidden")}>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger
          className={cn(
            collapsibleTriggerFocus,
            "group flex h-8 max-h-8 w-full cursor-pointer items-center gap-1.5 py-0 pr-0.5 text-left transition-colors hover:bg-glass-hover/6",
          )}
        >
          <span className="flex size-3.5 shrink-0 items-center justify-center text-foreground/48 [&>svg]:size-3">
            <IconConsole className="size-3 shrink-0" />
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            <span className="min-w-0 flex-1 truncate font-glass-mono text-body/[1.375] font-medium text-foreground/[0.94]">
              {props.row.command}
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
          <div className="flex flex-col gap-1.5 border-t border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] pt-1.5 pb-2">
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
        const j = JSON.parse(t) as Json;
        const links = extractLinksFromPayload(j);
        if (links.length > 0) {
          return (
            <ul className="flex flex-col gap-2">
              {links.map((l) => (
                <li key={linkRowKey(l)} className="text-body/[1.375]">
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
            <div className="font-glass-mono text-detail/[1.5]">{renderValue(j, 0)}</div>
          </div>
        );
      } catch {
        return <ChatMarkdown>{props.text}</ChatMarkdown>;
      }
    }
    return <ChatMarkdown>{props.text}</ChatMarkdown>;
  }, [props.text]);

  return (
    <ToolRailCard
      icon={<IconToolbox className="text-foreground/48" />}
      title={props.label}
      subtitle={<span className="text-body/[1.375] text-foreground/48">Completed</span>}
      expanded={props.expanded}
    >
      {body ? (
        <div
          className={cn(
            "max-h-[min(56vh,28rem)] min-h-0 overflow-auto",
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

/** Dev `/dev/icons`: real transcript chrome that uses `central-icons` in this file. */
export function GlassPiChatRowsIconStripDemo() {
  const running: Extract<PiRow, { kind: "tool" }> = {
    id: "demo-run",
    kind: "tool",
    name: "read",
    args: '{"path":"x"}',
    result: "",
    error: false,
    call: null,
    details: null,
  };
  const bash: Extract<PiRow, { kind: "bash" }> = {
    id: "demo-bash",
    kind: "bash",
    command: "ls",
    output: "",
    code: null,
    cancelled: false,
    truncated: false,
    path: null,
    exclude: false,
  };
  const glob: Extract<PiRow, { kind: "tool" }> = {
    id: "demo-glob",
    kind: "tool",
    name: "glob",
    args: '{"pattern":"**"}',
    result: "",
    error: false,
    call: null,
    details: null,
  };
  const fileAtt: PiUserAttachment = {
    kind: "file",
    name: "a.ts",
    path: "/a.ts",
    note: "",
  };
  const imgAtt: PiUserAttachment = {
    kind: "image",
    name: "b.png",
    path: null,
    note: "",
    mimeType: "image/png",
  };

  return (
    <div className="flex max-w-lg flex-col gap-0">
      <div className="border-b border-border bg-muted/20 px-3 py-2">
        <span className="inline-flex items-center gap-2 text-detail text-muted-foreground">
          <ToolSubtitle row={running} />
          <span>Tool status</span>
        </span>
      </div>
      <ul className="list-none">
        <ThinkingRow text="Thinking text…" expanded={false} />
      </ul>
      <div className="flex flex-wrap justify-end gap-2 border-b border-border px-2 py-2">
        <AttachmentTile item={fileAtt} />
        <AttachmentTile item={imgAtt} />
      </div>
      <div className="border-b border-border px-2 py-2">
        <JsonSection label="Output" text='{"a":1}' />
      </div>
      <ul className="list-none space-y-1">
        <AssistantErrorBlock text="Something went wrong" expanded={true} />
        <BashCard row={bash} expanded={true} />
        <ToolCard row={glob} expanded={true} />
        <TextCard label="Results" text='{"x":1}' expanded={true} />
      </ul>
    </div>
  );
}

export { GlassPiTranscript, GlassPiLive };
