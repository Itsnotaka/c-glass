import type { ThreadId } from "@glass/contracts";
import { IconBell, IconFormCircle } from "central-icons";
import { type KeyboardEvent, memo, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { GlassThreadContextMenu } from "~/components/glass/sidebar/thread-context-menu";
import { GlassRowButton } from "~/components/glass/shared/row-button";
import { useThreadActions } from "~/hooks/use-thread-actions";
import type { GlassSidebarChat } from "~/lib/glass-view-model";
import { useGlassThreadUnreadStore } from "~/lib/glass-thread-unread-store";
import { cn } from "~/lib/utils";

function StatusDot(props: { item: GlassSidebarChat }) {
  if (props.item.kind === "draft") {
    return <IconFormCircle className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />;
  }
  if (props.item.state === "running") {
    return (
      <span className="relative flex size-3 shrink-0 items-center justify-center">
        <span className="absolute size-2 animate-ping rounded-full bg-emerald-500/40" />
        <span className="size-2 rounded-full bg-emerald-500" />
      </span>
    );
  }
  if (props.item.state === "error") {
    return <span className="size-2 shrink-0 rounded-full bg-destructive/80" aria-hidden />;
  }
  if (props.item.kind === "thread" && props.item.unread) {
    return <IconBell className="size-3.5 shrink-0 text-muted-foreground/55" aria-hidden />;
  }
  return <span className="size-2 shrink-0 rounded-full bg-muted-foreground/45" aria-hidden />;
}

export const GlassAgentRow = memo(
  function GlassAgentRow(props: {
    item: GlassSidebarChat;
    selected: boolean;
    onSelectAgent: (id: string) => void;
  }) {
    const { commitRename, archiveThread } = useThreadActions();
    const mark = useGlassThreadUnreadStore((s) => s.mark);
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState("");
    const inputRef = useRef<HTMLInputElement | null>(null);
    const committedRef = useRef(false);

    useEffect(() => {
      if (!renaming) return;
      const node = inputRef.current;
      if (!node) return;
      node.focus();
      node.select();
    }, [renaming]);

    const finishRename = useCallback(() => {
      setRenaming(false);
      committedRef.current = false;
    }, []);

    const applyRename = useCallback(async () => {
      if (props.item.kind !== "thread") return;
      const next = renameValue.trim();
      if (next.length === 0) {
        toast.warning("Thread title cannot be empty");
        finishRename();
        return;
      }
      if (next === props.item.title) {
        finishRename();
        return;
      }
      await commitRename(props.item.id as ThreadId, next, props.item.title);
      finishRename();
    }, [commitRename, finishRename, props.item, renameValue]);

    const onBlur = useCallback(() => {
      if (props.item.kind !== "thread") return;
      if (committedRef.current) {
        committedRef.current = false;
        return;
      }
      void applyRename();
    }, [applyRename, props.item.kind]);

    const onRenameKeyDown = useCallback(
      (event: KeyboardEvent) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          committedRef.current = true;
          void applyRename();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          committedRef.current = true;
          finishRename();
        }
      },
      [applyRename, finishRename],
    );

    if (props.item.kind === "draft") {
      return (
        <GlassRowButton
          variant="agent"
          data-selected={props.selected}
          data-chat-item=""
          onClick={() => props.onSelectAgent(props.item.id)}
        >
          <StatusDot item={props.item} />
          <span className="min-w-0 flex-1 truncate">{props.item.title}</span>
          <span className="shrink-0 text-detail text-muted-foreground/50">{props.item.ago}</span>
        </GlassRowButton>
      );
    }

    return (
      <GlassThreadContextMenu
        onRename={() => {
          setRenaming(true);
          setRenameValue(props.item.title);
        }}
        onMarkUnread={() => {
          mark(props.item.id);
        }}
        onArchive={() => {
          void archiveThread(props.item.id as ThreadId);
        }}
      >
        {renaming ? (
          <div
            className={cn(
              "font-glass flex min-h-7.5 w-full min-w-0 items-center gap-2 rounded-glass-control border border-transparent px-2 py-1 text-left text-body/[18px]",
              "border-glass-stroke-strong bg-glass-active",
            )}
          >
            <StatusDot item={props.item} />
            <input
              ref={inputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={onRenameKeyDown}
              onBlur={onBlur}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 bg-transparent text-body/[18px] text-foreground outline-none ring-0"
              aria-label="Rename thread"
            />
            <span className="shrink-0 text-detail text-muted-foreground/50">{props.item.ago}</span>
          </div>
        ) : (
          <GlassRowButton
            variant="agent"
            data-selected={props.selected}
            data-chat-item=""
            onClick={() => props.onSelectAgent(props.item.id)}
          >
            <StatusDot item={props.item} />
            <span className="min-w-0 flex-1 truncate">{props.item.title}</span>
            <span className="shrink-0 text-detail text-muted-foreground/50">{props.item.ago}</span>
          </GlassRowButton>
        )}
      </GlassThreadContextMenu>
    );
  },
  (left, right) =>
    left.item === right.item &&
    left.selected === right.selected &&
    left.onSelectAgent === right.onSelectAgent,
);
