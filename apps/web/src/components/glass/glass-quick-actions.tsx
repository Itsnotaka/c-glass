import { ExternalLinkIcon, LightbulbIcon } from "lucide-react";

const PLAN = "Help me plan out this project. Break it down into phases and key milestones.";
const chip =
  "font-glass inline-flex min-h-7 items-center gap-1.5 rounded-full border border-glass-stroke bg-glass-bubble px-2.5 text-xs/[17px] text-muted-foreground shadow-glass-card backdrop-blur-md transition-colors hover:border-glass-stroke-strong hover:bg-glass-hover hover:text-foreground";

export function GlassQuickActions(props: {
  onPrompt: (prompt: string) => void;
  onOpenInEditor: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={chip} onClick={() => props.onPrompt(PLAN)}>
        <LightbulbIcon className="size-3.5 shrink-0 opacity-60" />
        <span>Plan it out</span>
      </button>
      <button type="button" className={chip} onClick={props.onOpenInEditor}>
        <ExternalLinkIcon className="size-3.5 shrink-0 opacity-60" />
        <span>Open in editor</span>
      </button>
    </div>
  );
}
