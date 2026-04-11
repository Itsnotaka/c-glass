"use client";

import type { GitFileState } from "@glass/contracts";
import {
  IconArrowRotateCounterClockwise,
  IconBarsThree,
  IconChevronBottom,
  IconChevronRight,
  IconClipboard,
  IconDotGrid1x3Horizontal,
  IconBranch,
  IconSplit,
} from "central-icons";
import { memo, useCallback, useState } from "react";
import { toast } from "sonner";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Collapsible } from "~/components/ui/collapsible";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { isElectron } from "~/env";
import {
  type DiffRow,
  type GlassGitPanelModel,
  useGlassDiffStylePreference,
} from "~/hooks/use-glass-git";
import { useGitViewed } from "~/hooks/use-glass-git-viewed";
import { cn } from "~/lib/utils";
import { VsFileIcon } from "~/lib/vscode-file-icon";
import { BranchCommitDialog, CommitDialog } from "./commit-dialog";
import { GlassDiffViewer } from "./diff-viewer";

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
  const variant = kindVariant[props.state];
  if (!variant) return null;
  return (
    <Badge variant={variant} className="px-1 py-0 text-[11px] leading-4 font-medium">
      {kindLabel[props.state] ?? props.state}
    </Badge>
  );
}

function splitPath(path: string) {
  const idx = path.lastIndexOf("/");
  if (idx < 0) return { prefix: "", name: path };
  return { prefix: path.slice(0, idx + 1), name: path.slice(idx + 1) };
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

  if (git.error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <p className="text-body/[1.4] font-medium text-destructive/90">Git error</p>
        <p className="max-w-[20rem] text-detail/[1.45] text-muted-foreground/80">{git.error}</p>
      </div>
    );
  }

  const snap = git.snap;

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
  const root = git.snap?.gitRoot ?? null;
  const viewed = useGitViewed(root);
  const [diffStyle, setDiffStyle] = useGlassDiffStylePreference();
  const [pending, setPending] = useState<DiffRow | null>(null);
  const [commitOpen, setCommitOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const confirmDiscard = useCallback(() => {
    if (!pending) return;
    void git.discard([pending.path]);
    setPending(null);
  }, [git, pending]);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <LocalBranchBar branch={git.branch} onBranchCommit={() => setBranchOpen(true)} />
      <ChangesHeader
        count={files.length}
        add={git.totalAdd}
        del={git.totalDel}
        onExpandAll={git.expandAll}
        onCollapseAll={git.collapseAll}
        diffStyle={diffStyle}
        onDiffStyle={setDiffStyle}
        menuOpen={menuOpen}
        onMenuOpen={setMenuOpen}
        onCommit={() => setCommitOpen(true)}
        onPush={() =>
          void git
            .runPush()
            .then(() => toast.success("Pushed"))
            .catch((e: unknown) => toast.error(e instanceof Error ? e.message : String(e)))
        }
        onRefresh={() => void git.refresh()}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2 pb-3 [scrollbar-gutter:stable]">
        <div className="flex flex-col gap-1">
          {files.map((file) => (
            <GitFileCard
              key={file.id}
              file={file}
              expanded={git.expandedIds.has(file.id)}
              onToggle={() => git.toggleExpand(file.id)}
              diff={git.diffsByPath.get(file.id) ?? null}
              patch={git.patchesByPath.get(file.id) ?? null}
              loading={git.diffLoadingByPath.has(file.id)}
              error={git.diffErrorByPath.get(file.id) ?? null}
              diffStyle={diffStyle}
              viewed={viewed.isViewed(file.path)}
              onToggleViewed={() => viewed.toggleViewed(file.path)}
              onRevert={() => setPending(file)}
            />
          ))}
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
      <CommitDialog open={commitOpen} onOpenChange={setCommitOpen} onCommit={git.runCommit} />
      <BranchCommitDialog
        open={branchOpen}
        onOpenChange={setBranchOpen}
        onCommit={git.runBranchCommit}
      />
    </div>
  );
}

