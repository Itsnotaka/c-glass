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
  agents: GlassSidebarAgent[];
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

export function buildPiSessionSidebarSections(
  sessions: readonly PiSessionSummary[],
  selectedSessionId: string | null,
) {
  if (sessions.length === 0) return [];

  const agents: GlassSidebarAgent[] = sessions.map((item) => ({
    id: item.id,
    title: item.name?.trim() || item.firstMessage.trim() || "Untitled",
    state: item.isStreaming ? "running" : "idle",
    unread: false,
    updatedAt: item.modifiedAt,
    ago: timeAgo(item.modifiedAt),
    selected: selectedSessionId !== null && selectedSessionId === item.id,
  }));

  agents.sort((left, right) =>
    left.updatedAt < right.updatedAt ? 1 : left.updatedAt > right.updatedAt ? -1 : 0,
  );

  return [{ id: "pi-chats", label: "Chats", agents }] satisfies GlassSidebarSection[];
}
