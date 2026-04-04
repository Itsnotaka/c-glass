import {
  Link,
  Outlet,
  createRootRouteWithContext,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { startTransition, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { APP_DISPLAY_NAME } from "../branding";
import { AppSidebarLayout } from "../components/app-sidebar-layout";
import { readGlass } from "../host";
import { PI_GLASS_SHELL_CHANGED_EVENT } from "../lib/pi-glass-constants";
import { usePiStore } from "../lib/pi-session-store";
import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard";
import { Button, buttonVariants } from "~/components/ui/button";
import { Toaster } from "~/components/ui/sonner";

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
      <PiBootBridge />
      <AppSidebarLayout>
        <Outlet />
      </AppSidebarLayout>
      <Toaster />
    </>
  );
}

function PiBootBridge() {
  const boot = usePiStore((state) => state.boot);
  const refreshCfg = usePiStore((state) => state.refreshCfg);
  const refreshSums = usePiStore((state) => state.refreshSums);
  const reset = usePiStore((state) => state.resetForWorkspaceChange);
  const applySummaryEvent = usePiStore((state) => state.applySummaryEvent);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    const glass = readGlass();
    if (!glass) return;

    const sync = () => {
      if (document.visibilityState === "hidden") return;
      void refreshSums();
    };

    const reload = () => {
      void Promise.all([refreshCfg(), refreshSums()]);
    };

    const shell = () => {
      reset();
      reload();
    };

    const offSummary = glass.session.onSummary((event) => {
      startTransition(() => {
        applySummaryEvent(event);
      });
    });
    const offBoot = glass.desktop.onBootRefresh?.(reload);

    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener(PI_GLASS_SHELL_CHANGED_EVENT, shell);

    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener(PI_GLASS_SHELL_CHANGED_EVENT, shell);
      offSummary();
      offBoot?.();
    };
  }, [applySummaryEvent, refreshCfg, refreshSums, reset]);

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
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground/60">
          {APP_DISPLAY_NAME}
        </p>
        <p className="mt-8 font-mono text-[8rem] leading-none font-bold tracking-tighter text-foreground/[0.04] sm:text-[10rem] select-none">
          404
        </p>
        <div className="-mt-16 sm:-mt-20">
          <h1 className="text-lg font-medium tracking-tight text-foreground/90">Page not found</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground/70">
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
  const message = errorMessage(error);
  const details = errorDetails(error);
  const report = formatErrorReport(error);
  const href = typeof window !== "undefined" ? window.location.href : "";
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  const copy = useCallback(async () => {
    const ok = await copyToClipboard(report);
    if (ok) toast.success("Copied error report");
    if (!ok) toast.error("Could not copy");
  }, [copyToClipboard, report]);

  return (
    <>
      <Toaster />
      <div className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {APP_DISPLAY_NAME}
          </p>

          <h1 className="mt-6 text-lg font-medium tracking-tight text-foreground sm:text-xl">
            Something went wrong
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{message}</p>

          {href ? (
            <p className="mt-3 break-all font-mono text-[11px] text-muted-foreground">{href}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button size="sm" onClick={() => reset()}>
              Try again
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto min-h-0 px-0 py-0 text-[13px] font-normal text-muted-foreground"
              onClick={() => void copy()}
              aria-label="Copy full error report to clipboard"
            >
              {isCopied ? "Copied" : "Copy error report"}
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto min-h-0 px-0 py-0 text-[13px] font-normal text-muted-foreground"
              onClick={() => window.location.reload()}
            >
              Reload
            </Button>
          </div>

          <div className="mt-10 border-t border-border/60 pt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Stack trace
            </p>
            <pre className="mt-3 max-h-[min(28rem,55vh)] overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {details}
            </pre>
          </div>
        </div>
      </div>
    </>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "An unexpected router error occurred.";
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return "No additional error details are available.";
  }
}

function formatErrorReport(error: unknown) {
  const lines: string[] = [APP_DISPLAY_NAME];
  if (typeof window !== "undefined") lines.push(window.location.href);
  lines.push("", errorMessage(error), "", errorDetails(error));
  return lines.join("\n");
}
