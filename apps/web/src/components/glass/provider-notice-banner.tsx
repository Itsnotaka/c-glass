import {
  IconChevronBottom,
  IconCrossSmall,
  IconLightning,
  IconSettingsGear2,
  IconX,
} from "central-icons";
import type { OrchestrationThreadActivity, ProviderKind } from "@glass/contracts";
import { PROVIDER_NOTICE_KIND } from "@glass/contracts";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { useProviderNoticeDevStore } from "../../dev/provider-notice-dev-store";
import { readEvlog, subscribeEvlog, type EvlogEntry } from "../../lib/evlog";
import { deriveProviderNotice, formatNoticeWait } from "../../lib/provider-notice";
import { cn } from "../../lib/utils";
import { Button } from "~/components/ui/button";

function obj(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const next = value.trim();
  if (next.length === 0) {
    return null;
  }
  return next;
}

function thread(entry: EvlogEntry): string | null {
  const data = obj(entry.data);
  if (!data) {
    return null;
  }
  if (typeof data.threadId === "string") {
    return data.threadId;
  }
  const payload = obj(data.payload);
  if (typeof payload?.threadId === "string") {
    return payload.threadId;
  }
  return null;
}

function notice(entry: EvlogEntry): boolean {
  const data = obj(entry.data);
  if (!data || data.type !== "thread.activity.append") {
    return false;
  }
  const payload = obj(data.payload);
  const activity = obj(payload?.activity);
  const kind = str(activity?.kind);
  return kind?.startsWith("provider.notice.") ?? false;
}

function pretty(value: unknown) {
  const text = JSON.stringify(value, null, 2);
  return typeof text === "string" ? text : String(value);
}

function Icon(props: { kind: string; level: "warning" | "error" }) {
  if (props.kind === PROVIDER_NOTICE_KIND.config) {
    return (
      <IconSettingsGear2
        className={cn(
          "size-4 shrink-0",
          props.level === "error" ? "text-destructive/85" : "text-amber-300/85",
        )}
      />
    );
  }
  if (props.kind === PROVIDER_NOTICE_KIND.auth) {
    return (
      <IconX
        className={cn(
          "size-4 shrink-0",
          props.level === "error" ? "text-destructive/85" : "text-amber-300/85",
        )}
      />
    );
  }
  return (
    <IconLightning
      className={cn(
        "size-4 shrink-0",
        props.level === "error" ? "text-destructive/85" : "text-amber-300/85",
      )}
    />
  );
}

function tone(level: "warning" | "error") {
  if (level === "error") {
    return {
      shell: "border-destructive/30 bg-destructive/8",
      text: "text-destructive/92",
      sub: "text-destructive/75",
      line: "bg-destructive/16",
    };
  }
  return {
    shell: "border-amber-300/18 bg-amber-300/7",
    text: "text-foreground/90",
    sub: "text-foreground/68",
    line: "bg-amber-300/12",
  };
}

