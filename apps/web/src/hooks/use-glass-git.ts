import type { GitFileSummary, GitState } from "@glass/contracts";
import { parsePatchFiles, type FileDiffMetadata } from "@pierre/diffs";
import * as Schema from "effect/Schema";
import { useCallback, useEffect, useMemo, useState } from "react";

import { readGlass } from "../host";
import { useGlassShellStore } from "../lib/glass-shell-store";
import { useLocalStorage } from "./use-local-storage";
import { useShellState } from "./use-shell-cwd";

const DiffStyle = Schema.Literals(["unified", "split"]);

/** Pi tool diff embeds (`glass-pi-chat-rows`); Changes panel is stacked (unified) only. */
export function useGlassDiffStylePreference() {
  return useLocalStorage<"unified" | "split", "unified" | "split">(
    "glass:git-diff-style",
    "unified",
    DiffStyle,
  );
}

export interface DiffRow extends GitFileSummary {
  diff: FileDiffMetadata | null;
  add: number;
  del: number;
}

export interface GlassGitPanelModel {
  snap: GitState | null;
  loading: boolean;
  error: string | null;
  count: number;
  selected: string | null;
  patch: FileDiffMetadata | null;
  hit: string | null;
  totalAdd: number;
  totalDel: number;
  statsById: Map<string, { add: number; del: number }>;
  rows: DiffRow[];
  setSelected: (id: string) => void;
  refresh: () => Promise<GitState | null>;
  init: () => Promise<GitState | null>;
  discard: (paths: string[]) => Promise<GitState | null>;
}

