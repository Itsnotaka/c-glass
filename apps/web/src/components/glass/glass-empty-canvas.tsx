import { isElectron } from "../../env";
import { GlassChatSession } from "./glass-chat-session";
import { GlassWorkspacePicker } from "./glass-workspace-picker";

export function GlassEmptyCanvas(props: { sessionId: string }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-glass-editor">
      {isElectron ? (
        <div className="drag-region flex h-[var(--glass-header-height)] shrink-0 items-center justify-center border-b border-glass-border/80 bg-glass-menubar/80 px-6 backdrop-blur-xl">
          <GlassWorkspacePicker />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <GlassChatSession sessionId={props.sessionId} />
      </div>
    </div>
  );
}
