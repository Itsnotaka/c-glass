"use client";

import type { GitFileState } from "@glass/contracts";
import type { DiffRow, GlassGitPanelModel } from "../../hooks/use-glass-git";
import { useGitViewed } from "../../hooks/use-glass-git-viewed";
import { isElectron } from "../../env";
import { readGlass } from "../../host";
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
import { ScrollArea } from "~/components/ui/scroll-area";
import { SegmentedControl } from "~/components/ui/segmented-control";
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
    <Badge variant={kindVariant[props.state] ?? "neutral"}>
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

const FileRow = memo(function FileRow(props: FileRowProps) {
  const { prefix, name } = split(props.file.path);

  return (
    <div
      className={cn(
        "flex w-full items-center gap-1 rounded-glass-control p-1 transition-colors duration-75",
        props.selected ? "bg-glass-active/50" : "hover:bg-glass-hover/40",
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
        className="flex min-w-0 flex-1 items-center gap-1 text-left"
      >
        <IconFileBend className="size-4 shrink-0 text-muted-foreground/50" />
        <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          {prefix ? (
            <span className="min-w-0 flex-1 truncate text-detail text-muted-foreground/40 direction-rtl text-left">
              {prefix}
            </span>
          ) : null}
          <span className="shrink-0 text-body font-medium">{name}</span>
        </span>
        <KindBadge state={props.file.state} />
        <div className="flex shrink-0 items-center gap-1 text-detail/[1]">
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
        className="flex size-7 shrink-0 items-center justify-center rounded-glass-control text-muted-foreground hover:bg-glass-hover hover:text-foreground"
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

const GroupHeader = memo(function GroupHeader(props: GroupHeaderProps) {
  return (
    <button
      type="button"
      onClick={props.onToggle}
      className="sticky top-0 z-[13] flex w-full items-center gap-1 bg-glass-surface/95 py-1 text-left backdrop-blur-sm"
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground/50">
        {props.open ? (
          <IconChevronDownSmall className="size-3.5" />
        ) : (
          <IconChevronRight className="size-3.5" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-body font-medium">{props.dir}</span>
      <span className="pr-1 text-detail text-muted-foreground/40">{props.count}</span>
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
    <div className="flex flex-col">
      {props.groups.map((grp) => (
        <div key={grp.dir} className="isolate">
          {!flat && (
            <GroupHeader
              dir={grp.dir || "."}
              count={grp.files.length}
              open={open.has(grp.dir)}
              onToggle={() => toggle(grp.dir)}
            />
          )}
          {(flat || open.has(grp.dir)) && (
            <div className={cn("flex flex-col gap-1", !flat && "pl-[18px]")}>
              {grp.files.map((file) => (
                <FileRow
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

  return <GitPanelInner git={git} />;
}

function GitPanelInner(props: { git: GlassGitPanelModel }) {
  const git = props.git;
  const files = git.rows;
  const groups = useMemo(() => group(files), [files]);
  const root = git.snap?.gitRoot ?? null;
  const viewed = useGitViewed(root);
  const [pending, setPending] = useState<DiffRow | null>(null);

  const headerPad = isElectron
    ? "pr-[calc(var(--glass-workbench-toggle-right)+var(--glass-workbench-changes-toggle-w))]"
    : "";

  const onRevert = useCallback((file: DiffRow) => {
    setPending(file);
  }, []);

  const confirmDiscard = useCallback(() => {
    if (!pending) return;
    void git.discard([pending.path]);
    setPending(null);
  }, [git, pending]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "flex h-[var(--glass-header-height)] shrink-0 items-center justify-between border-b border-glass-border/40 px-3",
          headerPad,
        )}
      >
        <div className="flex min-w-0 items-center gap-3 text-detail/[1.2] text-muted-foreground/72">
          <span className="truncate">
            {files.length} file{files.length === 1 ? "" : "s"} changed
          </span>
          {git.totalAdd > 0 && (
            <span className="text-[var(--glass-diff-addition)]">+{git.totalAdd}</span>
          )}
          {git.totalDel > 0 && (
            <span className="text-[var(--glass-diff-deletion)]">-{git.totalDel}</span>
          )}
        </div>
        <SegmentedControl
          value={git.diffStyle}
          onChange={(v) => git.setDiffStyle(v as "unified" | "split")}
          options={[
            { value: "unified", label: "Stacked" },
            { value: "split", label: "Split" },
          ]}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-row">
        <ScrollArea className="w-[min(260px,42%)] shrink-0 border-glass-border/40 border-r">
          <div className="p-2">
            <FileTree
              groups={groups}
              selected={git.selected}
              onSelect={git.setSelected}
              viewed={viewed.isViewed}
              onToggleViewed={viewed.toggleViewed}
              onRevert={onRevert}
            />
          </div>
        </ScrollArea>

        <div className="diff-panel-viewport min-h-0 min-w-0 flex-1 overflow-hidden">
          {git.patch ? (
            <GlassDiffViewer
              fileDiff={git.patch}
              diffStyle={git.diffStyle}
              className="h-full min-h-0"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4">
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
