import type { GitFileSummary, GitState, GitStatusResult } from "@glass/contracts";
import * as Schema from "effect/Schema";
import { useCallback, useEffect, useMemo, useState } from "react";

import { readNativeApi } from "../nativeApi";
import { useGlassShellStore } from "../lib/glass-shell-store";
import { useLocalStorage } from "./use-local-storage";
import { useShellState } from "./use-shell-cwd";

const DiffStyle = Schema.Literals(["unified", "split"]);

export function useGlassDiffStylePreference() {
  return useLocalStorage<"unified" | "split", "unified" | "split">(
    "glass:git-diff-style",
    "unified",
    DiffStyle,
  );
}

export interface DiffRow extends GitFileSummary {
  diff: null;
  add: number;
  del: number;
}

export interface GlassGitPanelModel {
  snap: GitState | null;
  loading: boolean;
  error: string | null;
  count: number;
  selected: string | null;
  patch: null;
  hit: string | null;
  totalAdd: number;
  totalDel: number;
  statsById: Map<string, { add: number; del: number }>;
  rows: DiffRow[];
  setSelected: (id: string) => void;
  refresh: () => Promise<GitState | null>;
  init: () => Promise<GitState | null>;
  discard: (_paths: string[]) => Promise<GitState | null>;
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

function hit(paths: string[], cwd: string, root: string | null, files: DiffRow[]) {
  for (const path of paths) {
    const next = pick(path, cwd, root);
    if (next === null) continue;
    const file = files.find((item) => item.path === next || item.prevPath === next);
    if (file) return file;
  }
  return null;
}

function toFileState(item: GitStatusResult["workingTree"]["files"][number]) {
  if (item.insertions > 0 && item.deletions === 0) return "added" as const;
  if (item.insertions === 0 && item.deletions > 0) return "deleted" as const;
  return "modified" as const;
}

function toSnap(cwd: string, status: GitStatusResult): GitState {
  const files = status.workingTree.files.map((item) => ({
    id: item.path,
    path: item.path,
    prevPath: null,
    state: toFileState(item),
    staged: false,
    unstaged: true,
  }));

  return {
    cwd,
    gitRoot: status.isRepo ? cwd : null,
    repo: status.isRepo,
    clean: status.workingTree.files.length === 0,
    count: status.workingTree.files.length,
    files,
    patch: "",
  };
}

function toRows(snap: GitState | null, status: GitStatusResult | null) {
  if (!snap || !status) return [] as DiffRow[];
  return snap.files.map((file) => {
    const hit = status.workingTree.files.find((item) => item.path === file.path);
    return {
      ...file,
      diff: null,
      add: hit?.insertions ?? 0,
      del: hit?.deletions ?? 0,
    } satisfies DiffRow;
  });
}

export function useGlassGitPanel(): GlassGitPanelModel {
  const { cwd } = useShellState();
  const api = readNativeApi();
  const paths = useGlassShellStore((state) => state.paths);
  const tick = useGlassShellStore((state) => state.tick);
  const [snap, setSnap] = useState<GitState | null>(null);
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!api || !cwd) return null;
    setLoading(true);
    try {
      const next = await api.git.refreshStatus({ cwd });
      setStatus(next);
      const mapped = toSnap(cwd, next);
      setSnap(mapped);
      setErr(null);
      return mapped;
    } catch (err) {
      setErr(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [api, cwd]);

  useEffect(() => {
    if (!api || !cwd) {
      setSnap(null);
      setStatus(null);
      setErr(null);
      setLoading(false);
      setSelected(null);
      return;
    }
    setSelected(null);
    void load();
  }, [api, cwd, load]);

  useEffect(() => {
    if (!api || !cwd) return;
    return api.git.onStatus(
      { cwd },
      (next) => {
        setStatus(next);
        setSnap(toSnap(cwd, next));
        setErr(null);
      },
      {
        onResubscribe: () => {
          void load();
        },
      },
    );
  }, [api, cwd, load]);

  useEffect(() => {
    if (!api || !cwd) return;
    const sync = () => {
      if (document.visibilityState === "hidden") return;
      void load();
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [api, cwd, load]);

  useEffect(() => {
    if (!api || !cwd || tick < 1) return;
    void load();
  }, [api, cwd, load, tick]);

  const rows = useMemo(() => toRows(snap, status), [snap, status]);
  const recent = useMemo(() => {
    if (!cwd) return null;
    return hit(paths, cwd, snap?.gitRoot ?? null, rows);
  }, [cwd, paths, rows, snap?.gitRoot]);

  useEffect(() => {
    if (rows.length === 0) {
      if (selected !== null) setSelected(null);
      return;
    }
    if (selected && rows.some((row) => row.id === selected)) return;
    if (recent) {
      setSelected(recent.id);
      return;
    }
    setSelected(rows[0]?.id ?? null);
  }, [recent, rows, selected]);

  const statsById = useMemo(
    () => new Map(rows.map((row) => [row.id, { add: row.add, del: row.del }])),
    [rows],
  );

  return {
    snap,
    loading,
    error: err,
    count: snap?.count ?? 0,
    selected,
    patch: null,
    hit: recent?.id ?? null,
    totalAdd: rows.reduce((sum, row) => sum + row.add, 0),
    totalDel: rows.reduce((sum, row) => sum + row.del, 0),
    statsById,
    rows,
    setSelected,
    refresh: load,
    init: async () => {
      if (!api || !cwd) return null;
      try {
        await api.git.init({ cwd });
      } catch (err) {
        setErr(err instanceof Error ? err.message : String(err));
      }
      return load();
    },
    discard: async () => snap,
  };
}