function clean(path: string) {
  const raw = path.replace(/\\/g, "/");
  const win = /^[A-Za-z]:\//.test(raw) ? raw.slice(0, 2) : "";
  const abs = win.length > 0 || raw.startsWith("/");
  const body = (win ? raw.slice(2) : raw).split("/");
  const out: string[] = [];

  for (const part of body) {
    if (!part || part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }

  if (win) return out.length > 0 ? `${win}/${out.join("/")}` : `${win}/`;
  if (abs) return out.length > 0 ? `/${out.join("/")}` : "/";
  return out.join("/");
}

function join(base: string, path: string) {
  const next = clean(path);
  if (next.startsWith("/") || /^[A-Za-z]:\//.test(next)) return next;
  return clean(`${clean(base)}/${next}`);
}

function rel(path: string, root: string) {
  const file = clean(path);
  const base = clean(root).replace(/\/+$/, "");
  if (file === base) return "";
  if (!file.startsWith(`${base}/`)) return null;
  return file.slice(base.length + 1);
}

function pick(path: string, cwd: string, root: string | null) {
  if (!root) return null;
  if (path.startsWith("~/")) return null;
  const file = path.startsWith("/") || /^[A-Za-z]:\//.test(path) ? clean(path) : join(cwd, path);
  return rel(file, root);
}

function same(file: GitFileSummary, diff: FileDiffMetadata) {
  if (file.path === diff.name) return true;
  if (file.prevPath && file.prevPath === diff.prevName && file.path === diff.name) return true;
  if (file.prevPath && file.prevPath === diff.name) return true;
  return false;
}

function stat(diff: FileDiffMetadata | null) {
  if (!diff) return { add: 0, del: 0 };
  return diff.hunks.reduce(
    (sum, hunk) =>
      hunk.hunkContent.reduce(
        (cur, row) => {
          if (row.type !== "change") return cur;
          return {
            add: cur.add + row.additions,
            del: cur.del + row.deletions,
          };
        },
        { add: sum.add, del: sum.del },
      ),
    { add: 0, del: 0 },
  );
}

function diffs(snap: GitState | null) {
  if (!snap || !snap.patch.trim()) return [] as FileDiffMetadata[];
  return parsePatchFiles(snap.patch, snap.gitRoot ?? snap.cwd, true).flatMap((item) => item.files);
}

function rows(snap: GitState | null) {
  const list = diffs(snap);
  if (!snap) return [] as DiffRow[];
  return snap.files.map((file) => {
    const diff = list.find((item) => same(file, item)) ?? null;
    const next = stat(diff);
    return {
      ...file,
      diff,
      add: next.add,
      del: next.del,
    } satisfies DiffRow;
  });
}

function hit(paths: string[], cwd: string, root: string | null, files: DiffRow[]) {
  for (const path of paths) {
    const next = pick(path, cwd, root);
    if (next === null) continue;
    const file = files.find((item) => item.path === next || item.prevPath === next);
    if (file) return file;
  }
  return null;
}

export function useGlassGitPanel(): GlassGitPanelModel {
  const { cwd } = useShellState();
  const glass = readGlass();
  const paths = useGlassShellStore((state) => state.paths);
  const tick = useGlassShellStore((state) => state.tick);
  const [snap, setSnap] = useState<GitState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(
    (kind: "getState" | "refresh") => {
      if (!glass?.git || !cwd) return Promise.resolve(null);
      setLoading(true);
      return glass.git[kind](cwd)
        .then((next) => {
          setSnap(next);
          setErr(null);
          return next;
        })
        .catch((err: unknown) => {
          setErr(err instanceof Error ? err.message : String(err));
          return null;
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [cwd, glass],
  );

  useEffect(() => {
    if (!cwd || !glass?.git) {
      setSnap(null);
      setErr(null);
      setLoading(false);
      setSelected(null);
      return;
    }
    setSelected(null);
    void load("getState");
  }, [cwd, glass, load]);

  useEffect(() => {
    if (!cwd || !glass?.git) return;
    const off = glass.git.onState((next) => {
      if (next.cwd !== cwd) return;
      setSnap(next);
      setErr(null);
    });
    return () => {
      off();
    };
  }, [cwd, glass]);

  useEffect(() => {
    if (!cwd || !glass?.git) return;
    const sync = () => {
      if (document.visibilityState === "hidden") return;
      void load("refresh");
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [cwd, glass, load]);

  useEffect(() => {
    if (!cwd || !glass?.git) return;
    if (tick < 1) return;
    void load("refresh");
  }, [cwd, glass, load, tick]);

  const parsed = useMemo(() => {
    try {
      return { rows: rows(snap), error: null } as const;
    } catch (err) {
      return {
        rows: [] as DiffRow[],
        error: err instanceof Error ? err.message : String(err),
      } as const;
    }
  }, [snap]);

  const files = parsed.rows;
  const error = err ?? parsed.error;
  const recent = useMemo(() => {
    if (!cwd) return null;
    return hit(paths, cwd, snap?.gitRoot ?? null, files);
  }, [cwd, files, paths, snap?.gitRoot]);

  useEffect(() => {
    if (files.length === 0) {
      if (selected !== null) setSelected(null);
      return;
    }
    if (selected && files.some((file) => file.id === selected)) return;
    if (recent) {
      setSelected(recent.id);
      return;
    }
    setSelected(files[0]?.id ?? null);
  }, [files, recent, selected]);

  const statsById = useMemo(
    () => new Map(files.map((file) => [file.id, { add: file.add, del: file.del }])),
    [files],
  );
  const patch = useMemo(
    () => files.find((file) => file.id === selected)?.diff ?? null,
    [files, selected],
  );
  const totalAdd = useMemo(() => files.reduce((sum, file) => sum + file.add, 0), [files]);
  const totalDel = useMemo(() => files.reduce((sum, file) => sum + file.del, 0), [files]);

  const init = useCallback(() => {
    if (!glass?.git || !cwd) return Promise.resolve(null);
    setLoading(true);
    return glass.git
      .init(cwd)
      .then((next) => {
        setSnap(next);
        setErr(null);
        return next;
      })
      .catch((err: unknown) => {
        setErr(err instanceof Error ? err.message : String(err));
        return null;
      })
      .finally(() => {
        setLoading(false);
      });
  }, [cwd, glass]);

  const discard = useCallback(
    (paths: string[]) => {
      if (!glass?.git || !cwd) return Promise.resolve(null);
      return glass.git
        .discard(cwd, paths)
        .then((next) => {
          setSnap(next);
          setErr(null);
          return next;
        })
        .catch((err: unknown) => {
          setErr(err instanceof Error ? err.message : String(err));
          return null;
        });
    },
    [cwd, glass],
  );

  return {
    snap,
    loading,
    error,
    count: snap?.count ?? 0,
    selected,
    patch,
    hit: recent?.id ?? null,
    totalAdd,
    totalDel,
    statsById,
    rows: files,
    setSelected,
    refresh: () => load("refresh"),
    init,
    discard,
  };
}
