import type { GlassSessionSummary } from "@glass/contracts";

import type { GlassDraftChat } from "./glass-chat-draft-store";
import { shortWorkspacePathLabel } from "./glass-path-label";

export interface GlassSidebarChat {
  id: string;
  kind: "draft" | "thread";
  title: string;
  state: "draft" | "idle" | "running" | "error";
  unread: boolean;
  updatedAt: string;
  ago: string;
  cwd: string;
}

export interface GlassSidebarSection {
  id: string;
  label: string;
  cwd: string;
  active: boolean;
  items: readonly GlassSidebarChat[];
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

function draftTitle(draft: GlassDraftChat) {
  const text = draft.text.trim();
  if (text) {
    const line = text.split("\n")[0]?.trim();
    if (line) return line;
  }
  const head = draft.files[0]?.name;
  if (!head) return "New chat";
  if (draft.files.length === 1) return head;
  return `${head} +${draft.files.length - 1}`;
}

function buildThreadChat(sum: GlassSessionSummary, unreadIds?: ReadonlySet<string>) {
  return {
    id: sum.id,
    kind: "thread",
    title: sum.name?.trim() || sum.firstMessage.trim() || "Untitled",
    state: sum.isStreaming ? "running" : "idle",
    unread: unreadIds?.has(sum.id) ?? false,
    updatedAt: sum.modifiedAt,
    ago: timeAgo(sum.modifiedAt),
    cwd: sum.cwd || "/",
  } satisfies GlassSidebarChat;
}

function buildDraftChat(draft: GlassDraftChat) {
  return {
    id: draft.id,
    kind: "draft",
    title: draftTitle(draft),
    state: "draft",
    unread: false,
    updatedAt: draft.updatedAt,
    ago: timeAgo(draft.updatedAt),
    cwd: draft.cwd || "/",
  } satisfies GlassSidebarChat;
}

export function buildWorkspaceChatSections(
  sums: Record<string, GlassSessionSummary>,
  drafts: readonly GlassDraftChat[],
  cwd: string | null,
  home: string | null,
  unreadIds?: ReadonlySet<string>,
) {
  const list = [
    ...Object.values(sums).map((sum) => buildThreadChat(sum, unreadIds)),
    ...drafts.map((draft) => buildDraftChat(draft)),
  ];
  if (list.length === 0) return [];

  const by = new Map<string, GlassSidebarChat[]>();
  for (const item of list) {
    const key = item.cwd || "/";
    const cur = by.get(key);
    if (cur) cur.push(item);
    else by.set(key, [item]);
  }

  const groups = [...by.entries()].map(([dir, items]) => {
    const sorted = items.toSorted((left, right) =>
      left.updatedAt < right.updatedAt ? 1 : left.updatedAt > right.updatedAt ? -1 : 0,
    );
    const latest = sorted[0]?.updatedAt ?? "";
    return { dir, label: shortWorkspacePathLabel(dir, home), sorted, latest };
  });

  groups.sort((left, right) => {
    if (left.latest < right.latest) return 1;
    if (left.latest > right.latest) return -1;
    return left.dir.localeCompare(right.dir);
  });

  return groups.map((group) => ({
    id: `ws:${group.dir}`,
    label: group.label,
    cwd: group.dir,
    active: group.dir === cwd,
    items: group.sorted,
  })) satisfies GlassSidebarSection[];
}
