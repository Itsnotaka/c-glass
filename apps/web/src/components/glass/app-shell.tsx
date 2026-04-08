"use client";

import {
  IconArrowLeft,
  IconSidebar,
  IconSidebarHiddenLeftWide,
  IconSidebarHiddenRightWide,
} from "central-icons";
import { type PointerEvent as Evt, type ReactNode, useEffect, useRef, useState } from "react";

import { isElectronHost } from "../../env";
import { cn } from "../../lib/utils";

type Side = "left" | "right";

const limit = {
  left: { min: 180, max: 400 },
  right: { min: 280, max: 600 },
} as const;

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
  const electron = isElectronHost();
  const showRight = props.right !== null;
  const leftRef = useRef<HTMLElement | null>(null);
  const rightRef = useRef<HTMLElement | null>(null);
  const live = useRef({ left: p.leftW, right: p.rightW });
  const drag = useRef<{
    base: number;
    id: number;
    next: number;
    raf: number | null;
    rail: HTMLDivElement;
    side: Side;
    start: number;
    w: number;
  } | null>(null);
  const [side, setSide] = useState<Side | null>(null);

  useEffect(() => {
    if (side !== "left") {
      live.current.left = p.leftW;
    }
  }, [p.leftW, side]);

  useEffect(() => {
    if (side !== "right") {
      live.current.right = p.rightW;
    }
  }, [p.rightW, side]);

  useEffect(() => {
    return () => {
      const item = drag.current;
      if (item?.raf != null) {
        window.cancelAnimationFrame(item.raf);
      }
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
  }, []);

  const stop = (id: number) => {
    const item = drag.current;
    if (!item || item.id !== id) return;

    const next = item.raf === null ? item.w : item.next;
    if (item.raf != null) {
      window.cancelAnimationFrame(item.raf);
    }

    live.current[item.side] = next;
    drag.current = null;
    setSide(null);

    if (item.rail.hasPointerCapture(id)) {
      item.rail.releasePointerCapture(id);
    }
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");

    if (item.side === "left") {
      p.setLeftWidth(next);
      return;
    }
    p.setRightWidth(next);
  };

  const begin = (side: Side) => (e: Evt<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const node = side === "left" ? leftRef.current : rightRef.current;
    if (!node) return;

    const w = live.current[side];
    drag.current = {
      base: w,
      id: e.pointerId,
      next: w,
      raf: null,
      rail: e.currentTarget,
      side,
      start: e.clientX,
      w,
    };
    setSide(side);
    node.style.width = `${w}px`;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  };

  const move = (e: Evt<HTMLDivElement>) => {
    const item = drag.current;
    if (!item || item.id !== e.pointerId) return;

    const delta = item.side === "left" ? e.clientX - item.start : item.start - e.clientX;
    item.next = Math.max(limit[item.side].min, Math.min(limit[item.side].max, item.base + delta));
    if (item.raf !== null) {
      e.preventDefault();
      return;
    }

    item.raf = window.requestAnimationFrame(() => {
      const next = drag.current;
      if (!next) return;

      next.raf = null;
      next.w = next.next;
      live.current[next.side] = next.next;
      const node = next.side === "left" ? leftRef.current : rightRef.current;
      if (!node) return;
      node.style.width = `${next.next}px`;
    });
    e.preventDefault();
  };

  const up = (e: Evt<HTMLDivElement>) => {
    stop(e.pointerId);
    e.preventDefault();
  };

  const leftW = p.leftOpen ? (side === "left" ? live.current.left : p.leftW) : 0;
  const rightW = p.rightOpen ? (side === "right" ? live.current.right : p.rightW) : 0;

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-row bg-transparent">
      {/* Full-height sidebar */}
      <aside
        className={cn(
          "glass-shell-sidebar relative flex shrink-0 flex-col overflow-hidden border-glass-border/50",
          side === "left" ? "transition-none" : "transition-[width] duration-150 ease-out",
        )}
        ref={leftRef}
        style={{
          width: leftW,
          borderRightWidth: p.leftOpen ? 1 : 0,
        }}
      >
        <div aria-hidden={!p.leftOpen} className="flex h-full min-h-0 w-full flex-col">
          {props.left}
        </div>
        {p.leftOpen ? (
          <div
            className="absolute top-0 right-0 z-10 h-full w-1 touch-none cursor-col-resize"
            onPointerCancel={up}
            onPointerDown={begin("left")}
            onPointerMove={move}
            onPointerUp={up}
          >
            <div className="h-full w-full hover:bg-glass-hover/70" />
          </div>
        ) : null}
      </aside>

      {/* Center + right */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 flex-row">
          <main
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-glass-chat outline-hidden"
            data-component="agent-panel"
          >
            <div
              aria-hidden
              className="pointer-events-none h-(--glass-header-height) shrink-0 select-none"
            />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden outline-hidden">
              {props.center}
            </div>
          </main>
          {showRight ? (
            <aside
              className={cn(
                "glass-shell-surface relative flex shrink-0 flex-col overflow-hidden border-glass-border/50",
                side === "right" ? "transition-none" : "transition-[width] duration-150 ease-out",
              )}
              ref={rightRef}
              style={{
                width: rightW,
                borderLeftWidth: p.rightOpen ? 1 : 0,
              }}
            >
              <div aria-hidden={!p.rightOpen} className="flex h-full min-h-0 w-full flex-col">
                {props.right}
              </div>
              {p.rightOpen ? (
                <div
                  className="absolute top-0 left-0 z-10 h-full w-1 touch-none cursor-col-resize"
                  onPointerCancel={up}
                  onPointerDown={begin("right")}
                  onPointerMove={move}
                  onPointerUp={up}
                >
                  <div className="h-full w-full hover:bg-glass-hover/70" />
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>
      </div>

      {/* Floating controls (no visible bar) */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 h-(--glass-header-height)",
          electron && "drag-region",
        )}
      >
        <div className="pointer-events-none absolute inset-y-0 left-(--glass-workbench-toggle-left) flex items-center gap-1">
          {props.onBack ? (
            <button
              type="button"
              onClick={() => props.onBack?.()}
              className="pointer-events-auto no-drag flex size-6 shrink-0 items-center justify-center rounded-glass-control bg-transparent text-muted-foreground hover:bg-glass-hover hover:text-foreground"
              aria-label="Back to chat"
            >
              <IconArrowLeft className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => p.toggleLeft()}
            className="pointer-events-auto no-drag flex size-6 shrink-0 items-center justify-center rounded-glass-control bg-transparent text-muted-foreground hover:bg-glass-hover hover:text-foreground"
            aria-label={p.leftOpen ? "Collapse chats" : "Expand chats"}
          >
            {p.leftOpen ? (
              <IconSidebarHiddenLeftWide className="size-4" />
            ) : (
              <IconSidebar className="size-4" />
            )}
          </button>
        </div>
        {showRight ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-(--glass-workbench-toggle-right)">
            <button
              type="button"
              onClick={() => p.toggleRight()}
              className={cn(
                "pointer-events-auto no-drag font-glass glass-sidebar-label flex min-h-7 items-center gap-1 rounded-glass-control px-2 transition-colors",
                p.rightOpen
                  ? "bg-glass-active/60 text-foreground"
                  : "text-muted-foreground/70 hover:bg-glass-hover hover:text-foreground",
              )}
            >
              <span>Changes</span>
              <span className="flex min-w-4 items-center justify-center rounded bg-muted-foreground/20 px-1 py-0.5 text-inherit tabular-nums">
                {props.changesCount}
              </span>
              {p.rightOpen ? (
                <IconSidebarHiddenRightWide className="glass-composer-icon opacity-60" />
              ) : (
                <IconSidebar className="glass-composer-icon opacity-60" />
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
