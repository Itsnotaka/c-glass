import { GlassChatSession } from "./glass-chat-session";

export function GlassEmptyCanvas(props: { sessionId: string }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-glass-editor">
      <div className="flex min-h-0 flex-1 flex-col">
        <GlassChatSession sessionId={props.sessionId} />
      </div>
    </div>
  );
}
