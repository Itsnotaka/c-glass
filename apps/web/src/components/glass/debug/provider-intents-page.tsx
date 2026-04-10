import {
  EventId,
  PROVIDER_NOTICE_KIND,
  type GlassSessionItem,
  type OrchestrationThreadActivity,
} from "@glass/contracts";
import {
  PROVIDER_INTENT_ROWS,
  type ProviderIntentRow,
  type ProviderIntentStatus,
} from "~/lib/provider-intent-map";
import { GlassChatTranscript } from "~/components/glass/chat/rows";
import { GlassProviderNoticeBanner } from "~/components/glass/provider/notice-banner";
import { isElectron } from "~/env";
import { useCopyToClipboard } from "~/hooks/use-copy-to-clipboard";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

function debugIntentsDeepLink() {
  if (typeof window === "undefined") return "#/debug/intents";
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}#/debug/intents`;
}

function chip(status: ProviderIntentStatus) {
  if (status === "rendered") {
    return "border-emerald-500/35 bg-emerald-500/12 text-emerald-300";
  }
  if (status === "hidden") {
    return "border-amber-500/35 bg-amber-500/12 text-amber-300";
  }
  return "border-muted-foreground/35 bg-muted/30 text-muted-foreground";
}

function args(name: string) {
  if (name === "read") return { path: "README.md" };
  if (name === "edit") {
    return { path: "src/app.tsx", oldText: "const val = 1;", newText: "const val = 2;" };
  }
  if (name === "write") return { path: "notes.txt", content: "Hello from debug preview." };
  if (name === "bash") return { command: "echo hello" };
  if (name === "grep") return { pattern: "ProviderRuntimeEvent", path: "packages/contracts/src" };
  if (name === "find") return { query: "provider intent page" };
  if (name === "ask") return { questions: [{ id: "q1", question: "Proceed?", options: ["yes"] }] };
  if (name === "ls") return { path: "apps/web/src" };
  return { payload: "fallback preview" };
}

function out(name: string) {
  if (name === "read") return "export const hello = true;";
  if (name === "edit") return "Applied 1 edit.";
  if (name === "write") return "Wrote notes.txt";
  if (name === "bash") return "hello";
  if (name === "grep")
    return "packages/contracts/src/providerRuntime.ts:144:const ProviderRuntimeEventType";
  if (name === "find") return "apps/web/src/components/glass/debug/provider-intents-page.tsx";
  if (name === "ask") return '{"answers":{"q1":"yes"}}';
  if (name === "ls") return "components\nhooks\nlib\nroutes";
  return '{"ok":true,"mode":"fallback"}';
}

function toolItems(row: ProviderIntentRow, name: string): GlassSessionItem[] {
  const call = `${row.eventType}:${name}:call`;
  const key = `${row.eventType}:${name}`;
  const tool = name === "fallback" ? "custom_tool" : name;
  return [
    {
      id: `${key}:assistant`,
      message: {
        role: "assistant",
        content: [{ type: "toolCall", id: call, name: tool, arguments: args(name) }],
      },
    },
    {
      id: `${key}:result`,
      message: {
        role: "toolResult",
        toolCallId: call,
        toolName: tool,
        content: [{ type: "text", text: out(name) }],
      },
    },
  ];
}

function msgItems(row: ProviderIntentRow): GlassSessionItem[] {
  if (row.componentName === "AssistantBlock") {
    return [
      {
        id: `${row.eventType}:assistant`,
        message: {
          role: "assistant",
          content: [{ type: "text", text: `Preview for ${row.eventType}` }],
        },
      },
    ];
  }
  return [
    {
      id: `${row.eventType}:custom`,
      message: {
        role: "custom",
        customType: row.eventType,
        display: true,
        content: `Preview for ${row.eventType}`,
      },
    },
  ];
}

