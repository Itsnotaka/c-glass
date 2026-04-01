import { ProjectId } from "@glass/contracts";
import type { SessionMetadata } from "@mariozechner/pi-web-ui";

export type GlassAgentUiState = "draft" | "idle" | "running" | "error";

export interface GlassSidebarAgent {
  id: string;
  title: string;
  projectId: ProjectId;
  projectName: string;
  state: GlassAgentUiState;
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

function timeAgo(iso: string): string {
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

const PI_LOCAL_PROJECT_ID = ProjectId.makeUnsafe("pi-local");

export function buildPiSessionSidebarSections(
  sessions: SessionMetadata[],
  selectedSessionId: string | null,
): GlassSidebarSection[] {
  if (sessions.length === 0) return [];

  const agents: GlassSidebarAgent[] = sessions.map((m) => ({
    id: m.id,
    title: m.title.trim() || "Untitled",
    projectId: PI_LOCAL_PROJECT_ID,
    projectName: "Chats",
    state: "idle",
    unread: false,
    updatedAt: m.lastModified,
    ago: timeAgo(m.lastModified),
    selected: selectedSessionId !== null && selectedSessionId === m.id,
  }));

  agents.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));

  return [{ id: "pi-chats", label: "Chats", agents }];
}
