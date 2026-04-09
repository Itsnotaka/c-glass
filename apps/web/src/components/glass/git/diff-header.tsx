"use client";

import type { GitFileState } from "@glass/contracts";
import { IconArrowRotateCounterClockwise, IconBarsThree, IconSplit } from "central-icons";
import { memo } from "react";

import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

const kindVariant: Record<
  GitFileState,
  "warning" | "addition" | "deletion" | "neutral" | "destructive"
> = {
  modified: "neutral",
  added: "addition",
  deleted: "deletion",
  renamed: "neutral",
  untracked: "warning",
  typechange: "neutral",
  conflicted: "destructive",
};

const kindLabel: Record<GitFileState, string> = {
  modified: "modified",
  added: "new",
  deleted: "deleted",
  renamed: "renamed",
  untracked: "untracked",
  typechange: "type",
  conflicted: "conflict",
};

const KindBadge = memo(function KindBadge(props: { state: GitFileState; className?: string }) {
  return (
    <Badge
      variant={kindVariant[props.state]}
      {...(props.className ? { className: props.className } : {})}
    >
      {kindLabel[props.state]}
    </Badge>
  );
});

function splitPath(path: string) {
  const idx = path.lastIndexOf("/");
  if (idx < 0) return { prefix: "", name: path };
  return { prefix: path.slice(0, idx + 1), name: path.slice(idx + 1) };
}

interface Props {
  path: string;
  state: GitFileState;
  add: number;
  del: number;
  diffStyle: "unified" | "split";
  onDiffStyleChange: (next: "unified" | "split") => void;
  viewed: boolean;
  onToggleViewed: () => void;
  onRevert: () => void;
  className?: string;
}

export const GlassDiffHeader = memo(function GlassDiffHeader(props: Props) {
  const { prefix, name } = splitPath(props.path);

  return (
    <div
      className={cn(
        "sticky top-0 z-[14] flex min-h-[22px] shrink-0 items-center gap-1 border-b border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] bg-glass-bubble/88 py-1 pr-3 pl-2.5 text-[12px] leading-4 backdrop-blur-xl",
        props.className,
      )}
    >
      <input
        type="checkbox"
        checked={props.viewed}
        onChange={props.onToggleViewed}
        className="size-3.5 shrink-0 rounded border-glass-border/60 accent-primary"
        aria-label="Mark as viewed"
      />

      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {prefix ? (
          <span className="min-w-0 flex-1 truncate text-left text-[11px] text-muted-foreground/40 direction-rtl">
            <span className="inline [unicode-bidi:embed] direction-ltr">{prefix}</span>
          </span>
        ) : null}
        <span className="shrink-0 text-[12px] font-medium text-foreground/90">{name}</span>
      </div>

      <KindBadge state={props.state} className="px-1 py-0 text-[11px] leading-4 font-medium" />

      <div className="flex shrink-0 items-center gap-0.5 tabular-nums">
        {props.add > 0 && (
          <span className="font-medium text-[var(--glass-diff-addition)]">+{props.add}</span>
        )}
        {props.del > 0 && (
          <span className="font-medium text-[var(--glass-diff-deletion)]">-{props.del}</span>
        )}
      </div>

      <div className="ml-1 flex shrink-0 items-center rounded-glass-control border border-glass-border/45 bg-glass-hover/14 p-0.5">
        <button
          type="button"
          onClick={() => props.onDiffStyleChange("unified")}
          className={cn(
            "flex size-6 items-center justify-center rounded-glass-control transition-colors",
            props.diffStyle === "unified"
              ? "bg-glass-active/60 text-foreground"
              : "text-muted-foreground/70 hover:bg-glass-hover hover:text-foreground",
          )}
          aria-label="Unified diff"
          aria-pressed={props.diffStyle === "unified"}
        >
          <IconBarsThree className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => props.onDiffStyleChange("split")}
          className={cn(
            "flex size-6 items-center justify-center rounded-glass-control transition-colors",
            props.diffStyle === "split"
              ? "bg-glass-active/60 text-foreground"
              : "text-muted-foreground/70 hover:bg-glass-hover hover:text-foreground",
          )}
          aria-label="Split diff"
          aria-pressed={props.diffStyle === "split"}
        >
          <IconSplit className="size-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={props.onRevert}
        className="flex size-7 shrink-0 items-center justify-center rounded-glass-control text-muted-foreground hover:bg-glass-hover hover:text-foreground"
        aria-label="Revert file"
      >
        <IconArrowRotateCounterClockwise className="size-4" />
      </button>
    </div>
  );
});
