import { FolderIcon } from "lucide-react";

import { useHandleNewThread } from "../../hooks/useHandleNewThread";
import { useProjectById } from "../../storeSelectors";

export function GlassWorkspacePicker() {
  const thread = useHandleNewThread();
  const project = useProjectById(thread.defaultProjectId);

  return (
    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground/60">
      <FolderIcon className="size-3 shrink-0" />
      <span className="truncate">{project?.name ?? "Workspace"}</span>
    </div>
  );
}
