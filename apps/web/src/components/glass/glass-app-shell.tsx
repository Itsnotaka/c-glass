"use client";

import {
  IconArrowLeft,
  IconSidebar,
  IconSidebarHiddenLeftWide,
  IconSidebarHiddenRightWide,
} from "central-icons";
import { type ReactNode } from "react";

import { cn } from "../../lib/utils";

export type GlassAppShellPanels = {
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

export function GlassAppShell(props: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode | null;
  title: string;
  changesCount: number;
  panels: GlassAppShellPanels;
  onBack?: () => void;
}) {
  const p = props.panels;
  const electron = typeof window !== "undefined" && window.glass !== undefined;
  const showRight = props.right !== null;

  return (
    <div
      className="relative flex h-full min-w-0 flex-1 flex-row bg-transparent"
      data-electron={electron ? "" : undefined}
    >
      {/* Full-height sidebar */}
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

      {/* Center + right */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 flex-row">
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-glass-chat">
            {props.center}
          </main>
          {showRight ? (
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

      {/* Floating controls (no visible bar) */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 h-[var(--glass-header-height)]",
          electron && "drag-region",
        )}
      >
        <div className="pointer-events-none absolute inset-y-0 left-[var(--glass-workbench-toggle-left)] flex items-center gap-1">
          {props.onBack ? (
            <button
              type="button"
              onClick={() => props.onBack?.()}
              className="pointer-events-auto no-drag flex size-6 shrink-0 items-center justify-center rounded-md bg-transparent text-muted-foreground hover:bg-glass-hover hover:text-foreground"
              aria-label="Back to chat"
            >
              <IconArrowLeft className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => p.toggleLeft()}
            className="pointer-events-auto no-drag flex size-6 shrink-0 items-center justify-center rounded-md bg-transparent text-muted-foreground hover:bg-glass-hover hover:text-foreground"
            aria-label={p.leftOpen ? "Collapse threads" : "Expand threads"}
          >
            {p.leftOpen ? (
              <IconSidebarHiddenLeftWide className="size-4" />
            ) : (
              <IconSidebar className="size-4" />
            )}
          </button>
        </div>
        {showRight ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-[var(--glass-workbench-toggle-right)]">
            <button
              type="button"
              onClick={() => p.toggleRight()}
              className={cn(
                "pointer-events-auto no-drag flex h-6 min-h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium leading-none transition-colors",
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
        ) : null}
      </div>
    </div>
  );
}
