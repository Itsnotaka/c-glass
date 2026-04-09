import type { CommandId, ThreadId } from "@glass/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";

import { useGlassChatDraftStore } from "~/lib/glass-chat-draft-store";
import { readNativeApi } from "~/native-api";
import { useStore } from "~/store";

import { useRouteThreadId } from "./use-route-thread-id";

const commandId = (): CommandId => crypto.randomUUID() as CommandId;

export function useThreadActions() {
  const navigate = useNavigate();
  const routeThreadId = useRouteThreadId();
  const pick = useGlassChatDraftStore((s) => s.pick);

  const commitRename = useCallback(
    async (threadId: ThreadId, newTitle: string, originalTitle: string) => {
      const trimmed = newTitle.trim();
      if (trimmed.length === 0) {
        toast.warning("Thread title cannot be empty");
        return;
      }
      if (trimmed === originalTitle) return;
      const api = readNativeApi();
      if (!api) return;
      try {
        await api.orchestration.dispatchCommand({
          type: "thread.meta.update",
          commandId: commandId(),
          threadId,
          title: trimmed,
        });
      } catch (error) {
        toast.error("Failed to rename thread", {
          description: error instanceof Error ? error.message : "An error occurred.",
        });
      }
    },
    [],
  );

  const archiveThread = useCallback(
    async (threadId: ThreadId) => {
      const api = readNativeApi();
      if (!api) return;
      const thread = useStore.getState().threads.find((item) => item.id === threadId);
      if (thread?.session?.status === "running" && thread.session.activeTurnId != null) {
        toast.error("Cannot archive a running thread.");
        return;
      }
      try {
        await api.orchestration.dispatchCommand({
          type: "thread.archive",
          commandId: commandId(),
          threadId,
        });
      } catch (error) {
        toast.error("Failed to archive thread", {
          description: error instanceof Error ? error.message : "An error occurred.",
        });
        return;
      }
      if (routeThreadId === threadId) {
        pick(null);
        await navigate({ to: "/" });
      }
    },
    [navigate, pick, routeThreadId],
  );

  return { commitRename, archiveThread };
}
