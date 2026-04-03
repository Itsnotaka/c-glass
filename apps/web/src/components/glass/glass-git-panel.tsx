"use client";

import type { GitFileState } from "@glass/contracts";
import type { GlassGitPanelModel } from "../../hooks/use-glass-git";
import { isElectron } from "../../env";
import { readGlass } from "../../host";
import { cn } from "../../lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { GlassDiffViewer } from "./diff-viewer";

function displayName(path: string) {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

function KindBadge(props: { state: GitFileState }) {
  const s = props.state;
  if (s === "untracked") {
    return (
      <span className="shrink-0 rounded border border-amber-500/35 bg-amber-500/10 px-1 py-0.5 text-[10px]/[1] font-medium text-amber-600 dark:text-amber-400">
        untracked
      </span>
    );
  }
  if (s === "added") {
    return (
      <span className="shrink-0 rounded border border-[var(--glass-diff-addition)]/40 bg-[var(--glass-diff-addition-bg)] px-1 py-0.5 text-[10px]/[1] font-medium text-[var(--glass-diff-addition)]">
        new
      </span>
    );
  }
  if (s === "deleted") {
    return (
      <span className="shrink-0 rounded border border-[var(--glass-diff-deletion)]/40 bg-[var(--glass-diff-deletion-bg)] px-1 py-0.5 text-[10px]/[1] font-medium text-[var(--glass-diff-deletion)]">
        deleted
      </span>
    );
  }
  if (s === "renamed") {
    return (
      <span className="shrink-0 rounded border border-glass-border/50 bg-glass-hover/30 px-1 py-0.5 text-[10px]/[1] font-medium text-muted-foreground">
        renamed
      </span>
    );
  }
  if (s === "conflicted") {
    return (
      <span className="shrink-0 rounded border border-destructive/35 bg-destructive/10 px-1 py-0.5 text-[10px]/[1] font-medium text-destructive">
        conflict
      </span>
    );
  }
  if (s === "typechange") {
    return (
      <span className="shrink-0 rounded border border-glass-border/50 bg-glass-hover/30 px-1 py-0.5 text-[10px]/[1] font-medium text-muted-foreground">
        type
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded border border-glass-border/50 bg-glass-hover/30 px-1 py-0.5 text-[10px]/[1] font-medium text-muted-foreground">
      modified
    </span>
  );
}

export function GlassGitPanel(props: { git: GlassGitPanelModel }) {
  const git = props.git;
  const bridge = readGlass()?.git;

  if (!isElectron || !bridge) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <p className="text-[13px]/[1.4] font-medium text-foreground/85">Source control</p>
        <p className="max-w-[18rem] text-[12px]/[1.45] text-muted-foreground/72">
          Git status and diffs are available in the Glass desktop app.
        </p>
      </div>
    );
  }

  if (git.loading && !git.snap) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-3">
        <div className="h-3 w-24 animate-pulse rounded bg-muted/40" />
        <div className="h-3 w-full animate-pulse rounded bg-muted/30" />
        <div className="h-3 w-full animate-pulse rounded bg-muted/30" />
      </div>
    );
  }

  const snap = git.snap;

  if (git.error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <p className="text-[13px]/[1.4] font-medium text-destructive/90">Git error</p>
        <p className="max-w-[20rem] text-[12px]/[1.45] text-muted-foreground/80">{git.error}</p>
      </div>
    );
  }

  if (snap && !snap.repo) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
        <div className="rounded-xl border border-glass-border/50 bg-glass-hover/20 px-4 py-3">
          <p className="text-[13px]/[1.4] font-medium text-foreground/85">No repository</p>
          <p className="mt-1 max-w-[18rem] text-[12px]/[1.45] text-muted-foreground/72">
            Initialize Git in this workspace to track changes and review diffs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => git.init()}
          className="rounded-lg border border-glass-border/60 bg-glass-active/40 px-3 py-1.5 text-[12px]/[1.2] font-medium text-foreground transition-colors hover:bg-glass-hover"
        >
          Init Git
        </button>
      </div>
    );
  }

  if (snap && snap.repo && snap.clean) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-12 text-center">
        <p className="text-[13px]/[1.4] font-medium text-foreground/85">Working tree clean</p>
        <p className="max-w-[18rem] text-[12px]/[1.45] text-muted-foreground/72">
          No staged or unstaged changes in this repository.
        </p>
      </div>
    );
  }

  const files = snap?.files ?? [];
  const selected = files.find((f) => f.id === git.selected) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-[var(--glass-header-height)] shrink-0 items-center justify-between border-b border-glass-border/40 px-3">
        <h2 className="text-[12px]/[1.2] font-semibold text-foreground/85">Changes</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-glass-border/40 bg-glass-hover/15 p-0.5">
            <button
              type="button"
              onClick={() => git.setDiffStyle("unified")}
              className={cn(
                "rounded px-2 py-0.5 text-[10px]/[1] font-medium transition-colors",
                git.diffStyle === "unified"
                  ? "bg-glass-active/80 text-foreground"
                  : "text-muted-foreground/70 hover:text-foreground",
              )}
            >
              Unified
            </button>
            <button
              type="button"
              onClick={() => git.setDiffStyle("split")}
              className={cn(
                "rounded px-2 py-0.5 text-[10px]/[1] font-medium transition-colors",
                git.diffStyle === "split"
                  ? "bg-glass-active/80 text-foreground"
                  : "text-muted-foreground/70 hover:text-foreground",
              )}
            >
              Split
            </button>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-b border-glass-border/30 px-3 py-1.5 text-[11px]/[1.2] text-muted-foreground/72">
        <span>
          {files.length} file{files.length === 1 ? "" : "s"}
        </span>
        {git.totalAdd > 0 && (
          <span className="text-[var(--glass-diff-addition)]">+{git.totalAdd}</span>
        )}
        {git.totalDel > 0 && (
          <span className="text-[var(--glass-diff-deletion)]">-{git.totalDel}</span>
        )}
      </div>

      <ScrollArea className="min-h-0 shrink-0 px-2 py-2" style={{ maxHeight: "40%" }}>
        <div className="flex flex-col gap-1">
          {files.map((file) => {
            const st = git.statsById.get(file.id);
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => git.setSelected(file.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                  file.id === git.selected
                    ? "bg-glass-active/60 text-foreground"
                    : "text-foreground/80 hover:bg-glass-hover/40",
                )}
              >
                <span className="min-w-0 flex-1 truncate text-[12px]/[1.3] font-medium">
                  {displayName(file.path)}
                </span>
                <KindBadge state={file.state} />
                <div className="flex shrink-0 items-center gap-1.5 text-[11px]/[1]">
                  {st && st.add > 0 && (
                    <span className="font-medium text-[var(--glass-diff-addition)]">+{st.add}</span>
                  )}
                  {st && st.del > 0 && (
                    <span className="font-medium text-[var(--glass-diff-deletion)]">-{st.del}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {selected && (
        <div className="min-h-0 flex-1 border-t border-glass-border/40">
          <div className="flex h-7 shrink-0 items-center gap-2 border-b border-glass-border/30 px-3">
            <span className="truncate text-[11px]/[1.2] font-medium text-foreground/85">
              {displayName(selected.path)}
            </span>
            {selected.staged && (
              <span className="rounded border border-glass-border/50 px-1 py-0.5 text-[10px] text-muted-foreground">
                staged
              </span>
            )}
            {selected.unstaged && (
              <span className="rounded border border-glass-border/50 px-1 py-0.5 text-[10px] text-muted-foreground">
                unstaged
              </span>
            )}
          </div>
          <GlassDiffViewer
            fileDiff={git.patch}
            diffStyle={git.diffStyle}
            className="h-[calc(100%-1.75rem)] min-h-[120px]"
          />
        </div>
      )}
    </div>
  );
}
