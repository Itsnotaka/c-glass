"use client";

import type { GitFileState } from "@glass/contracts";
import type { GlassGitPanelModel } from "../../hooks/use-glass-git";
import { isElectron } from "../../env";
import { readGlass } from "../../host";
import { cn } from "../../lib/utils";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { GlassDiffViewer } from "./diff-viewer";

function displayName(path: string) {
  const next = path.replace(/\/+$/, "");
  const i = next.lastIndexOf("/");
  if (i >= 0) return next.slice(i + 1) || next;
  return next || path;
}

const kindVariant: Record<string, "warning" | "addition" | "deletion" | "neutral" | "destructive"> =
  {
    untracked: "warning",
    added: "addition",
    deleted: "deletion",
    renamed: "neutral",
    conflicted: "destructive",
    typechange: "neutral",
  };

const kindLabel: Record<string, string> = {
  untracked: "untracked",
  added: "new",
  deleted: "deleted",
  renamed: "renamed",
  conflicted: "conflict",
  typechange: "type",
};

function KindBadge(props: { state: GitFileState }) {
  return (
    <Badge variant={kindVariant[props.state] ?? "neutral"}>
      {kindLabel[props.state] ?? "modified"}
    </Badge>
  );
}

export function GlassGitPanel(props: { git: GlassGitPanelModel }) {
  const git = props.git;
  const bridge = readGlass()?.git;

  if (!isElectron || !bridge) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <p className="text-body/[1.4] font-medium text-foreground/85">Source control</p>
        <p className="max-w-[18rem] text-detail/[1.45] text-muted-foreground/72">
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
        <p className="text-body/[1.4] font-medium text-destructive/90">Git error</p>
        <p className="max-w-[20rem] text-detail/[1.45] text-muted-foreground/80">{git.error}</p>
      </div>
    );
  }

  if (snap && !snap.repo) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
        <div className="rounded-glass-card border border-glass-border/50 bg-glass-hover/20 px-4 py-3">
          <p className="text-body/[1.4] font-medium text-foreground/85">No repository</p>
          <p className="mt-1 max-w-[18rem] text-detail/[1.45] text-muted-foreground/72">
            Initialize Git in this workspace to track changes and review diffs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => git.init()}
          className="rounded-glass-control border border-glass-border/60 bg-glass-active/40 px-3 py-2 text-body/[1.2] font-medium text-foreground transition-colors hover:bg-glass-hover"
        >
          Init Git
        </button>
      </div>
    );
  }

  if (snap && snap.repo && snap.clean) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-12 text-center">
        <p className="text-body/[1.4] font-medium text-foreground/85">Working tree clean</p>
        <p className="max-w-[18rem] text-detail/[1.45] text-muted-foreground/72">
          No staged or unstaged changes in this repository.
        </p>
      </div>
    );
  }

  const files = snap?.files ?? [];
  const selected = files.find((f) => f.id === git.selected) ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-[var(--glass-header-height)] shrink-0 items-center justify-end border-b border-glass-border/40 pl-3 pr-[calc(var(--glass-workbench-toggle-right)+var(--glass-workbench-changes-toggle-w))]">
        <div className="flex shrink-0 items-center gap-2">
          <SegmentedControl
            value={git.diffStyle}
            onChange={(v) => git.setDiffStyle(v as "unified" | "split")}
            options={[
              { value: "unified", label: "Unified" },
              { value: "split", label: "Split" },
            ]}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-b border-glass-border/30 px-3 py-2 text-detail/[1.2] text-muted-foreground/72">
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
                  "flex w-full items-center gap-2 rounded-glass-control px-2 py-1.5 text-left transition-colors",
                  file.id === git.selected
                    ? "bg-glass-active/60 text-foreground"
                    : "text-foreground/80 hover:bg-glass-hover/40",
                )}
              >
                <span className="min-w-0 flex-1 truncate text-body/[1.3] font-medium">
                  {displayName(file.path)}
                </span>
                <KindBadge state={file.state} />
                <div className="flex shrink-0 items-center gap-1 text-detail/[1]">
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-glass-border/40">
          <div className="flex h-7 shrink-0 items-center gap-2 border-b border-glass-border/30 px-3">
            <span className="truncate text-detail/[1.2] font-medium text-foreground/85">
              {displayName(selected.path)}
            </span>
            {selected.staged && <Badge>staged</Badge>}
            {selected.unstaged && <Badge>unstaged</Badge>}
          </div>
          <GlassDiffViewer
            fileDiff={git.patch}
            diffStyle={git.diffStyle}
            className="min-h-[120px] flex-1"
          />
        </div>
      )}
    </div>
  );
}
