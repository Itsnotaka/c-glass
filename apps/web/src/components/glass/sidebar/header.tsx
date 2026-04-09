import { IconCollaborationPointerRight } from "central-icons";

import { GlassRowButton } from "./row-button";

export function GlassSidebarHeader(props: { onNewChat: () => void }) {
  return (
    <div className="relative z-30 shrink-0 px-2 pb-2 pt-1.5">
      <GlassRowButton variant="chrome" onClick={props.onNewChat}>
        <IconCollaborationPointerRight className="size-4 shrink-0 opacity-60" />
        <span>New Agent</span>
      </GlassRowButton>
    </div>
  );
}
