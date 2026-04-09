import type { GitFileSummary, GitState, GitStatusResult } from "@glass/contracts";
import { type FileDiffMetadata, parsePatchFiles } from "@pierre/diffs";
import * as Schema from "effect/Schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useGlassShellStore } from "../lib/glass-shell-store";
import { readNativeApi } from "../native-api";
import { useStore } from "../store";
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
  add: number;
  del: number;
}

export interface GlassGitPanelModel {
  snap: GitState | null;
  loading: boolean;
  error: string | null;
  count: number;
  selected: string | null;
  fileDiff: FileDiffMetadata | null;
  filePatch: string | null;
  fileDiffLoading: boolean;
  fileDiffError: string | null;
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

function firstFileFromUnifiedDiff(unifiedDiff: string): FileDiffMetadata | null {
  const trimmed = unifiedDiff.trim();
  if (trimmed.length === 0) return null;

  try {
    const patches = parsePatchFiles(trimmed);
    for (const patch of patches) {
      const file = patch.files[0];
      if (file) return file;
    }
  } catch {}

  return null;
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

function toItem(item: GitStatusResult["workingTree"]["files"][number]) {
  return {
    id: item.path,
    path: item.path,
    prevPath: item.prevPath,
    state: item.state,
    staged: false,
    unstaged: true,
  } satisfies GitFileSummary;
}

function toRow(item: GitStatusResult["workingTree"]["files"][number]) {
  return {
    ...toItem(item),
    add: item.insertions,
    del: item.deletions,
  } satisfies DiffRow;
}

function toRows(status: GitStatusResult | null) {
  if (!status) return [] as DiffRow[];
  return status.workingTree.files.map(toRow);
}

function toSnap(cwd: string, status: GitStatusResult): GitState {
  return {
    cwd,
    gitRoot: status.isRepo ? cwd : null,
    repo: status.isRepo,
    clean: !status.hasWorkingTreeChanges || status.workingTree.files.length === 0,
    count: status.workingTree.files.length,
    files: status.workingTree.files.map(toItem),
    patch: "",
  };
}

export function useGlassGitPanel(): GlassGitPanelModel {
  const { cwd } = useShellState();
  const api = readNativeApi();
  const boot = useStore((state) => state.bootstrapComplete);
  const paths = useGlassShellStore((state) => state.paths);
  const tick = useGlassShellStore((state) => state.tick);
  const [git, setGit] = useState(() => ({
    cwd: null as string | null,
    snap: null as GitState | null,
    status: null as GitStatusResult | null,
    err: null as string | null,
    loading: false,
  }));
  const [selected, setSelected] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(
    async (opts?: { reset?: boolean }) => {
      if (!api || !cwd) return null;
      const id = ++seq.current;
      setGit((state) =>
        state.cwd === cwd && !opts?.reset
          ? { ...state, loading: true }
          : { cwd, snap: null, status: null, err: null, loading: true },
      );
      try {
        const next = await api.git.refreshStatus({ cwd });
        if (seq.current !== id) return null;
        const snap = toSnap(cwd, next);
        setGit({ cwd, snap, status: next, err: null, loading: false });
        return snap;
      } catch (err) {
        if (seq.current !== id) return null;
        setGit({
          cwd,
          snap: null,
          status: null,
          err: err instanceof Error ? err.message : String(err),
          loading: false,
        });
        return null;
      }
    },
    [api, cwd],
  );

  useEffect(() => {
    if (!api || !cwd) {
      seq.current += 1;
      setGit({ cwd: null, snap: null, status: null, err: null, loading: false });
      setSelected(null);
      return;
    }

    let active = true;
    let off: () => void = () => {};

    setSelected(null);
    void load({ reset: true }).then(() => {
      if (!active) return;
      off = api.git.onStatus(
        { cwd },
        (next) => {
          setGit((state) => {
            if (state.cwd !== cwd) return state;
            return {
              cwd,
              snap: toSnap(cwd, next),
              status: next,
              err: null,
              loading: false,
            };
          });
        },
        {
          onResubscribe: () => {
            void load();
          },
        },
      );
    });

    return () => {
      active = false;
      off();
    };
  }, [api, cwd, load]);

  const cur = git.cwd === cwd ? git : null;

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

  const curSnap = cur?.snap ?? null;
  const curErr = cur?.err ?? null;
  const rows = useMemo(() => toRows(cur?.status ?? null), [cur?.status]);
  const curRows = curSnap ? rows : [];
  const pending =
    Boolean(api) &&
    ((cwd !== null && cur === null) || Boolean(cur?.loading) || (!boot && cwd === null));
  const recent = useMemo(() => {
    if (!cwd || !curSnap) return null;
    return hit(paths, cwd, curSnap.gitRoot ?? null, curRows);
  }, [curRows, curSnap, cwd, paths]);

  useEffect(() => {
    if (curRows.length === 0) {
      if (selected !== null) setSelected(null);
      return;
    }
    if (selected && curRows.some((row) => row.id === selected)) return;
    if (recent) {
      setSelected(recent.id);
      return;
    }
    setSelected(curRows[0]?.id ?? null);
  }, [curRows, recent, selected]);

  const selectedRow = useMemo(
    () => (selected ? (curRows.find((row) => row.id === selected) ?? null) : null),
    [curRows, selected],
  );

  const [fileDiff, setFileDiff] = useState<FileDiffMetadata | null>(null);
  const [filePatch, setFilePatch] = useState<string | null>(null);
  const [fileDiffLoading, setFileDiffLoading] = useState(false);
  const [fileDiffError, setFileDiffError] = useState<string | null>(null);
  const fileSeq = useRef(0);

  useEffect(() => {
    if (!api || !cwd || !selectedRow) {
      setFileDiff(null);
      setFilePatch(null);
      setFileDiffLoading(false);
      setFileDiffError(null);
      return;
    }

    const seq = ++fileSeq.current;
    setFileDiffLoading(true);
    setFileDiffError(null);

    api.git
      .getFilePatch({ cwd, path: selectedRow.path })
      .then((result) => {
        if (fileSeq.current !== seq) return;
        setFilePatch(result.unifiedDiff);
        setFileDiff(firstFileFromUnifiedDiff(result.unifiedDiff));
        setFileDiffLoading(false);
      })
      .catch((err) => {
        if (fileSeq.current !== seq) return;
        setFileDiff(null);
        setFilePatch(null);
        setFileDiffLoading(false);
        setFileDiffError(err instanceof Error ? err.message : String(err));
      });
  }, [api, cwd, selectedRow]);

  const statsById = useMemo(
    () => new Map(curRows.map((row) => [row.id, { add: row.add, del: row.del }])),
    [curRows],
  );

  return {
    snap: curSnap,
    loading: pending,
    error: curErr,
    count: curSnap?.count ?? 0,
    selected,
    fileDiff,
    filePatch,
    fileDiffLoading,
    fileDiffError,
    hit: recent?.id ?? null,
    totalAdd: curRows.reduce((sum, row) => sum + row.add, 0),
    totalDel: curRows.reduce((sum, row) => sum + row.del, 0),
    statsById,
    rows: curRows,
    setSelected,
    refresh: load,
    init: async () => {
      if (!api || !cwd) return null;
      try {
        await api.git.init({ cwd });
      } catch (err) {
        setGit((state) =>
          state.cwd !== cwd
            ? state
            : {
                ...state,
                err: err instanceof Error ? err.message : String(err),
                loading: false,
              },
        );
      }
      return load();
    },
    discard: async (paths) => {
      if (!api || !cwd) return curSnap;
      try {
        await api.git.discardPaths({ cwd, paths });
      } catch (err) {
        setGit((state) =>
          state.cwd !== cwd
            ? state
            : {
                ...state,
                err: err instanceof Error ? err.message : String(err),
                loading: false,
              },
        );
      }
      return load();
    },
  };
}
