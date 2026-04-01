import { useMemo } from "react";
import { inferCheckpointTurnCountByTurnId } from "../session-logic";
import type { Thread } from "../types";

export function useTurnDiffSummaries(activeThread: Thread | undefined) {
  return useMemo(() => {
    const turnDiffSummaries = activeThread?.turnDiffSummaries ?? [];
    return {
      turnDiffSummaries,
      inferredCheckpointTurnCountByTurnId: inferCheckpointTurnCountByTurnId(turnDiffSummaries),
    };
  }, [activeThread]);
}
