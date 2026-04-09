"use client";

import type { GitFileState } from "@glass/contracts";
import {
  type DiffRow,
  type GlassGitPanelModel,
  useGlassDiffStylePreference,
} from "../../hooks/use-glass-git";
import { useGitViewed } from "../../hooks/use-glass-git-viewed";
import { isElectron } from "../../env";
import { cn } from "../../lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { GlassDiffHeader } from "./diff-header";
import { GlassDiffViewer } from "./diff-viewer";
import {
  IconArrowRotateCounterClockwise,
  IconChevronDownSmall,
  IconChevronRight,
  IconFileBend,
} from "central-icons";
import { memo, useCallback, useMemo, useState } from "react";

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
    <Badge
      variant={kindVariant[props.state] ?? "neutral"}
      className="px-1 py-0 text-[11px] leading-4 font-medium"
    >
      {kindLabel[props.state] ?? "modified"}
    </Badge>
  );
}

interface DirGroup {
  dir: string;
  files: DiffRow[];
}

function group(files: DiffRow[]): DirGroup[] {
  const map = new Map<string, DiffRow[]>();
  for (const file of files) {
    const idx = file.path.lastIndexOf("/");
    const dir = idx > 0 ? file.path.slice(0, idx) : "";
    const list = map.get(dir);
    if (list) {
      list.push(file);
    } else {
      map.set(dir, [file]);
    }
  }
  const out: DirGroup[] = [];
  for (const [dir, items] of map) {
    out.push({
      dir,
      files: items.toSorted((a, b) => a.path.localeCompare(b.path)),
    });
  }
  return out.toSorted((a, b) => a.dir.localeCompare(b.dir));
}

function split(path: string) {
  const idx = path.lastIndexOf("/");
  if (idx < 0) return { prefix: "", name: path };
  return { prefix: path.slice(0, idx + 1), name: path.slice(idx + 1) };
}

interface FileRowProps {
  file: DiffRow;
  selected: boolean;
  viewed: boolean;
  onSelect: () => void;
  onToggleViewed: () => void;
  onRevert: () => void;
}

export const GlassGitFileRow = memo(function GlassGitFileRow(props: FileRowProps) {
  const { prefix, name } = split(props.file.path);

  return (
    <div
      className={cn(
        "flex min-h-[22px] w-full items-center gap-1.5 rounded-glass-control px-1.5 py-1 text-[12px] leading-4 transition-colors duration-100",
        props.selected
          ? "bg-glass-active/44 text-foreground"
          : "hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]",
      )}
    >
      <input
        type="checkbox"
        checked={props.viewed}
        onChange={(e) => {
          e.stopPropagation();
          props.onToggleViewed();
        }}
        onClick={(e) => e.stopPropagation()}
        className="size-3.5 shrink-0 rounded border-glass-border/60 accent-primary"
        aria-label="Mark as viewed"
      />
      <button
        type="button"
        onClick={props.onSelect}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        <IconFileBend className="size-4 shrink-0 text-muted-foreground/50" />
        <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          {prefix ? (
            <span className="min-w-0 flex-1 truncate text-left text-[11px] text-muted-foreground/40 direction-rtl">
              <span className="inline [unicode-bidi:embed] direction-ltr">{prefix}</span>
            </span>
          ) : null}
          <span className="shrink-0 text-[12px] text-foreground">{name}</span>
        </span>
        <KindBadge state={props.file.state} />
        <div className="flex shrink-0 items-center gap-0.5 tabular-nums">
          {props.file.add > 0 && (
            <span className="font-medium text-[var(--glass-diff-addition)]">+{props.file.add}</span>
          )}
          {props.file.del > 0 && (
            <span className="font-medium text-[var(--glass-diff-deletion)]">-{props.file.del}</span>
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          props.onRevert();
        }}
        className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] hover:text-foreground"
        aria-label="Revert file"
      >
        <IconArrowRotateCounterClockwise className="size-4" />
      </button>
    </div>
  );
});

interface GroupHeaderProps {
  dir: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}

