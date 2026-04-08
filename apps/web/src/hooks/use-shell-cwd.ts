import { useMatchRoute, useParams } from "@tanstack/react-router";
import { useMemo, useSyncExternalStore } from "react";

import { GLASS_SHELL_CHANGED_EVENT } from "../lib/glass-runtime-constants";
import { useServerAvailableEditors } from "../rpc/serverState";
import { useStore } from "../store";

const WORKSPACE_KEY = "glass:workspace-cwd";
const THREAD_ROUTE = "/$threadId";

function readStoredCwd() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(WORKSPACE_KEY)?.trim();
  return raw && raw.length > 0 ? raw : null;
}

function basename(cwd: string | null) {
  if (!cwd) return null;
  const clean = cwd.replace(/[\\/]+$/, "");
  const cut = Math.max(clean.lastIndexOf("/"), clean.lastIndexOf("\\"));
  return cut >= 0 ? clean.slice(cut + 1) : clean;
}

function useRouteThreadId() {
  const id = useParams({
    strict: false,
    select: (params) => (typeof params.threadId === "string" ? params.threadId : null),
  });
  const match = useMatchRoute();
  const pending = match({ to: THREAD_ROUTE, pending: true });
  if (pending && typeof pending.threadId === "string") return pending.threadId;
  return id;
}

function subscribe(listener: () => void) {
  window.addEventListener(GLASS_SHELL_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener(GLASS_SHELL_CHANGED_EVENT, listener);
  };
}

export function useShellState() {
  const editors = useServerAvailableEditors();
  const routeThreadId = useRouteThreadId();
  const projects = useStore((state) => state.projects);
  const threads = useStore((state) => state.threads);
  const stored = useSyncExternalStore(subscribe, readStoredCwd, () => null);

  return useMemo(() => {
    const byId = new Map(projects.map((item) => [item.id, item]));
    const thread = routeThreadId ? threads.find((item) => item.id === routeThreadId) : null;
    const storedProject = projects.find((item) => item.cwd === stored) ?? null;
    const threadProject = thread ? (byId.get(thread.projectId) ?? null) : null;
    const project = storedProject ?? threadProject ?? projects[0] ?? null;
    const cwd = thread?.worktreePath ?? project?.cwd ?? null;

    return {
      cwd,
      name: basename(cwd),
      home: null,
      availableEditors: [...editors],
    };
  }, [editors, projects, routeThreadId, stored, threads]);
}
