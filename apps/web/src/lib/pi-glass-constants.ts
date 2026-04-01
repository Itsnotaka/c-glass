import type { OrchestrationReadModel } from "@glass/contracts";

export const PI_GLASS_SESSIONS_CHANGED_EVENT = "pi-glass-sessions-changed";

export const EMPTY_ORCHESTRATION_READ_MODEL: OrchestrationReadModel = {
  snapshotSequence: 0,
  projects: [],
  threads: [],
  updatedAt: new Date().toISOString(),
};