export const GlassGitGroupHeader = memo(function GlassGitGroupHeader(props: GroupHeaderProps) {
  return (
    <button
      type="button"
      onClick={props.onToggle}
      className="sticky top-0 z-[13] flex w-full cursor-pointer items-center gap-1.5 bg-glass-bubble/90 py-1 text-left backdrop-blur-xl"
    >
      <span className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground/60">
        {props.open ? (
          <IconChevronDownSmall className="size-3.5" />
        ) : (
          <IconChevronRight className="size-3.5" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium leading-[18px] text-foreground">
        {props.dir}
      </span>
      <span className="shrink-0 pr-0.5 text-[12px] text-muted-foreground/50">{props.count}</span>
    </button>
  );
});

interface TreeProps {
  groups: DirGroup[];
  selected: string | null;
  onSelect: (id: string) => void;
  viewed: (p: string) => boolean;
  onToggleViewed: (p: string) => void;
  onRevert: (file: DiffRow) => void;
}

function FileTree(props: TreeProps) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(props.groups.map((g) => g.dir)));

  const toggle = useCallback((dir: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) {
        next.delete(dir);
      } else {
        next.add(dir);
      }
      return next;
    });
  }, []);

  const flat = props.groups.length === 1 && props.groups[0]!.dir === "";

  return (
    <div className="flex flex-col gap-3">
      {props.groups.map((grp) => (
        <div key={grp.dir} className="isolate">
          {!flat && (
            <GlassGitGroupHeader
              dir={grp.dir || "."}
              count={grp.files.length}
              open={open.has(grp.dir)}
              onToggle={() => toggle(grp.dir)}
            />
          )}
          {(flat || open.has(grp.dir)) && (
            <div className={cn("flex flex-col", !flat && "pl-[18px]")}>
              {grp.files.map((file) => (
                <GlassGitFileRow
                  key={file.id}
                  file={file}
                  selected={props.selected === file.id}
                  viewed={props.viewed(file.path)}
                  onSelect={() => props.onSelect(file.id)}
                  onToggleViewed={() => props.onToggleViewed(file.path)}
                  onRevert={() => props.onRevert(file)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DiscardDialog(props: {
  open: boolean;
  path: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup className="max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Discard changes?</DialogTitle>
          <DialogDescription>
            Revert <span className="font-mono text-foreground/90">{props.path}</span> to the last
            committed version. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              props.onConfirm();
              props.onOpenChange(false);
            }}
          >
            Discard
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

export function GlassGitPanel(props: { git: GlassGitPanelModel }) {
  const git = props.git;

  if (!isElectron) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <p className="text-body/[1.4] font-medium text-foreground/85">Source control</p>
        <p className="max-w-[18rem] text-detail/[1.45] text-muted-foreground/72">
          Git status and diffs are available in the Glass desktop app.
        </p>
      </div>
    );
  }

  if (!git.snap && !git.error) {
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
        <div className="space-y-1 px-4 py-3">
          <p className="text-body/[1.4] font-medium text-foreground/85">No repository</p>
          <p className="max-w-[18rem] text-detail/[1.45] text-muted-foreground/72">
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

  return <GitPanelInner git={git} />;
}

function GitPanelInner(props: { git: GlassGitPanelModel }) {
  const git = props.git;
  const files = git.rows;
  const groups = useMemo(() => group(files), [files]);
  const root = git.snap?.gitRoot ?? null;
  const viewed = useGitViewed(root);
  const [diffStyle, setDiffStyle] = useGlassDiffStylePreference();
  const [pending, setPending] = useState<DiffRow | null>(null);

  const selectedRow = useMemo(
    () => (git.selected ? (files.find((row) => row.id === git.selected) ?? null) : null),
    [files, git.selected],
  );

  const onRevert = useCallback((file: DiffRow) => {
    setPending(file);
  }, []);

  const confirmDiscard = useCallback(() => {
    if (!pending) return;
    void git.discard([pending.path]);
    setPending(null);
  }, [git, pending]);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col py-3 pl-8" data-glass-review-panel>
      <div
        className={cn(
          "flex w-full min-w-0 shrink-0 flex-wrap items-center gap-2 pt-4 pb-3 text-[13px] font-medium leading-[18px] text-muted-foreground",
          isElectron
            ? "pr-[calc(var(--glass-workbench-toggle-right)+var(--glass-workbench-changes-toggle-w))]"
            : "pr-8",
        )}
      >
        <span className="min-w-0 truncate text-foreground/90">
          {files.length} file{files.length === 1 ? "" : "s"} changed
        </span>
        {git.totalAdd > 0 && (
          <span className="tabular-nums text-[var(--glass-diff-addition)]">+{git.totalAdd}</span>
        )}
        {git.totalDel > 0 && (
          <span className="tabular-nums text-[var(--glass-diff-deletion)]">-{git.totalDel}</span>
        )}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pr-8">
        <div className="flex min-h-0 max-h-[min(18rem,42vh)] shrink-0 flex-col overflow-hidden border-b border-[color-mix(in_srgb,var(--foreground)_6%,transparent)]">
          <div className="glass-review-changes-list min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5 [scrollbar-gutter:stable]">
            <FileTree
              groups={groups}
              selected={git.selected}
              onSelect={git.setSelected}
              viewed={viewed.isViewed}
              onToggleViewed={viewed.toggleViewed}
              onRevert={onRevert}
            />
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {selectedRow ? (
            <>
              <GlassDiffHeader
                path={selectedRow.path}
                state={selectedRow.state}
                add={selectedRow.add}
                del={selectedRow.del}
                diffStyle={diffStyle}
                onDiffStyleChange={setDiffStyle}
                viewed={viewed.isViewed(selectedRow.path)}
                onToggleViewed={() => viewed.toggleViewed(selectedRow.path)}
                onRevert={() => setPending(selectedRow)}
                className="shrink-0"
              />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {git.fileDiffLoading ? (
                  <div className="flex flex-1 flex-col gap-2 px-3 py-3">
                    <div className="h-3 w-full max-w-[14rem] animate-pulse rounded bg-muted/35" />
                    <div className="h-3 w-full animate-pulse rounded bg-muted/28" />
                    <div className="h-3 w-[92%] animate-pulse rounded bg-muted/28" />
                    <div className="h-3 w-full animate-pulse rounded bg-muted/22" />
                  </div>
                ) : git.fileDiffError ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-6 text-center">
                    <p className="text-body text-destructive/90">{git.fileDiffError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void git.refresh()}
                    >
                      Retry
                    </Button>
                  </div>
                ) : (
                  <GlassDiffViewer
                    fileDiff={git.fileDiff}
                    filePatch={git.filePatch}
                    path={selectedRow.path}
                    state={selectedRow.state}
                    prevPath={selectedRow.prevPath}
                    diffStyle={diffStyle}
                    className="min-h-0 flex-1 px-3 pb-3 pt-2"
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-4">
              <p className="text-body text-muted-foreground/60">Select a file to view changes</p>
            </div>
          )}
        </div>
      </div>

      <DiscardDialog
        open={pending !== null}
        path={pending?.path ?? ""}
        onConfirm={confirmDiscard}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      />
    </div>
  );
}
