import type { PiToolCallBlock } from "@glass/contracts";
import { code } from "@streamdown/code";
import { memo } from "react";
import { Streamdown } from "streamdown";
import { cn } from "./utils";

interface ToolData {
  name: string;
  call: PiToolCallBlock | null;
  args: string;
  result: string;
  error: boolean;
  details: Record<string, unknown> | null;
  expanded: boolean;
}

type Render = (data: ToolData) => React.ReactNode;

const renderers = new Map<string, Render>();

function register(name: string, fn: Render) {
  renderers.set(name, fn);
}

export function resolvedToolName(name: string) {
  const n = name.toLowerCase();
  if (
    n === "str_replace" ||
    n === "search_replace" ||
    n === "replace" ||
    n === "apply_patch" ||
    n === "patch" ||
    n === "multi_edit"
  ) {
    return "edit";
  }
  if (n === "run_terminal_cmd" || n === "run_command" || n === "shell") return "bash";
  if (n === "list_dir" || n === "directory_list") return "ls";
  return n;
}

export function toolBody(data: ToolData): React.ReactNode {
  const fn = renderers.get(resolvedToolName(data.name));
  if (fn) return fn(data);
  return fallback(data);
}

export function toolHint(call: PiToolCallBlock | null): string | null {
  const args = call?.arguments;
  if (!args || typeof args !== "object") return null;

  const desc = args.description;
  if (typeof desc === "string" && desc.trim()) return desc.trim().slice(0, 72);

  for (const key of ["command", "path", "pattern", "query", "file", "url"]) {
    const val = args[key];
    if (typeof val === "string" && val.trim()) return val.trim().slice(0, 72);
  }

  const keys = Object.keys(args);
  if (keys.length === 0) return null;
  return `${keys.length} arg${keys.length === 1 ? "" : "s"}`;
}

function editPath(args: Record<string, unknown>) {
  const path = args.path ?? args.file ?? args.target_file ?? args.file_path;
  return typeof path === "string" ? path : "";
}

export function toolLabel(name: string, call: PiToolCallBlock | null): string | null {
  const args = call?.arguments;
  if (!args || typeof args !== "object") return null;
  const r = resolvedToolName(name);

  if (r === "edit" || r === "write") {
    const path = editPath(args);
    if (path.trim()) return basename(path);
    return null;
  }

  if (r === "bash") {
    const desc = args.description;
    if (typeof desc === "string" && desc.trim()) return desc.trim();
    return null;
  }

  return null;
}

function lineDelta(oldText: string, newText: string) {
  const o = oldText.split("\n");
  const n = newText.split("\n");
  const os = new Set(o);
  const ns = new Set(n);
  let add = 0;
  for (const l of n) if (!os.has(l)) add += 1;
  let del = 0;
  for (const l of o) if (!ns.has(l)) del += 1;
  return { add, del };
}

export function toolStats(
  name: string,
  call: PiToolCallBlock | null,
): { add: number; del: number } | null {
  if (resolvedToolName(name) !== "edit") return null;
  const args = (call?.arguments ?? {}) as EditArgs;
  const list = edits(args);
  if (list.length === 0 && !args.patch) return null;

  let add = 0;
  let del = 0;
  for (const entry of list) {
    const d = lineDelta(entry.oldText ?? "", entry.newText ?? "");
    add += d.add;
    del += d.del;
  }
  return { add, del };
}

const plugins = { code };
const controls = {
  code: { copy: true, download: false },
  mermaid: false,
  table: false,
} as const;

const exts: Record<string, string> = {
  bash: "bash",
  c: "c",
  cc: "cpp",
  cpp: "cpp",
  css: "css",
  go: "go",
  h: "c",
  hpp: "cpp",
  html: "html",
  java: "java",
  js: "javascript",
  json: "json",
  md: "markdown",
  mdx: "mdx",
  py: "python",
  rs: "rust",
  sh: "bash",
  sql: "sql",
  ts: "typescript",
  tsx: "tsx",
  txt: "text",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  zsh: "bash",
};

function langFor(path: string | null) {
  if (!path) return "";
  const pos = path.lastIndexOf(".");
  if (pos < 0 || pos === path.length - 1) return "";
  return exts[path.slice(pos + 1).toLowerCase()] ?? "";
}

