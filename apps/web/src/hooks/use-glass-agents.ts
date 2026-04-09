import { useMemo } from "react";
import {
  buildWorkspaceChatSections,
  type GlassSidebarChat,
  type GlassSidebarSection,
} from "../lib/glass-view-model";
import { useGlassChatDraftStore } from "../lib/glass-chat-draft-store";
import { useGlassThreadUnreadStore } from "../lib/glass-thread-unread-store";
import { useThreadSummaries, useThreadSummariesStatus } from "../lib/thread-session-store";
import { useRouteThreadId } from "./use-route-thread-id";

export function useGlassAgents(cwd: string | null, home: string | null) {
  const sums = useThreadSummaries();
  const status = useThreadSummariesStatus();
  const routeThreadId = useRouteThreadId();
  const draftId = useGlassChatDraftStore((state) => state.cur);
  const items = useGlassChatDraftStore((state) => state.items);
  const drafts = useMemo(() => Object.values(items), [items]);
  const selectedId = routeThreadId ?? draftId;
  const unread = useGlassThreadUnreadStore((s) => s.unread);
  const unreadIds = useMemo(() => {
    return new Set(Object.keys(unread).filter((id) => unread[id]));
  }, [unread]);

  const sections = useMemo(
    () => buildWorkspaceChatSections(status === "ready" ? sums : {}, drafts, cwd, home, unreadIds),
    [cwd, drafts, home, status, sums, unreadIds],
  );

  const selected = useMemo(
    () =>
      selectedId
        ? (sections.flatMap((section) => section.items).find((item) => item.id === selectedId) ??
          null)
        : null,
    [sections, selectedId],
  );

  return {
    sections,
    routeThreadId,
    selectedId,
    selected,
    loading: status === "loading" && drafts.length === 0,
    error: status === "error" && drafts.length === 0,
  } satisfies {
    sections: GlassSidebarSection[];
    routeThreadId: string | null;
    selectedId: string | null;
    selected: GlassSidebarChat | null;
    loading: boolean;
    error: boolean;
  };
}
