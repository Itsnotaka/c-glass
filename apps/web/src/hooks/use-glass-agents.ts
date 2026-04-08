import { useMatchRoute, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  buildWorkspaceChatSections,
  type GlassSidebarChat,
  type GlassSidebarSection,
} from "../lib/glass-view-model";
import { useGlassChatDraftStore } from "../lib/glass-chat-draft-store";
import { useThreadSummaries, useThreadSummariesStatus } from "../lib/thread-session-store";

const THREAD_ROUTE = "/$threadId";

function useShellThreadId() {
  const id = useParams({
    strict: false,
    select: (params) => (typeof params.threadId === "string" ? params.threadId : null),
  });
  const match = useMatchRoute();
  const pend = match({ to: THREAD_ROUTE, pending: true });
  if (pend && typeof pend.threadId === "string") return pend.threadId;
  return id;
}

export function useGlassAgents(cwd: string | null, home: string | null) {
  const sums = useThreadSummaries();
  const status = useThreadSummariesStatus();
  const routeThreadId = useShellThreadId();
  const draftId = useGlassChatDraftStore((state) => state.cur);
  const items = useGlassChatDraftStore((state) => state.items);
  const drafts = useMemo(() => Object.values(items), [items]);
  const selectedId = routeThreadId ?? draftId;

  const sections = useMemo(
    () => buildWorkspaceChatSections(status === "ready" ? sums : {}, drafts, selectedId, cwd, home),
    [cwd, drafts, home, selectedId, status, sums],
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
