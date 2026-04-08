import {
  Link,
  Outlet,
  createRootRouteWithContext,
  type ErrorComponentProps,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { APP_DISPLAY_NAME } from "../branding";
import { AppSidebarLayout } from "../components/app-sidebar-layout";
import { readNativeApi } from "../nativeApi";
import { deriveOrchestrationBatchEffects } from "../orchestrationEventEffects";
import {
  createOrchestrationRecoveryCoordinator,
  deriveReplayRetryDecision,
  type ReplayRetryTracker,
} from "../orchestrationRecovery";
import { appAtomRegistry } from "../rpc/atomRegistry";
import {
  startServerStateSync,
  useServerConfigUpdatedSubscription,
  useServerWelcomeSubscription,
} from "../rpc/serverState";
import { noteEvlogDomain } from "../lib/evlog";
import { useStore } from "../store";
import { getWsRpcClient } from "../wsRpcClient";
import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard";
import { Button, buttonVariants } from "~/components/ui/button";
import { Toaster } from "~/components/ui/sonner";
import { useThreadSessionStore } from "../lib/thread-session-store";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootRouteView,
  errorComponent: RootRouteErrorView,
  notFoundComponent: NotFoundView,
  head: () => ({
    meta: [{ name: "title", content: APP_DISPLAY_NAME }],
  }),
});

function RootRouteView() {
  return (
    <>
      <ServerStateBootstrap />
      <DomainBootstrap />
      <AppSidebarLayout>
        <Outlet />
      </AppSidebarLayout>
      <Toaster />
    </>
  );
}

function ServerStateBootstrap() {
  useEffect(() => startServerStateSync(getWsRpcClient().server), []);

  return null;
}

function coalesceOrchestrationUiEvents(events: readonly any[]) {
  if (events.length < 2) {
    return [...events];
  }

  const out: any[] = [];
  for (const event of events) {
    const prev = out.at(-1);
    if (
      prev?.type === "thread.message-sent" &&
      event.type === "thread.message-sent" &&
      prev.payload.threadId === event.payload.threadId &&
      prev.payload.messageId === event.payload.messageId
    ) {
      out[out.length - 1] = {
        ...event,
        payload: {
          ...event.payload,
          attachments: event.payload.attachments ?? prev.payload.attachments,
          createdAt: prev.payload.createdAt,
          text:
            !event.payload.streaming && event.payload.text.length > 0
              ? event.payload.text
              : prev.payload.text + event.payload.text,
        },
      };
      continue;
    }

    out.push(event);
  }

  return out;
}

const REPLAY_RECOVERY_RETRY_DELAY_MS = 100;
const MAX_NO_PROGRESS_REPLAY_RETRIES = 3;

function DomainBootstrap() {
  const syncServerReadModel = useStore((store) => store.syncServerReadModel);
  const applyOrchestrationEvents = useStore((store) => store.applyOrchestrationEvents);
  const refreshCfg = useThreadSessionStore((state) => state.refreshCfg);
  const syncDomain = useThreadSessionStore((state) => state.syncDomain);
  const pathname = useLocation({ select: (loc) => loc.pathname });
  const navigate = useNavigate();
  const pathnameRef = useRef(pathname);
  const bootstrapRef = useRef<() => Promise<void>>(async () => undefined);
  const seenUpdateRef = useRef(0);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    void refreshCfg();
  }, [refreshCfg]);

  useEffect(() => {
    const api = readNativeApi();
    if (!api) return;

    let disposed = false;
    const recovery = createOrchestrationRecoveryCoordinator();
    let tracker: ReplayRetryTracker | null = null;
    let refreshProviders = false;
    const queue: any[] = [];
    let scheduled = false;

    const syncSnapshot = (snapshot: Awaited<ReturnType<typeof api.orchestration.getSnapshot>>) => {
      syncServerReadModel(snapshot);
      syncDomain();
    };

    const applyBatch = (events: readonly any[]) => {
      const next = recovery.markEventBatchApplied(events);
      if (next.length === 0) {
        return;
      }

      const effects = deriveOrchestrationBatchEffects(next);
      if (effects.needsProviderInvalidation) {
        refreshProviders = true;
      }
      applyOrchestrationEvents(coalesceOrchestrationUiEvents(next));
      syncDomain();
    };

    const flush = () => {
      scheduled = false;
      if (disposed || queue.length === 0) {
        return;
      }
      const next = queue.splice(0, queue.length);
      applyBatch(next);
      if (refreshProviders) {
        refreshProviders = false;
        void api.server.refreshProviders().catch(() => undefined);
      }
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(flush);
    };

    const runReplayRecovery = async (reason: "sequence-gap" | "resubscribe") => {
      if (!recovery.beginReplayRecovery(reason)) {
        return;
      }

      try {
        const events = await api.orchestration.replayEvents(recovery.getState().latestSequence);
        if (!disposed) {
          applyBatch(events);
        }
      } catch {
        tracker = null;
        recovery.failReplayRecovery();
        void runSnapshotRecovery("replay-failed");
        return;
      }

      if (disposed) {
        return;
      }

      const done = recovery.completeReplayRecovery();
      const decision = deriveReplayRetryDecision({
        previousTracker: tracker,
        completion: done,
        recoveryState: recovery.getState(),
        baseDelayMs: REPLAY_RECOVERY_RETRY_DELAY_MS,
        maxNoProgressRetries: MAX_NO_PROGRESS_REPLAY_RETRIES,
      });
      tracker = decision.tracker;
      if (!decision.shouldRetry) {
        return;
      }
      if (decision.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, decision.delayMs));
        if (disposed) {
          return;
        }
      }
      void runReplayRecovery(reason);
    };

    const runSnapshotRecovery = async (reason: "bootstrap" | "replay-failed") => {
      if (!recovery.beginSnapshotRecovery(reason)) {
        return;
      }

      try {
        const snapshot = await api.orchestration.getSnapshot();
        if (!disposed) {
          syncSnapshot(snapshot);
          if (recovery.completeSnapshotRecovery(snapshot.snapshotSequence)) {
            void runReplayRecovery("sequence-gap");
          }
        }
      } catch {
        recovery.failSnapshotRecovery();
      }
    };

    bootstrapRef.current = async () => {
      await runSnapshotRecovery("bootstrap");
    };

    void bootstrapRef.current();

    const off = api.orchestration.onDomainEvent(
      (event) => {
        noteEvlogDomain(event);
        const action = recovery.classifyDomainEvent(event.sequence);
        if (action === "apply") {
          queue.push(event);
          schedule();
          return;
        }
        if (action === "recover") {
          flush();
          void runReplayRecovery("sequence-gap");
        }
      },
      {
        onResubscribe: () => {
          if (disposed) return;
          flush();
          void runReplayRecovery("resubscribe");
        },
      },
    );

    return () => {
      disposed = true;
      queue.length = 0;
      scheduled = false;
      off();
    };
  }, [applyOrchestrationEvents, navigate, refreshCfg, syncDomain, syncServerReadModel]);

  useServerWelcomeSubscription((payload) => {
    void bootstrapRef.current().then(() => {
      if (!payload.bootstrapThreadId) {
        return;
      }
      if (pathnameRef.current !== "/") {
        return;
      }
      void navigate({
        to: "/$threadId",
        params: { threadId: payload.bootstrapThreadId },
        replace: true,
      });
    });
  });

  useServerConfigUpdatedSubscription((notification) => {
    if (notification.id <= seenUpdateRef.current) {
      return;
    }
    seenUpdateRef.current = notification.id;
    void refreshCfg();
  });

  return null;
}

