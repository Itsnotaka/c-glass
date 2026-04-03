import type { PiSessionSummary } from "@glass/contracts";

import { shortWorkspacePathLabel } from "./glass-path-label";

export function buildWorkspaceThreadSections(
  sums: Record<string, PiSessionSummary>,
  cwd: string | null,
  home: string | null,
) {
  const list = Object.values(sums).filter((item) => item.messageCount > 0);
  if (list.length === 0) return [];

  const by = new Map<string, PiSessionSummary[]>();
  for (const s of list) {
    const key = s.cwd || "/";
    const cur = by.get(key);
    if (cur) cur.push(s);
    else by.set(key, [s]);
  }

  const groups = [...by.entries()].map(([cwd, items]) => {
    const sorted = items.toSorted((a, b) =>
      a.modifiedAt < b.modifiedAt ? 1 : a.modifiedAt > b.modifiedAt ? -1 : 0,
    );
    const latest = sorted[0]?.modifiedAt ?? "";
    return { cwd, label: shortWorkspacePathLabel(cwd, home), sorted, latest };
  });

  groups.sort((a, b) => {
    const left = cwd !== null && a.cwd === cwd;
    const right = cwd !== null && b.cwd === cwd;
    if (left && !right) return -1;
    if (!left && right) return 1;
    if (a.latest < b.latest) return 1;
    if (a.latest > b.latest) return -1;
    return 0;
  });

  return groups.map((g) => ({
    id: `ws:${g.cwd}`,
    label: g.cwd === cwd ? `Current · ${g.label}` : g.label,
    cwd: g.cwd,
    active: g.cwd === cwd,
    ids: g.sorted.map((s) => s.id),
  })) satisfies GlassSidebarSection[];
}

export interface GlassSidebarAgent {
  id: string;
  title: string;
  state: "draft" | "idle" | "running" | "error";
  unread: boolean;
  updatedAt: string;
  ago: string;
  selected: boolean;
}

export interface GlassSidebarSection {
  id: string;
  label: string;
  cwd: string;
  active: boolean;
  ids: readonly string[];
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export function buildPiSessionSidebarAgent(
  session: PiSessionSummary,
  selectedSessionId: string | null,
) {
  return {
    id: session.id,
    title: session.name?.trim() || session.firstMessage.trim() || "Untitled",
    state: session.isStreaming ? "running" : "idle",
    unread: false,
    updatedAt: session.modifiedAt,
    ago: timeAgo(session.modifiedAt),
    selected: selectedSessionId !== null && selectedSessionId === session.id,
  } satisfies GlassSidebarAgent;
}