function fenced(text: string, lang: string) {
  const body = text.replace(/\r\n/g, "\n");
  const head = body.trimStart();
  if (head.startsWith("```") || head.startsWith("~~~")) return body;
  let mark = "```";
  while (body.includes(mark)) mark += "`";
  return `${mark}${lang}\n${body}\n${mark}`;
}

function basename(path: string) {
  const pos = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return pos < 0 ? path : path.slice(pos + 1);
}

const Code = memo(function Code(props: { text: string; lang?: string; error?: boolean }) {
  if (!props.text.trim()) return null;
  return (
    <div
      className={cn(
        "rounded-lg border border-glass-border/25 bg-glass-hover/8",
        props.error && "border-destructive/20 bg-destructive/5",
      )}
    >
      <Streamdown
        className="font-glass-mono text-[11px]/[1.4] text-foreground/72"
        controls={controls}
        dir="auto"
        lineNumbers={false}
        plugins={plugins}
      >
        {fenced(props.text, props.lang ?? "")}
      </Streamdown>
    </div>
  );
});

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5 text-[11px]/[1.3]">
      <span className="shrink-0 font-medium text-muted-foreground/55">{props.label}</span>
      <span className="min-w-0 truncate text-foreground/75">{props.children}</span>
    </div>
  );
}

function Badge(props: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded border border-glass-border/30 bg-glass-hover/15 px-1 py-0.5 text-[10px]/[1] font-medium text-muted-foreground/70">
      {props.children}
    </span>
  );
}

function Result(props: { text: string; error: boolean; lang?: string }) {
  if (!props.text.trim()) return null;
  return (
    <Code text={props.text} error={props.error} {...(props.lang ? { lang: props.lang } : {})} />
  );
}

interface ReadArgs {
  path?: string;
  offset?: number;
  limit?: number;
}

function read(data: ToolData): React.ReactNode {
  const args = (data.call?.arguments ?? {}) as ReadArgs;
  const path = args.path ?? "";
  const lang = langFor(path);

  if (!data.expanded) {
    const text = data.result || data.args;
    if (!text.trim()) return null;
    return <Code text={text} lang={lang || "text"} error={data.error} />;
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Field label="path">
          <code className="rounded bg-glass-hover/20 px-1 py-0.5 font-[family-name:var(--glass-font-mono)] text-[10px]/[1.2]">
            {path || "?"}
          </code>
        </Field>
        {args.offset != null && <Badge>offset {args.offset}</Badge>}
        {args.limit != null && <Badge>limit {args.limit}</Badge>}
      </div>
      <Result text={data.result} error={data.error} lang={lang || "text"} />
    </div>
  );
}

interface EditEntry {
  oldText?: string;
  newText?: string;
}

interface EditArgs {
  path?: string;
  edits?: EditEntry[];
  oldText?: string;
  newText?: string;
  multi?: Array<{ path?: string; oldText?: string; newText?: string }>;
  patch?: string;
}

function edits(args: EditArgs): EditEntry[] {
  if (Array.isArray(args.edits) && args.edits.length > 0) return args.edits;
  if (typeof args.oldText === "string") {
    return [
      { oldText: args.oldText, ...(args.newText !== undefined ? { newText: args.newText } : {}) },
    ];
  }
  if (Array.isArray(args.multi)) {
    return args.multi.map((m) => ({
      ...(m.oldText !== undefined ? { oldText: m.oldText } : {}),
      ...(m.newText !== undefined ? { newText: m.newText } : {}),
    }));
  }
  return [];
}

function unified(entry: EditEntry): React.ReactNode[] {
  const old = (entry.oldText ?? "").split("\n");
  const next = (entry.newText ?? "").split("\n");
  const lines: React.ReactNode[] = [];

  for (const l of old) {
    lines.push(
      <div key={`d${lines.length}`} className="bg-glass-diff-deletion-bg text-glass-diff-deletion">
        <span className="select-none opacity-50">- </span>
        {l}
      </div>,
    );
  }
  for (const l of next) {
    lines.push(
      <div key={`a${lines.length}`} className="bg-glass-diff-addition-bg text-glass-diff-addition">
        <span className="select-none opacity-50">+ </span>
        {l}
      </div>,
    );
  }
  return lines;
}

