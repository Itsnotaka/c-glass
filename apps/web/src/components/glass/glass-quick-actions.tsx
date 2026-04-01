import { LightbulbIcon, SearchIcon, BugIcon } from "lucide-react";

const actions = [
  {
    id: "plan",
    label: "Plan it out",
    icon: LightbulbIcon,
    prompt: "Help me plan out this project. Break it down into phases and key milestones.",
  },
  {
    id: "research",
    label: "Research codebase",
    icon: SearchIcon,
    prompt:
      "Explore the codebase and give me an overview of the architecture, key patterns, and how things are organized.",
  },
  {
    id: "debug",
    label: "Debug component",
    icon: BugIcon,
    prompt: "Help me debug an issue. I'll describe the problem and you can help me investigate.",
  },
] as const;

export function GlassQuickActions(props: { onAction: (prompt: string) => void }) {
  return (
    <div className="glass-quick-actions">
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          className="glass-quick-action-chip"
          onClick={() => props.onAction(a.prompt)}
        >
          <a.icon className="size-3.5 shrink-0 opacity-60" />
          <span className="glass-quick-action-label">{a.label}</span>
        </button>
      ))}
    </div>
  );
}
