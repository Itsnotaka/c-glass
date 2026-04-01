import { ExternalLinkIcon, LightbulbIcon } from "lucide-react";

const PLAN_PROMPT = "Help me plan out this project. Break it down into phases and key milestones.";

export function GlassQuickActions(props: {
  onPrompt: (prompt: string) => void;
  onOpenInEditor: () => void;
}) {
  return (
    <div className="glass-quick-actions">
      <button
        type="button"
        className="glass-quick-action-chip"
        onClick={() => props.onPrompt(PLAN_PROMPT)}
      >
        <LightbulbIcon className="size-3.5 shrink-0 opacity-60" />
        <span className="glass-quick-action-label">Plan it out</span>
      </button>
      <button type="button" className="glass-quick-action-chip" onClick={props.onOpenInEditor}>
        <ExternalLinkIcon className="size-3.5 shrink-0 opacity-60" />
        <span className="glass-quick-action-label">Open in editor</span>
      </button>
    </div>
  );
}