function Diff(props: { entries: EditEntry[] }) {
  const lines = props.entries.flatMap(unified);
  if (lines.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-glass-border/25 bg-glass-hover/8">
      <div className="max-h-[min(24rem,50vh)] overflow-auto px-2.5 py-1.5 font-[family-name:var(--glass-font-mono)] text-[11px]/[1.4] whitespace-pre-wrap">
        {lines}
      </div>
    </div>
  );
}

function edit(data: ToolData): React.ReactNode {
  const raw = (data.call?.arguments ?? {}) as EditArgs & Record<string, unknown>;
  const args = raw as EditArgs;
  const path =
    typeof raw.path === "string"
      ? raw.path
      : typeof raw.file === "string"
        ? raw.file
        : typeof raw.target_file === "string"
          ? raw.target_file
          : typeof raw.file_path === "string"
            ? raw.file_path
            : Array.isArray(raw.multi) && raw.multi[0] && typeof raw.multi[0].path === "string"
              ? raw.multi[0].path
              : "";
  const entries = edits(args);

  if (!data.expanded) {
    if (data.error && data.result.trim()) {
      return <Code text={data.result} lang="text" error />;
    }
    if (entries.length > 0) return <Diff entries={entries} />;
    if (args.patch) return <Code text={args.patch} lang="diff" />;
    return null;
  }

  return (
    <div className="grid gap-1.5">
      <Field label="path">
        <code className="rounded bg-glass-hover/20 px-1 py-0.5 font-[family-name:var(--glass-font-mono)] text-[10px]/[1.2]">
          {path || "?"}
        </code>
      </Field>
      {args.patch ? <Code text={args.patch} lang="diff" /> : <Diff entries={entries} />}
      {data.error && data.result.trim() && <Result text={data.result} error lang="text" />}
    </div>
  );
}

interface WriteArgs {
  path?: string;
  content?: string;
}

function write(data: ToolData): React.ReactNode {
  const args = (data.call?.arguments ?? {}) as WriteArgs;
  const path = args.path ?? "";
  const lang = langFor(path);
  const body = args.content ?? "";

  if (!data.expanded) {
    if (data.error && data.result.trim()) {
      return <Code text={data.result} lang="text" error />;
    }
    const lines = body.split("\n").length;
    const bytes = body.length;
    return (
      <div className="flex items-center gap-2 px-1 text-[11px]/[1.3] text-muted-foreground/60">
        <span className="truncate text-foreground/70">{basename(path) || path}</span>
        <Badge>
          {lines} line{lines === 1 ? "" : "s"}
        </Badge>
        <Badge>{bytes.toLocaleString()} bytes</Badge>
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      <Field label="path">
        <code className="rounded bg-glass-hover/20 px-1 py-0.5 font-[family-name:var(--glass-font-mono)] text-[10px]/[1.2]">
          {path || "?"}
        </code>
      </Field>
      {body && <Code text={body} lang={lang} />}
      {data.error && data.result.trim() && <Result text={data.result} error lang="text" />}
    </div>
  );
}

interface BashArgs {
  command?: string;
  timeout?: number;
}

function bash(data: ToolData): React.ReactNode {
  const args = (data.call?.arguments ?? {}) as BashArgs;
  const cmd = args.command ?? "";

  if (!data.expanded) {
    const text = data.result || cmd;
    if (!text.trim()) return null;
    return <Code text={text} lang="bash" error={data.error} />;
  }

  return (
    <div className="grid gap-1.5">
      {cmd && <Code text={cmd} lang="bash" />}
      {args.timeout != null && <Field label="timeout">{args.timeout}s</Field>}
      <Result text={data.result} error={data.error} lang="bash" />
    </div>
  );
}

interface GrepArgs {
  pattern?: string;
  path?: string;
  glob?: string;
  ignoreCase?: boolean;
  literal?: boolean;
  context?: number;
  limit?: number;
}

function grep(data: ToolData): React.ReactNode {
  const args = (data.call?.arguments ?? {}) as GrepArgs;
  const pattern = args.pattern ?? "";

  if (!data.expanded) {
    const text = data.result || data.args;
    if (!text.trim()) return null;
    return <Code text={text} lang="text" error={data.error} />;
  }

  const flags: string[] = [];
  if (args.ignoreCase) flags.push("-i");
  if (args.literal) flags.push("--literal");
  if (args.glob) flags.push(`--glob ${args.glob}`);
  if (args.context != null) flags.push(`-C ${args.context}`);
  if (args.limit != null) flags.push(`limit ${args.limit}`);

  const truncated = data.details?.truncation != null;
  const count = data.details?.matchLimitReached;

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Field label="pattern">
          <code className="rounded bg-glass-hover/20 px-1 py-0.5 font-[family-name:var(--glass-font-mono)] text-[10px]/[1.2]">
            /{pattern}/
          </code>
        </Field>
        {args.path && (
          <Field label="in">
            <span className="text-foreground/70">{args.path}</span>
          </Field>
        )}
        {flags.length > 0 && <Badge>{flags.join(" ")}</Badge>}
      </div>
      <Result text={data.result} error={data.error} lang="text" />
      {(truncated || count != null) && (
        <div className="text-[10px]/[1.2] text-muted-foreground/50">
          {typeof count === "number" && `${count} match limit reached. `}
          {truncated && "Output truncated."}
        </div>
      )}
    </div>
  );
}

