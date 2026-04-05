import type { PiToolCallBlock } from "@glass/contracts";
import { parseDiffFromFile, type FileDiffMetadata } from "@pierre/diffs";
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

export { type FileDiffMetadata };

export function toolFileDiff(name: string, call: PiToolCallBlock | null): FileDiffMetadata | null {
  const r = resolvedToolName(name);
  const raw = (call?.arguments ?? {}) as Record<string, unknown>;
  const path = editPath(raw);
  if (!path) return null;

  if (r === "write") {
    const body = typeof raw.content === "string" ? raw.content : "";
    if (!body.trim()) return null;
    return parseDiffFromFile({ name: path, contents: "" }, { name: path, contents: body });
  }

  if (r === "edit") {
    const args = raw as EditArgs;
    const list = edits(args);
    if (list.length === 0 && !args.patch) return null;
    const old = list.map((e) => e.oldText ?? "").join("\n");
    const next = list.map((e) => e.newText ?? "").join("\n");
    return parseDiffFromFile({ name: path, contents: old }, { name: path, contents: next });
  }

  return null;
}

export function isFileTool(name: string) {
  const r = resolvedToolName(name);
  return r === "edit" || r === "write";
}

export function isShellTool(name: string, call: PiToolCallBlock | null, argsJson?: string) {
  if (resolvedToolName(name) === "bash") return true;
  const args = call?.arguments;
  if (
    args &&
    typeof args === "object" &&
    typeof (args as { command?: unknown }).command === "string"
  ) {
    return true;
  }
  if (!argsJson?.trim()) return false;
  try {
    const o = JSON.parse(argsJson) as unknown;
    if (
      o &&
      typeof o === "object" &&
      "command" in o &&
      typeof (o as { command: unknown }).command === "string"
    ) {
      return true;
    }
  } catch {}
  return false;
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
  if (typeof path === "string" && path.trim()) return path;
  const multi = args.multi;
  if (Array.isArray(multi) && multi[0] && typeof multi[0] === "object") {
    const p = (multi[0] as { path?: string }).path;
    if (typeof p === "string" && p.trim()) return p;
  }
  return "";
}

export function toolPathFromCall(call: PiToolCallBlock | null, argsJson?: string): string | null {
  const raw = call?.arguments;
  if (raw && typeof raw === "object") {
    const p = editPath(raw as Record<string, unknown>).trim();
    if (p) return p;
  }
  if (!argsJson?.trim()) return null;
  try {
    const o = JSON.parse(argsJson) as unknown;
    if (o && typeof o === "object") {
      const p = editPath(o as Record<string, unknown>).trim();
      return p || null;
    }
  } catch {}
  return null;
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
        "embed-code max-h-[min(24rem,50vh)] overflow-auto",
        props.error && "rounded-glass-control bg-destructive/[0.06]",
      )}
    >
      <Streamdown
        className="font-glass-mono chat-markdown text-detail/[1.4] text-foreground"
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

function Result(props: { text: string; error: boolean; lang?: string }) {
  if (!props.text.trim()) return null;
  return (
    <Code text={props.text} error={props.error} {...(props.lang ? { lang: props.lang } : {})} />
  );
}

function Truncation(props: { truncated: boolean; limit?: unknown; noun: string }) {
  if (!props.truncated && props.limit == null) return null;
  return (
    <div className="text-caption/[1.2] text-muted-foreground/50">
      {typeof props.limit === "number" && `${props.limit} ${props.noun} limit reached. `}
      {props.truncated && "Output truncated."}
    </div>
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

  return <Result text={data.result} error={data.error} lang={lang || "text"} />;
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
    <div className="overflow-hidden">
      <div className="max-h-[min(24rem,50vh)] overflow-auto font-[family-name:var(--glass-font-mono)] text-detail/[1.4] whitespace-pre-wrap">
        {lines}
      </div>
    </div>
  );
}

function edit(data: ToolData): React.ReactNode {
  const raw = (data.call?.arguments ?? {}) as EditArgs & Record<string, unknown>;
  const args = raw as EditArgs;
  const entries = edits(args);

  if (!data.expanded) {
    if (data.error && data.result.trim()) return <Code text={data.result} lang="text" error />;
    if (entries.length > 0) return <Diff entries={entries} />;
    if (args.patch) return <Code text={args.patch} lang="diff" />;
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
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
  const body = args.content ?? "";

  if (!data.expanded) {
    if (data.error && data.result.trim()) return <Code text={data.result} lang="text" error />;
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      {body && <Diff entries={[{ newText: body }]} />}
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
    <div className="flex flex-col gap-1">
      {cmd ? <Code text={cmd} lang="bash" /> : null}
      {args.timeout != null ? (
        <div className="text-caption text-muted-foreground/50">{args.timeout}s timeout</div>
      ) : null}
      <Result text={data.result} error={data.error} lang="bash" />
    </div>
  );
}

function grep(data: ToolData): React.ReactNode {
  if (!data.expanded) {
    const text = data.result || data.args;
    if (!text.trim()) return null;
    return <Code text={text} lang="text" error={data.error} />;
  }

  return (
    <div className="flex flex-col gap-1">
      <Result text={data.result} error={data.error} lang="text" />
      <Truncation
        truncated={data.details?.truncation != null}
        limit={data.details?.matchLimitReached}
        noun="match"
      />
    </div>
  );
}

function find(data: ToolData): React.ReactNode {
  if (!data.expanded) {
    const text = data.result || data.args;
    if (!text.trim()) return null;
    return <Code text={text} lang="text" error={data.error} />;
  }

  return (
    <div className="flex flex-col gap-1">
      <Result text={data.result} error={data.error} lang="text" />
      <Truncation
        truncated={data.details?.truncation != null}
        limit={data.details?.resultLimitReached}
        noun="results"
      />
    </div>
  );
}

function ls(data: ToolData): React.ReactNode {
  if (!data.expanded) {
    const text = data.result || data.args;
    if (!text.trim()) return null;
    return <Code text={text} lang="text" error={data.error} />;
  }

  return (
    <div className="flex flex-col gap-1">
      <Result text={data.result} error={data.error} lang="text" />
      <Truncation
        truncated={data.details?.truncation != null}
        limit={data.details?.entryLimitReached}
        noun="entries"
      />
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
    <div className="flex flex-col gap-1">
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
