import { PROVIDER_INTENT_ROWS, type ProviderIntentStatus } from "~/lib/provider-intent-map";
import { cn } from "~/lib/utils";

function chip(status: ProviderIntentStatus) {
  if (status === "rendered") {
    return "border-emerald-500/35 bg-emerald-500/12 text-emerald-300";
  }
  if (status === "hidden") {
    return "border-amber-500/35 bg-amber-500/12 text-amber-300";
  }
  return "border-muted-foreground/35 bg-muted/30 text-muted-foreground";
}

export function ProviderIntentsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-1 py-2">
      <div className="space-y-1">
        <h1 className="font-semibold tracking-tight text-foreground">Provider intents debug</h1>
        <p className="text-muted-foreground">
          Full provider runtime intent list with the corresponding chat UI renderer mapping.
        </p>
      </div>
      <div className="overflow-hidden rounded-glass-card border border-glass-border/45 bg-glass-bubble/55 shadow-glass-card">
        <div className="grid grid-cols-[1.1fr_1.7fr_0.65fr_1.55fr] gap-3 border-b border-glass-border/45 px-4 py-2.5 text-body/[1.25] font-medium text-foreground/85">
          <div>Intent</div>
          <div>Component</div>
          <div>Status</div>
          <div>Intent purpose</div>
        </div>
        <div className="max-h-[calc(100dvh-15rem)] overflow-auto">
          {PROVIDER_INTENT_ROWS.map((row) => (
            <div
              key={row.eventType}
              className="grid grid-cols-[1.1fr_1.7fr_0.65fr_1.55fr] gap-3 border-b border-glass-border/30 px-4 py-2.5 last:border-b-0"
            >
              <code className="font-glass-mono text-detail/[1.4] text-foreground/88">
                {row.eventType}
              </code>
              <div className="space-y-0.5">
                <code className="font-glass-mono text-detail/[1.4] text-foreground/82">
                  {row.componentName}
                </code>
                <div className="text-detail/[1.4] text-muted-foreground">{row.note}</div>
              </div>
              <span
                className={cn(
                  "inline-flex h-6 items-center justify-center rounded-full border px-2 text-detail/[1.25] font-medium",
                  chip(row.status),
                )}
              >
                {row.status}
              </span>
              <div className="text-detail/[1.45] text-muted-foreground">{row.intent}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