function LocalBranchBar(props: { branch: string | null; onBranchCommit: () => void }) {
  const copyBranch = () => {
    if (!props.branch) return;
    void navigator.clipboard.writeText(props.branch);
    toast.success("Branch name copied");
  };

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-glass-border/30 px-3 py-2">
      <IconBranch className="size-3.5 shrink-0 text-muted-foreground/60" />
      <button
        type="button"
        onClick={copyBranch}
        className="flex min-w-0 items-center gap-1 text-[12px] leading-4 font-medium text-foreground/90 hover:text-foreground"
        title="Copy branch name"
      >
        <span className="truncate font-mono">{props.branch ?? "detached"}</span>
      </button>
      <div className="flex-1" />
      <Button type="button" size="sm" onClick={props.onBranchCommit}>
        Create Branch & Commit
      </Button>
    </div>
  );
}

function ChangesHeader(props: {
  count: number;
  add: number;
  del: number;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  diffStyle: "unified" | "split";
  onDiffStyle: (next: "unified" | "split") => void;
  menuOpen: boolean;
  onMenuOpen: (open: boolean) => void;
  onCommit: () => void;
  onPush: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-3 py-2 text-[12px] leading-4">
      <span className="min-w-0 truncate font-medium text-foreground/90">
        {props.count} file{props.count === 1 ? "" : "s"} changed
      </span>
      {props.add > 0 && (
        <span className="tabular-nums font-medium text-[var(--glass-diff-addition)]">
          +{props.add}
        </span>
      )}
      {props.del > 0 && (
        <span className="tabular-nums font-medium text-[var(--glass-diff-deletion)]">
          -{props.del}
        </span>
      )}
      <div className="flex-1" />
      <DiffStyleToggle style={props.diffStyle} onChange={props.onDiffStyle} />
      <OverflowMenu
        open={props.menuOpen}
        onOpenChange={props.onMenuOpen}
        onExpandAll={props.onExpandAll}
        onCollapseAll={props.onCollapseAll}
        onCommit={props.onCommit}
        onPush={props.onPush}
        onRefresh={props.onRefresh}
      />
    </div>
  );
}

function DiffStyleToggle(props: {
  style: "unified" | "split";
  onChange: (next: "unified" | "split") => void;
}) {
  return (
    <div className="flex shrink-0 items-center rounded-glass-control border border-glass-border/45 bg-glass-hover/14 p-0.5">
      <button
        type="button"
        onClick={() => props.onChange("unified")}
        className={cn(
          "flex size-5 items-center justify-center rounded-glass-control transition-colors",
          props.style === "unified"
            ? "bg-glass-active/60 text-foreground"
            : "text-muted-foreground/70 hover:bg-glass-hover hover:text-foreground",
        )}
        aria-label="Unified diff"
        aria-pressed={props.style === "unified"}
      >
        <IconBarsThree className="size-3" />
      </button>
      <button
        type="button"
        onClick={() => props.onChange("split")}
        className={cn(
          "flex size-5 items-center justify-center rounded-glass-control transition-colors",
          props.style === "split"
            ? "bg-glass-active/60 text-foreground"
            : "text-muted-foreground/70 hover:bg-glass-hover hover:text-foreground",
        )}
        aria-label="Split diff"
        aria-pressed={props.style === "split"}
      >
        <IconSplit className="size-3" />
      </button>
    </div>
  );
}