export function GlassProviderNoticeBanner(props: {
  sessionId: string;
  provider: ProviderKind | null;
  activities: readonly OrchestrationThreadActivity[];
}) {
  const force = useProviderNoticeDevStore((state) => state.force);
  const logs = useProviderNoticeDevStore((state) => state.logs);
  const all = useProviderNoticeDevStore((state) => state.all);
  const raw = useProviderNoticeDevStore((state) => state.raw);
  const rows = useSyncExternalStore(subscribeEvlog, readEvlog, () => []);
  const [now, setNow] = useState(Date.now());
  const [gone, setGone] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const item = deriveProviderNotice({
    activities: props.activities,
    provider: props.provider,
    force: force,
    now,
  });
  const show = item !== null && gone !== item.id;

  useEffect(() => {
    if (!show || item?.until === null) {
      return;
    }
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [item?.until, show]);

  useEffect(() => {
    if (!show || item?.id !== gone) {
      return;
    }
    setOpen(false);
  }, [gone, item?.id, show]);

  const list = useMemo(() => {
    const current = rows.filter((entry) => thread(entry) === props.sessionId);
    if (all) {
      return rows.slice(-80);
    }
    return current.filter(notice).slice(-40);
  }, [all, props.sessionId, rows]);

  const debug = import.meta.env.DEV && (logs || all || raw);
  if (!show && !debug) {
    return null;
  }

  const view = item;
  const style = tone(view?.level ?? "warning");
  const wait = view?.until ? formatNoticeWait(view.until, now) : null;
  const text =
    view?.kind === PROVIDER_NOTICE_KIND.rateLimit && wait
      ? `The next message can be sent after ${wait}.`
      : (view?.detail ?? null);

  return (
    <div className="px-4 pt-4 md:px-8">
      <section
        className={cn(
          "mx-auto flex max-w-[43.875rem] min-w-0 flex-col overflow-hidden rounded-glass-card border shadow-glass-card backdrop-blur-xl",
          style.shell,
        )}
      >
        {view ? (
          <div className="flex min-w-0 items-start gap-3 px-3 py-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-glass-control border border-white/6 bg-black/10">
              <Icon kind={view.kind} level={view.level} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate font-medium text-body/[1.25]", style.text)}>
                    {view.title}
                  </p>
                  {text ? <p className={cn("mt-1 text-body/[1.45]", style.sub)}>{text}</p> : null}
                </div>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Dismiss provider notice"
                  onClick={() => setGone(view.id)}
                  className="shrink-0 border-transparent bg-transparent text-muted-foreground/70 hover:text-foreground"
                >
                  <IconCrossSmall className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-3 px-3 py-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-glass-control border border-white/6 bg-black/10">
              <IconSettingsGear2 className="size-4 shrink-0 text-foreground/72" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-body/[1.25] text-foreground/86">
                Provider debug
              </p>
              <p className="mt-1 text-body/[1.45] text-muted-foreground/72">
                Notice logs are visible for this thread in dev mode.
              </p>
            </div>
          </div>
        )}

        {debug ? (
          <div className={cn("border-t px-3 py-2", style.line)}>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="flex w-full min-w-0 items-center justify-between gap-3 text-left"
            >
              <span className="min-w-0 truncate text-detail font-medium text-foreground/76">
                {all ? "All logs" : "Notice logs"}
                {list.length > 0 ? ` · ${String(list.length)}` : " · 0"}
              </span>
              <IconChevronBottom
                className={cn(
                  "size-3 shrink-0 text-muted-foreground/70 transition-transform duration-150",
                  open ? "rotate(0deg)" : "-rotate-90",
                )}
              />
            </button>
            {open ? (
              <div className="mt-2 flex flex-col gap-2">
                {raw && view ? (
                  <pre className="overflow-x-auto rounded-glass-control border border-glass-border/45 bg-black/18 px-3 py-2 font-mono text-detail/[1.45] whitespace-pre-wrap text-foreground/78">
                    {pretty(view.raw)}
                  </pre>
                ) : null}
                {list.length === 0 ? (
                  <p className="rounded-glass-control border border-glass-border/45 bg-black/12 px-3 py-2 text-detail/[1.45] text-muted-foreground/72">
                    No matching logs yet.
                  </p>
                ) : (
                  list.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-glass-control border border-glass-border/45 bg-black/12 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2 text-detail/[1.3] text-foreground/76">
                        <span className="shrink-0 font-medium">#{String(entry.id)}</span>
                        <span className="shrink-0 uppercase text-[10px] tracking-[0.12em] text-muted-foreground/70">
                          {entry.kind}
                        </span>
                        <span className="min-w-0 truncate text-muted-foreground/80">
                          {entry.label}
                        </span>
                      </div>
                      {raw ? (
                        <pre className="mt-2 overflow-x-auto font-mono text-detail/[1.45] whitespace-pre-wrap text-foreground/72">
                          {pretty(entry.data)}
                        </pre>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
