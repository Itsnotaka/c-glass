"use client";

import { IconSidebar, IconSidebarHiddenLeftWide, IconSidebarHiddenRightWide } from "central-icons";
import type { ReactNode } from "react";

import { isElectron } from "../../env";
import { useIsMobile } from "../../hooks/use-media-query";
import { cn } from "../../lib/utils";
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

  const stackHeader = (
    <header
      className={cn(
        "flex shrink-0 flex-col bg-glass-menubar/60 backdrop-blur-xl",
        isElectron && "drag-region",
      )}
    >
      <div
        className={cn(
          "grid h-[var(--glass-header-height)] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2",
          isElectron && !mobile ? "pr-2 pl-0 md:pr-3" : "px-2 md:px-3",
        )}
      >
        <div
          className={cn(
            "flex min-h-0 min-w-0 items-center gap-1",
            isElectron && "pl-[var(--glass-electron-traffic-inset)]",
          )}
        >
          <button
            type="button"
            onClick={() => {
              if (mobile) p.setLeftOpen(!p.leftOpen);
              else p.toggleLeft();
            }}
            className="no-drag flex size-6 shrink-0 items-center justify-center rounded-md bg-black/[0.04] text-muted-foreground hover:bg-glass-hover hover:text-foreground dark:bg-white/[0.06]"
            aria-label={p.leftOpen ? "Collapse threads" : "Expand threads"}
          >
            {p.leftOpen ? (
              <IconSidebarHiddenLeftWide className="size-4" />
            ) : (
              <IconSidebar className="size-4" />
            )}
          </button>
        </div>

        <div className="no-drag flex min-h-0 min-w-0 max-w-[min(56vw,28rem)] items-center justify-center justify-self-center px-1">
          <span className="truncate text-center text-[11px] font-medium leading-none text-foreground/85">
            {props.title}
          </span>
        </div>

        <div className="flex w-full min-h-0 min-w-0 items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => {
              if (mobile) p.setRightOpen(!p.rightOpen);
              else p.toggleRight();
            }}
            className={cn(
              "no-drag flex h-6 min-h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium leading-none transition-colors",
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
    </header>
  );

  const mainHeader =
    p.leftOpen && !mobile ? (
      <header
        className={cn(
          "flex shrink-0 flex-col bg-glass-menubar/60 backdrop-blur-xl",
          isElectron && "drag-region",
        )}
      >
        <div
          className={cn(
            "grid h-[var(--glass-header-height)] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2",
            isElectron && !mobile ? "pr-2 pl-0 md:pr-3" : "px-2 md:px-3",
          )}
        >
          <div className="min-h-0 min-w-0" aria-hidden />
          <div className="no-drag flex min-h-0 min-w-0 max-w-[min(56vw,28rem)] items-center justify-center justify-self-center px-1">
            <span className="truncate text-center text-[11px] font-medium leading-none text-foreground/85">
              {props.title}
            </span>
          </div>
          <div className="flex w-full min-h-0 min-w-0 items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => p.toggleRight()}
              className={cn(
                "no-drag flex h-6 min-h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium leading-none transition-colors",
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
      </header>
    ) : (
      stackHeader
    );

  const leftAside = (
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
  );

  const rightAside = (
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
  );

  const centerColumn = (
    <main className="flex min-w-0 flex-1 flex-col bg-glass-chat">{props.center}</main>
  );

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col bg-glass-editor">
      {mobile ? (
        <>
          {stackHeader}
          <div className="relative flex min-h-0 flex-1">
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

            {centerColumn}

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
          </div>
        </>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-row">
          {leftAside}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {mainHeader}
            <div className="relative flex min-h-0 flex-1 flex-row">
              {centerColumn}
              {rightAside}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
