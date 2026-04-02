import type { PiSessionSummary } from "@glass/contracts";

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

export function buildPiSessionSidebarSections(ids: readonly string[]) {
  if (ids.length === 0) return [];
  return [{ id: "pi-chats", label: "Chats", ids }] satisfies GlassSidebarSection[];
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