function notice(row: ProviderIntentRow): OrchestrationThreadActivity {
  const kind =
    row.eventType === "auth.status"
      ? PROVIDER_NOTICE_KIND.auth
      : row.eventType === "account.rate-limits.updated"
        ? PROVIDER_NOTICE_KIND.rateLimit
        : PROVIDER_NOTICE_KIND.config;
  const tone = kind === PROVIDER_NOTICE_KIND.auth ? "error" : "info";
  return {
    id: EventId.makeUnsafe(`preview:${row.eventType}`),
    tone,
    kind,
    summary: "Provider notice preview",
    payload: {
      provider: "codex",
      title: `Preview ${kind}`,
      detail: `Live component preview for ${row.eventType}.`,
    },
    turnId: null,
    createdAt: new Date().toISOString(),
  };
}

function preview(row: ProviderIntentRow) {
  if (row.componentName === "ToolCard") {
    const list = row.toolRenderers ?? ["fallback"];
    return (
      <div className="space-y-1.5">
        {list.map((name) => (
          <div
            key={`${row.eventType}:${name}`}
            className="rounded-glass-control border border-glass-border/35 bg-background/25 p-1.5"
          >
            <div className="px-1 pb-1 font-glass-mono text-caption text-muted-foreground/70">
              {name}
            </div>
            <ul className="list-none p-0">
              <GlassChatTranscript items={toolItems(row, name)} expanded wide={0} />
            </ul>
          </div>
        ))}
      </div>
    );
  }

  if (row.componentName === "AssistantBlock" || row.componentName === "TextCard") {
    return (
      <div className="rounded-glass-control border border-glass-border/35 bg-background/25 p-1.5">
        <ul className="list-none p-0">
          <GlassChatTranscript items={msgItems(row)} expanded wide={0} />
        </ul>
      </div>
    );
  }

  if (row.componentName === "GlassProviderNoticeBanner") {
    return (
      <div className="rounded-glass-control border border-glass-border/35 bg-background/25 py-1">
        <GlassProviderNoticeBanner
          sessionId={`preview:${row.eventType}`}
          provider="codex"
          activities={[notice(row)]}
        />
      </div>
    );
  }

  return <span className="text-detail/[1.35] text-muted-foreground">No visible component</span>;
}

export function ProviderIntentsPage() {
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-1 py-2">
      <div className="space-y-1">
        <h1 className="font-semibold tracking-tight text-foreground">Provider intents debug</h1>
        <p className="text-muted-foreground">
          Full provider runtime intent list with the corresponding chat UI renderer mapping.
        </p>
        {isElectron ? (
          <div className="mt-3 rounded-glass-card border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-body/[1.35] text-foreground/90">
            <p className="text-muted-foreground">
              Desktop uses <span className="font-medium text-foreground">hash routing</span>. Paste
              or bookmark{" "}
              <code className="rounded bg-background/50 px-1 py-0.5 font-glass-mono text-detail">
                #/debug/intents
              </code>{" "}
              after the app URL (for example{" "}
              <code className="rounded bg-background/50 px-1 py-0.5 font-glass-mono text-detail">
                http://localhost:5733/#/debug/intents
              </code>
              ). Opening{" "}
              <code className="rounded bg-background/50 px-1 py-0.5 font-glass-mono text-detail">
                /debug/intents
              </code>{" "}
              in the address bar without the hash will not load this route.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => void copyToClipboard(debugIntentsDeepLink())}
              >
                {isCopied ? "Copied" : "Copy deep link"}
              </Button>
              <code className="max-w-full truncate font-glass-mono text-detail text-muted-foreground">
                {debugIntentsDeepLink()}
              </code>
            </div>
          </div>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-glass-card border border-glass-border/45 bg-glass-bubble/55 shadow-glass-card">
        <div className="grid grid-cols-[0.95fr_1.05fr_1.6fr_0.65fr_1.15fr] gap-3 border-b border-glass-border/45 px-4 py-2.5 text-body/[1.25] font-medium text-foreground/85">
          <div>Intent</div>
          <div>Component</div>
          <div>Preview</div>
          <div>Status</div>
          <div>Intent purpose</div>
        </div>
        <div className="max-h-[calc(100dvh-15rem)] overflow-auto">
          {PROVIDER_INTENT_ROWS.map((row) => (
            <div
              key={row.eventType}
              className="grid grid-cols-[0.95fr_1.05fr_1.6fr_0.65fr_1.15fr] gap-3 border-b border-glass-border/30 px-4 py-2.5 last:border-b-0"
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
              <div className="min-w-0">{preview(row)}</div>
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