function OverflowMenu(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onCommit: () => void;
  onPush: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => props.onOpenChange(!props.open)}
        className="flex size-6 items-center justify-center rounded-glass-control text-muted-foreground/70 hover:bg-glass-hover hover:text-foreground"
        aria-label="Git actions"
      >
        <IconDotGrid1x3Horizontal className="size-3.5" />
      </button>
      {props.open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => props.onOpenChange(false)} />
          <div className="absolute top-full right-0 z-50 mt-1 min-w-[160px] rounded-glass-card border border-glass-stroke bg-glass-bubble p-1 text-[12px] leading-4 shadow-glass-popup backdrop-blur-xl">
            <MenuItem
              label="Expand All"
              onClick={() => {
                props.onExpandAll();
                props.onOpenChange(false);
              }}
            />
            <MenuItem
              label="Collapse All"
              onClick={() => {
                props.onCollapseAll();
                props.onOpenChange(false);
              }}
            />
            <MenuItem
              label="Refresh Changes"
              onClick={() => {
                props.onRefresh();
                props.onOpenChange(false);
              }}
            />
            <div className="my-1 h-px bg-glass-border/30" />
            <MenuItem
              label="Commit..."
              onClick={() => {
                props.onCommit();
                props.onOpenChange(false);
              }}
            />
            <MenuItem
              label="Push"
              onClick={() => {
                props.onPush();
                props.onOpenChange(false);
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuItem(props: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="flex w-full items-center rounded-sm px-2 py-1 text-left text-foreground/82 transition-colors hover:bg-glass-active hover:text-foreground"
    >
      {props.label}
    </button>
  );
}

interface CardProps {
  file: DiffRow;
  expanded: boolean;
  onToggle: () => void;
  diff: import("@pierre/diffs").FileDiffMetadata | null;
  patch: string | null;
  loading: boolean;
  error: string | null;
  diffStyle: "unified" | "split";
  viewed: boolean;
  onToggleViewed: () => void;
  onRevert: () => void;
}

const GitFileCard = memo(function GitFileCard(props: CardProps) {
  const { prefix, name } = splitPath(props.file.path);

  const copyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(props.file.path);
    toast.success("Path copied");
  };

  return (
    <Collapsible.Root open={props.expanded} onOpenChange={props.onToggle}>
      <div className="overflow-hidden rounded-glass-card border border-glass-border/30 bg-glass-bubble/40">
        <Collapsible.Trigger className="flex w-full items-center gap-1.5 px-2 py-1.5 text-[12px] leading-4 text-left transition-colors hover:bg-glass-hover/30">
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
          <VsFileIcon path={props.file.path} className="size-3.5 shrink-0" />
          <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {prefix ? (
              <span className="min-w-0 flex-1 truncate text-left text-[11px] text-muted-foreground/40 direction-rtl">
                <span className="inline [unicode-bidi:embed] direction-ltr">{prefix}</span>
              </span>
            ) : null}
            <span className="shrink-0 font-medium text-foreground">{name}</span>
          </span>
          <button
            type="button"
            onClick={copyPath}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground [div:hover>&]:opacity-100"
            aria-label="Copy path"
          >
            <IconClipboard className="size-3" />
          </button>
          <div className="flex shrink-0 items-center gap-0.5 tabular-nums">
            {props.file.add > 0 && (
              <span className="font-medium text-[var(--glass-diff-addition)]">
                +{props.file.add}
              </span>
            )}
            {props.file.del > 0 && (
              <span className="font-medium text-[var(--glass-diff-deletion)]">
                -{props.file.del}
              </span>
            )}
          </div>
          <KindBadge state={props.file.state} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              props.onRevert();
            }}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/50 hover:bg-glass-hover hover:text-foreground"
            aria-label="Revert file"
          >
            <IconArrowRotateCounterClockwise className="size-3" />
          </button>
          <span className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground/60">
            {props.expanded ? (
              <IconChevronBottom className="size-3" />
            ) : (
              <IconChevronRight className="size-3" />
            )}
          </span>
        </Collapsible.Trigger>
        <Collapsible.Panel>
          <div className="border-t border-glass-border/20">
            {props.loading ? (
              <div className="flex flex-col gap-2 px-3 py-3">
                <div className="h-3 w-full max-w-[14rem] animate-pulse rounded bg-muted/35" />
                <div className="h-3 w-full animate-pulse rounded bg-muted/28" />
                <div className="h-3 w-[92%] animate-pulse rounded bg-muted/28" />
              </div>
            ) : props.error ? (
              <div className="px-3 py-3 text-detail text-destructive/90">{props.error}</div>
            ) : (
              <GlassDiffViewer
                fileDiff={props.diff}
                filePatch={props.patch}
                path={props.file.path}
                state={props.file.state}
                prevPath={props.file.prevPath}
                diffStyle={props.diffStyle}
                className="max-h-[min(60vh,32rem)] overflow-auto"
              />
            )}
          </div>
        </Collapsible.Panel>
      </div>
    </Collapsible.Root>
  );
});

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