function NotFoundView() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,color-mix(in_srgb,var(--color-primary)_8%,transparent),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,color-mix(in_srgb,var(--color-primary)_4%,transparent),transparent)]" />
      </div>

      <section className="relative flex w-full max-w-sm flex-col items-center text-center">
        <p className="text-caption font-semibold uppercase tracking-[0.25em] text-muted-foreground/60">
          {APP_DISPLAY_NAME}
        </p>
        <p className="mt-8 select-none font-mono text-[8rem]/1 font-bold tracking-tighter text-foreground/4 sm:text-[10rem]">
          404
        </p>
        <div className="-mt-16 sm:-mt-20">
          <h1 className="text-lg font-medium tracking-tight text-foreground/90">Page not found</h1>
          <p className="mt-2 text-body/[1.625] text-muted-foreground/70">
            This path doesn&rsquo;t exist. It may have been moved or removed.
          </p>
        </div>
        <div className="mt-8 flex items-center gap-2">
          <Link to="/" className={buttonVariants({ size: "sm", variant: "default" })}>
            Back to chat
          </Link>
          <Link
            to="/settings/appearance"
            className={buttonVariants({ size: "sm", variant: "ghost" })}
          >
            Settings
          </Link>
        </div>
      </section>
    </div>
  );
}

function RootRouteErrorView({ error, reset }: ErrorComponentProps) {
  const message =
    error.message.trim().length > 0 ? error.message : "An unexpected router error occurred.";
  const details = errorDetails(error);
  const report = formatErrorReport(error);
  const href = typeof window !== "undefined" ? window.location.href : "";
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <p className="text-caption font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {APP_DISPLAY_NAME}
          </p>

          <h1 className="mt-6 text-lg font-medium tracking-tight text-foreground sm:text-xl">
            Something went wrong
          </h1>
          <p className="mt-2 text-body/[1.625] text-foreground/90">{message}</p>

          {href ? (
            <p className="mt-3 break-all font-mono text-detail text-muted-foreground">{href}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button size="sm" onClick={() => reset()}>
              Try again
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto min-h-0 px-0 py-0 text-body font-normal text-muted-foreground"
              onClick={() => {
                void copyToClipboard(report).then((ok) => {
                  if (ok) toast.success("Copied error report");
                  if (!ok) toast.error("Could not copy");
                });
              }}
              aria-label="Copy full error report to clipboard"
            >
              {isCopied ? "Copied" : "Copy error report"}
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto min-h-0 px-0 py-0 text-body font-normal text-muted-foreground"
              onClick={() => window.location.reload()}
            >
              Reload
            </Button>
          </div>

          <div className="mt-10 border-t border-border/60 pt-6">
            <p className="text-caption font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Stack trace
            </p>
            <pre className="mt-3 max-h-[min(28rem,55vh)] overflow-auto font-mono text-detail/[1.625] whitespace-pre-wrap text-muted-foreground">
              {details}
            </pre>
          </div>
        </div>
      </div>
    </>
  );
}

function errorDetails(error: ErrorComponentProps["error"]) {
  return error.stack ?? error.message;
}

function formatErrorReport(error: ErrorComponentProps["error"]) {
  const lines: string[] = [APP_DISPLAY_NAME];
  if (typeof window !== "undefined") lines.push(window.location.href);
  const msg =
    error.message.trim().length > 0 ? error.message : "An unexpected router error occurred.";
  lines.push("", msg, "", errorDetails(error));
  return lines.join("\n");
}