interface FindArgs {
  pattern?: string;
  path?: string;
  limit?: number;
}

function find(data: ToolData): React.ReactNode {
  const args = (data.call?.arguments ?? {}) as FindArgs;
  const pattern = args.pattern ?? "";

  if (!data.expanded) {
    const text = data.result || data.args;
    if (!text.trim()) return null;
    return <Code text={text} lang="text" error={data.error} />;
  }

  const truncated = data.details?.truncation != null;
  const limit = data.details?.resultLimitReached;

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Field label="pattern">
          <code className="rounded bg-glass-hover/20 px-1 py-0.5 font-[family-name:var(--glass-font-mono)] text-[10px]/[1.2]">
            {pattern}
          </code>
        </Field>
        {args.path && (
          <Field label="in">
            <span className="text-foreground/70">{args.path}</span>
          </Field>
        )}
        {args.limit != null && <Badge>limit {args.limit}</Badge>}
      </div>
      <Result text={data.result} error={data.error} lang="text" />
      {(truncated || limit != null) && (
        <div className="text-[10px]/[1.2] text-muted-foreground/50">
          {typeof limit === "number" && `${limit} results limit reached. `}
          {truncated && "Output truncated."}
        </div>
      )}
    </div>
  );
}

interface LsArgs {
  path?: string;
  limit?: number;
}

function ls(data: ToolData): React.ReactNode {
  const args = (data.call?.arguments ?? {}) as LsArgs;
  const dir = args.path ?? ".";

  if (!data.expanded) {
    const text = data.result || data.args;
    if (!text.trim()) return null;
    return <Code text={text} lang="text" error={data.error} />;
  }

  const truncated = data.details?.truncation != null;
  const limit = data.details?.entryLimitReached;

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Field label="path">
          <code className="rounded bg-glass-hover/20 px-1 py-0.5 font-[family-name:var(--glass-font-mono)] text-[10px]/[1.2]">
            {dir}
          </code>
        </Field>
        {args.limit != null && <Badge>limit {args.limit}</Badge>}
      </div>
      <Result text={data.result} error={data.error} lang="text" />
      {(truncated || limit != null) && (
        <div className="text-[10px]/[1.2] text-muted-foreground/50">
          {typeof limit === "number" && `${limit} entries limit reached. `}
          {truncated && "Output truncated."}
        </div>
      )}
    </div>
  );
}

function fallback(data: ToolData): React.ReactNode {
  if (!data.expanded) {
    const text = data.result || data.args;
    if (!text.trim()) return null;
    const lang = looksJson(text) ? "json" : "text";
    return <Code text={text} lang={lang} error={data.error} />;
  }

  return (
    <div className="grid gap-1.5">
      {data.args.trim() && <Code text={data.args} lang={looksJson(data.args) ? "json" : "text"} />}
      <Result
        text={data.result}
        error={data.error}
        lang={looksJson(data.result) ? "json" : "text"}
      />
    </div>
  );
}

function looksJson(text: string) {
  const head = text.trimStart();
  return head[0] === "{" || head[0] === "[";
}

register("read", read);
register("edit", edit);
register("write", write);
register("bash", bash);
register("grep", grep);
register("find", find);
register("ls", ls);
