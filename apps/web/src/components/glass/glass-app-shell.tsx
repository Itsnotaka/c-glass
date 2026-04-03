"use client";

import { IconSidebar, IconSidebarHiddenLeftWide, IconSidebarHiddenRightWide } from "central-icons";
import type { ReactNode } from "react";

import { isElectron } from "../../env";
import { useIsMobile } from "../../hooks/use-media-query";
import { cn } from "../../lib/utils";
import { GlassWorkspacePicker } from "./glass-workspace-picker";
import { Sheet, SheetDescription, SheetHeader, SheetPopup, SheetTitle } from "../ui/sheet";

export function GlassAppShell(props: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  title: string;
  changesCount: number;
  panels: {
    leftOpen: boolean;
    rightOpen: boolean;
    setLeftOpen: (open: boolean) => void;
    setRightOpen: (open: boolean) => void;
    leftW: number;
    rightW: number;
    toggleLeft: () => void;
    toggleRight: () => void;
    setLeftWidth: (n: number) => void;
    setRightWidth: (n: number) => void;
  };
}) {
  const p = props.panels;
  const mobile = useIsMobile();

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col bg-glass-editor">
      <header
        className={cn(
          "flex shrink-0 flex-col border-b border-glass-border/50 bg-glass-menubar/60 backdrop-blur-xl",
          isElectron && "drag-region",
        )}
      >
        <div className="flex h-[var(--glass-header-height)] items-center justify-between gap-2 px-2 md:px-3">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (mobile) p.setLeftOpen(!p.leftOpen);
                else p.toggleLeft();
              }}
              className="no-drag flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-glass-hover hover:text-foreground"
              aria-label={p.leftOpen ? "Collapse threads" : "Expand threads"}
            >
              {p.leftOpen ? (
                <IconSidebarHiddenLeftWide className="size-4" />
              ) : (
                <IconSidebar className="size-4" />
              )}
            </button>
            {isElectron && !mobile ? (
              <div className="no-drag hidden min-w-0 flex-1 justify-center md:flex">
                <GlassWorkspacePicker />
              </div>
            ) : null}
          </div>

          <div className="no-drag min-w-0 max-w-[min(56vw,28rem)] px-2">
            <span className="block truncate text-center text-[12px]/[1.2] font-medium text-foreground/85">
              {props.title}
            </span>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                if (mobile) p.setRightOpen(!p.rightOpen);
                else p.toggleRight();
              }}
              className={cn(
                "no-drag flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px]/[1.2] font-medium transition-colors",
                p.rightOpen
                  ? "bg-glass-active/60 text-foreground"
                  : "text-muted-foreground/70 hover:bg-glass-hover hover:text-foreground",
              )}
            >
              <span>Changes</span>
              <span className="flex h-4 min-w-4 items-center justify-center rounded bg-muted-foreground/20 px-1 text-[10px]">
                {props.changesCount}
              </span>
              {p.rightOpen ? (
                <IconSidebarHiddenRightWide className="size-4 opacity-60" />
              ) : (
                <IconSidebar className="size-4 opacity-60" />
              )}
            </button>
          </div>
        </div>

        {isElectron && mobile ? (
          <div className="no-drag flex items-center justify-center border-t border-glass-border/40 px-3 py-1.5">
            <GlassWorkspacePicker />
          </div>
        ) : null}
      </header>

      <div className="relative flex min-h-0 flex-1">
        {mobile ? (
          <Sheet open={p.leftOpen} onOpenChange={p.setLeftOpen}>
            <SheetPopup
              side="left"
              className="w-[min(100vw-12px,20rem)] border-glass-border bg-glass-sidebar p-0"
              showCloseButton={false}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Threads</SheetTitle>
                <SheetDescription>Workspace threads and agents.</SheetDescription>
              </SheetHeader>
              <div className="flex h-full min-h-0 flex-col overflow-hidden">{props.left}</div>
            </SheetPopup>
          </Sheet>
        ) : null}

        {!mobile ? (
          <aside
            className="relative flex shrink-0 flex-col overflow-hidden border-glass-border/50 bg-glass-sidebar transition-[width] duration-150 ease-out"
            style={{
              width: p.leftOpen ? p.leftW : 0,
              borderRightWidth: p.leftOpen ? 1 : 0,
            }}
          >
            <div
              aria-hidden={!p.leftOpen}
              className="flex h-full min-h-0 flex-col"
              style={{ width: p.leftW }}
            >
              {props.left}
            </div>
            {p.leftOpen ? (
              <div
                className="absolute top-0 right-0 z-10 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startW = p.leftW;
                  const onMove = (ev: MouseEvent) => {
                    p.setLeftWidth(startW + (ev.clientX - startX));
                  };
                  const onUp = () => {
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                  };
                  document.addEventListener("mousemove", onMove);
                  document.addEventListener("mouseup", onUp);
                }}
              >
                <div className="h-full w-full hover:bg-muted-foreground/20" />
              </div>
            ) : null}
          </aside>
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col bg-glass-chat">{props.center}</main>

        {mobile ? (
          <Sheet open={p.rightOpen} onOpenChange={p.setRightOpen}>
            <SheetPopup
              side="right"
              className="w-[min(100vw-12px,28rem)] border-glass-border bg-glass-surface p-0"
              showCloseButton={false}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Changes</SheetTitle>
                <SheetDescription>Git diff and file list.</SheetDescription>
              </SheetHeader>
              <div className="flex h-full min-h-0 flex-col overflow-hidden">{props.right}</div>
            </SheetPopup>
          </Sheet>
        ) : null}

        {!mobile ? (
          <aside
            className="relative flex shrink-0 flex-col overflow-hidden border-glass-border/50 bg-glass-surface transition-[width] duration-150 ease-out"
            style={{
              width: p.rightOpen ? p.rightW : 0,
              borderLeftWidth: p.rightOpen ? 1 : 0,
            }}
          >
            <div
              aria-hidden={!p.rightOpen}
              className="flex h-full min-h-0 flex-col"
              style={{ width: p.rightW }}
            >
              {props.right}
            </div>
            {p.rightOpen ? (
              <div
                className="absolute top-0 left-0 z-10 h-full w-1 cursor-col-resize"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startW = p.rightW;
                  const onMove = (ev: MouseEvent) => {
                    p.setRightWidth(startW + (startX - ev.clientX));
                  };
                  const onUp = () => {
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                  };
                  document.addEventListener("mousemove", onMove);
                  document.addEventListener("mouseup", onUp);
                }}
              >
                <div className="h-full w-full hover:bg-muted-foreground/20" />
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
