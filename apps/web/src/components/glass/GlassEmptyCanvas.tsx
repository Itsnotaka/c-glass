import { isElectron } from "../../env";
import { GlassChatSession } from "./glass-chat-session";
import { GlassWorkspacePicker } from "./GlassWorkspacePicker";

export function GlassEmptyCanvas({ sessionId }: { sessionId: string }) {
  return (
    <div className="glass-pi-shell flex min-h-0 min-w-0 flex-1 flex-col bg-glass-canvas">
      {isElectron ? (
        <div className="drag-region flex h-[35px] shrink-0 items-center justify-center px-6">
          <GlassWorkspacePicker />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <GlassChatSession sessionId={sessionId} />
      </div>
    </div>
  );
}
