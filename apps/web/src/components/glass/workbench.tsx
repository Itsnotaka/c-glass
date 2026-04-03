"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { IconCheckmark1Small } from "central-icons";
import { GlassAgentList } from "./glass-agent-list";
import { GlassChatSession } from "./glass-chat-session";
import { createSampleDiff, GlassDiffViewer } from "./diff-viewer";
import { usePiSummary } from "../../lib/pi-session-store";
import type { GlassSidebarSection } from "../../lib/glass-view-model";
import { cn } from "../../lib/utils";
import { ScrollArea } from "../ui/scroll-area";

interface DiffFile {
  id: string;
  name: string;
  path: string;
  type: "change" | "new" | "deleted" | "rename-pure" | "rename-changed";
  stats: {
    additions: number;
    deletions: number;
  };
}

interface Props {
  sessionId: string | null;
  sections: GlassSidebarSection[];
  selectedId: string | null;
  onSelectAgent: (id: string) => void;
  className?: string;
}

export function GlassWorkbench(props: Props) {
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffStyle, setDiffStyle] = useState<"unified" | "split">("split");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [leftWidth, setLeftWidth] = useState(256);
  const [rightWidth, setRightWidth] = useState(384);

  const diffs = useMemo(() => createSampleDiff(), []);

  const displayFiles = useMemo<DiffFile[]>(
    () =>
      diffs.map((file, i) => {
        const stat = file.hunks.reduce(
          (acc, hunk) =>
            hunk.hunkContent.reduce(
              (cur, row) => {
                if (row.type !== "change") return cur;
                return {
                  additions: cur.additions + row.additions,
                  deletions: cur.deletions + row.deletions,
                };
              },
              { additions: acc.additions, deletions: acc.deletions },
            ),
          { additions: 0, deletions: 0 },
        );

        return {
          id: String(i + 1),
          name: file.name.split("/").at(-1) ?? file.name,
          path: file.name,
          type: file.type,
          stats: stat,
        };
      }),
    [diffs],
  );

  useEffect(() => {
    if (selectedFileId || displayFiles.length === 0) return;
    setSelectedFileId(displayFiles[0]?.id ?? null);
  }, [displayFiles, selectedFileId]);

  const selectedFile = useMemo(
    () => displayFiles.find((f) => f.id === selectedFileId) ?? null,
    [displayFiles, selectedFileId],
  );

  const selectedDiff = useMemo(() => {
    if (!selectedFileId) return null;
    const idx = Number.parseInt(selectedFileId, 10) - 1;
    return diffs[idx] ?? null;
  }, [diffs, selectedFileId]);

  const handleSelectFile = useCallback((id: string) => {
    setSelectedFileId(id);
  }, []);

  const handleDiffStyleChange = useCallback((style: "unified" | "split") => {
    setDiffStyle(style);
  }, []);

  const toggleDiff = useCallback(() => {
    setDiffOpen((cur) => !cur);
  }, []);

  const session = usePiSummary(props.sessionId ?? "");

  const totalStats = useMemo(
    () => ({
      files: displayFiles.length,
      additions: displayFiles.reduce((acc, f) => acc + f.stats.additions, 0),
      deletions: displayFiles.reduce((acc, f) => acc + f.stats.deletions, 0),
    }),
    [displayFiles],
  );

  return (
    <div className={cn("relative flex h-full min-w-0", props.className)}>
      {/* Left panel - Agents */}
      <aside
        className="relative flex shrink-0 flex-col border-r border-glass-border/50 bg-glass-sidebar"
        style={{ width: leftWidth }}
      >
        {/* Sidebar header */}
        <div className="flex h-[var(--glass-header-height)] shrink-0 items-center justify-between border-b border-glass-border/40 px-3">
          <h2 className="text-[12px]/[1.2] font-semibold text-foreground/85">Agents</h2>
        </div>

        {/* Agent list */}
        <GlassAgentList
          sections={props.sections}
          selectedId={props.selectedId}
          onSelectAgent={props.onSelectAgent}
        />

        {/* Draggable resize handle */}
        <div
          className="absolute top-0 right-0 h-full w-1 cursor-col-resize"
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startWidth = leftWidth;

            const onMouseMove = (moveEvent: MouseEvent) => {
              const delta = moveEvent.clientX - startX;
              const newWidth = Math.min(400, Math.max(180, startWidth + delta));
              setLeftWidth(newWidth);
            };

            const onMouseUp = () => {
              document.removeEventListener("mousemove", onMouseMove);
              document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
          }}
        >
          <div className="h-full w-full hover:bg-muted-foreground/20" />
        </div>
      </aside>

      {/* Center - Chat + Composer */}
      <main className="flex min-w-0 flex-1 flex-col bg-glass-chat">
        {/* Top bar */}
        <div className="flex h-[var(--glass-header-height)] shrink-0 items-center justify-between border-b border-glass-border/40 bg-glass-menubar/60 px-4 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="text-[12px]/[1.2] font-medium text-foreground/85">
              {session?.name?.trim() || session?.firstMessage?.trim()?.slice(0, 30) || "New Chat"}
            </span>
          </div>

          {/* Toggle diff panel button */}
          <button
            type="button"
            onClick={toggleDiff}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px]/[1.2] font-medium transition-colors",
              diffOpen
                ? "bg-glass-active/60 text-foreground"
                : "text-muted-foreground/70 hover:bg-glass-hover hover:text-foreground",
            )}
          >
            <span>Changes</span>
            <span className="flex h-4 min-w-4 items-center justify-center rounded bg-muted-foreground/20 px-1 text-[10px]">
              {totalStats.files}
            </span>
          </button>
        </div>

        {/* Chat area */}
        {props.sessionId ? (
          <GlassChatSession sessionId={props.sessionId} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[12px]/[1.4] text-muted-foreground/60">
              Select an agent or start a new chat
            </p>
          </div>
        )}
      </main>

      {/* Right sidebar - Changes/Diff panel (collapsible) */}
      {diffOpen && (
        <aside
          className="relative flex shrink-0 flex-col border-l border-glass-border/50 bg-glass-surface"
          style={{ width: rightWidth }}
        >
          {/* Header */}
          <div className="flex h-[var(--glass-header-height)] shrink-0 items-center justify-between border-b border-glass-border/40 px-3">
            <h2 className="text-[12px]/[1.2] font-semibold text-foreground/85">Changes</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-glass-border/40 bg-glass-hover/15 p-0.5">
                <button
                  type="button"
                  onClick={() => handleDiffStyleChange("unified")}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px]/[1] font-medium transition-colors",
                    diffStyle === "unified"
                      ? "bg-glass-active/80 text-foreground"
                      : "text-muted-foreground/70 hover:text-foreground",
                  )}
                >
                  Unified
                </button>
                <button
                  type="button"
                  onClick={() => handleDiffStyleChange("split")}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px]/[1] font-medium transition-colors",
                    diffStyle === "split"
                      ? "bg-glass-active/80 text-foreground"
                      : "text-muted-foreground/70 hover:text-foreground",
                  )}
                >
                  Split
                </button>
              </div>
              <button
                type="button"
                onClick={toggleDiff}
                className="flex size-6 items-center justify-center rounded text-muted-foreground/70 hover:bg-glass-hover hover:text-foreground"
              >
                <IconCheckmark1Small className="size-4" />
              </button>
            </div>
          </div>

          {/* Stats summary */}
          <div className="flex shrink-0 items-center gap-3 border-b border-glass-border/30 px-3 py-1.5 text-[11px]/[1.2] text-muted-foreground/72">
            <span>{totalStats.files} files changed</span>
            <span className="text-[var(--glass-diff-addition)]">+{totalStats.additions}</span>
            <span className="text-[var(--glass-diff-deletion)]">-{totalStats.deletions}</span>
          </div>

          {/* File list */}
          <ScrollArea className="min-h-0 flex-1 px-2 py-2">
            <div className="flex flex-col gap-1">
              {displayFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => handleSelectFile(file.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                    file.id === selectedFileId
                      ? "bg-glass-active/60 text-foreground"
                      : "text-foreground/80 hover:bg-glass-hover/40",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-[12px]/[1.3] font-medium">
                    {file.name}
                  </span>
                  {file.type === "new" ? (
                    <span className="shrink-0 rounded border border-[var(--glass-diff-addition)]/40 bg-[var(--glass-diff-addition-bg)] px-1 py-0.5 text-[10px]/[1] font-medium text-[var(--glass-diff-addition)]">
                      new
                    </span>
                  ) : file.type === "deleted" ? (
                    <span className="shrink-0 rounded border border-[var(--glass-diff-deletion)]/40 bg-[var(--glass-diff-deletion-bg)] px-1 py-0.5 text-[10px]/[1] font-medium text-[var(--glass-diff-deletion)]">
                      deleted
                    </span>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1.5 text-[11px]/[1]">
                      {file.stats.additions > 0 && (
                        <span className="font-medium text-[var(--glass-diff-addition)]">
                          +{file.stats.additions}
                        </span>
                      )}
                      {file.stats.deletions > 0 && (
                        <span className="font-medium text-[var(--glass-diff-deletion)]">
                          -{file.stats.deletions}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Diff viewer */}
          {selectedFile && (
            <div className="min-h-0 flex-1 border-t border-glass-border/40">
              <div className="flex h-7 shrink-0 items-center gap-2 border-b border-glass-border/30 px-3">
                <span className="truncate text-[11px]/[1.2] font-medium text-foreground/85">
                  {selectedFile.name}
                </span>
              </div>
              <GlassDiffViewer
                fileDiff={selectedDiff}
                diffStyle={diffStyle}
                className="h-[calc(100%-1.75rem)]"
              />
            </div>
          )}

          {/* Draggable resize handle */}
          <div
            className="absolute top-0 left-0 h-full w-1 cursor-col-resize"
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startWidth = rightWidth;

              const onMouseMove = (moveEvent: MouseEvent) => {
                const delta = startX - moveEvent.clientX;
                const newWidth = Math.min(600, Math.max(280, startWidth + delta));
                setRightWidth(newWidth);
              };

              const onMouseUp = () => {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
              };

              document.addEventListener("mousemove", onMouseMove);
              document.addEventListener("mouseup", onMouseUp);
            }}
          >
            <div className="h-full w-full hover:bg-muted-foreground/20" />
          </div>
        </aside>
      )}
    </div>
  );
}
