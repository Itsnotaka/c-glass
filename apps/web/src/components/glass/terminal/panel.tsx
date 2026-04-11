"use client";

import type { TerminalEvent } from "@glass/contracts";
import { DEFAULT_TERMINAL_ID } from "@glass/contracts";
import type { FitAddon, Ghostty, ITheme, Terminal as Term } from "ghostty-web";
import { useEffect, useRef } from "react";

import { useTheme } from "~/hooks/use-theme";
import { readNativeApi } from "~/native-api";

let shared: Promise<{ mod: typeof import("ghostty-web"); ghostty: Ghostty }> | undefined;

const dark: ITheme = {
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#e5e510",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#ffffff",
};

const light: ITheme = {
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#bf8803",
  blue: "#0451a5",
  magenta: "#bc05bc",
  cyan: "#0598bc",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#cd3131",
  brightGreen: "#14ce14",
  brightYellow: "#b5ba00",
  brightBlue: "#0451a5",
  brightMagenta: "#bc05bc",
  brightCyan: "#0598bc",
  brightWhite: "#a5a5a5",
};

function loadGhostty() {
  if (shared) return shared;
  shared = import("ghostty-web")
    .then(async (mod) => ({ mod, ghostty: await mod.Ghostty.load() }))
    .catch((err) => {
      shared = undefined;
      throw err;
    });
  return shared;
}

function workbenchThreadId(cwd: string) {
  return `workbench:${cwd}`;
}

function readTextColor(el: HTMLElement, value: string) {
  const node = document.createElement("span");
  node.style.position = "absolute";
  node.style.opacity = "0";
  node.style.pointerEvents = "none";
  node.style.color = value;
  el.append(node);
  const color = getComputedStyle(node).color || value;
  node.remove();
  return color;
}

function readBackgroundColor(el: HTMLElement, value: string) {
  const node = document.createElement("span");
  node.style.position = "absolute";
  node.style.opacity = "0";
  node.style.pointerEvents = "none";
  node.style.backgroundColor = value;
  el.append(node);
  const color = getComputedStyle(node).backgroundColor || value;
  node.remove();
  return color;
}

function readFontFamily(el: HTMLElement) {
  const node = document.createElement("span");
  node.style.position = "absolute";
  node.style.opacity = "0";
  node.style.pointerEvents = "none";
  node.style.fontFamily = "var(--font-glass-mono), ui-monospace, monospace";
  el.append(node);
  const value = getComputedStyle(node).fontFamily || "ui-monospace, monospace";
  node.remove();
  return value;
}

function readTheme(el: HTMLElement, mode: "light" | "dark") {
  const base = mode === "dark" ? dark : light;
  const host = el.parentElement ?? el;
  const style = getComputedStyle(host);
  const fg =
    style.color && style.color !== "rgba(0, 0, 0, 0)"
      ? style.color
      : readTextColor(host, "hsl(var(--foreground))");
  const bg =
    style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)"
      ? style.backgroundColor
      : readBackgroundColor(host, "hsl(var(--background))");

  return {
    ...base,
    background: bg,
    foreground: fg,
    cursor: fg,
    cursorAccent: bg,
    selectionBackground: mode === "dark" ? "rgba(96, 165, 250, 0.35)" : "rgba(59, 130, 246, 0.35)",
    selectionForeground: mode === "dark" ? "rgb(249, 250, 251)" : "rgb(15, 23, 42)",
  } satisfies ITheme;
}

export function GlassTerminalPanel(props: { cwd: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const term = useRef<Term | null>(null);
  const fit = useRef<FitAddon | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const el = ref.current;
    const api = readNativeApi();
    if (!el || !api || !props.cwd) return;

    const cwd = props.cwd;
    const thread = workbenchThreadId(cwd);
    const cfg = readTheme(el, resolvedTheme);
    const family = readFontFamily(el);

    let live = true;
    let off: (() => void) | undefined;
    let data: { dispose: () => void } | undefined;

    void loadGhostty()
      .then(({ mod, ghostty }) => {
        if (!live) return;

        const next = new mod.Terminal({
          ghostty,
          fontSize: 13,
          fontFamily: family,
          cursorBlink: true,
          theme: cfg,
          scrollback: 10_000,
        });
        const addon = new mod.FitAddon();
        next.loadAddon(addon);
        next.open(el);
        addon.fit();

        term.current = next;
        fit.current = addon;

        data = next.onData((chunk) => {
          void api.terminal.write({
            threadId: thread,
            terminalId: DEFAULT_TERMINAL_ID,
            data: chunk,
          });
        });

        const onEvent = (event: TerminalEvent) => {
          if (event.threadId !== thread) return;
          if (event.type === "output") {
            next.write(event.data);
            return;
          }
          if (event.type === "started" || event.type === "restarted") {
            next.clear();
            if (event.snapshot.history) next.write(event.snapshot.history);
          }
        };

        off = api.terminal.onEvent(onEvent);

        void api.terminal
          .open({
            threadId: thread,
            terminalId: DEFAULT_TERMINAL_ID,
            cwd,
            cols: next.cols,
            rows: next.rows,
          })
          .then((snap) => {
            if (snap.history) next.write(snap.history);
          })
          .catch(() => {});
      })
      .catch(() => {});

    return () => {
      live = false;
      off?.();
      data?.dispose();
      term.current?.dispose();
      term.current = null;
      fit.current = null;
    };
  }, [props.cwd, resolvedTheme]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const addon = fit.current;
      const next = term.current;
      const api = readNativeApi();
      if (!addon || !next || !api || !props.cwd) return;
      addon.fit();
      void api.terminal.resize({
        threadId: workbenchThreadId(props.cwd),
        terminalId: DEFAULT_TERMINAL_ID,
        cols: next.cols,
        rows: next.rows,
      });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [props.cwd]);

  if (!props.cwd) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center">
        <p className="text-body text-muted-foreground/60">No workspace open</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <div ref={ref} className="min-h-0 flex-1 overflow-hidden px-2 py-1" />
    </div>
  );
}
