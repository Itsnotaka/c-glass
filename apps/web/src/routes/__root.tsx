import {
  Link,
  Outlet,
  createRootRouteWithContext,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { startTransition, useEffect } from "react";
import { APP_DISPLAY_NAME } from "../branding";
import { AppSidebarLayout } from "../components/app-sidebar-layout";
import { readGlass } from "../host";
import { PI_GLASS_SHELL_CHANGED_EVENT } from "../lib/pi-glass-constants";
import { usePiStore } from "../lib/pi-session-store";
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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,color-mix(in_srgb,var(--color-destructive)_10%,transparent),transparent)]" />
      </div>

      <section className="relative w-full max-w-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground/60">
          {APP_DISPLAY_NAME}
        </p>
        <h1 className="mt-4 text-xl font-medium tracking-tight text-foreground/90 sm:text-2xl">
          Something went wrong
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground/70">{message}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => reset()}>
            Try again
          </Button>
          <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
            Reload app
          </Button>
        </div>

        <details className="group mt-6 overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
          <summary className="cursor-pointer list-none px-4 py-2.5 text-[11px] font-medium text-muted-foreground/60 transition-colors hover:text-muted-foreground/80">
            <span className="group-open:hidden">Show details</span>
            <span className="hidden group-open:inline">Hide details</span>
          </summary>
          <pre className="max-h-64 overflow-auto border-t border-border/40 px-4 py-3 font-mono text-[11px]/[1.5] text-foreground/70">
            {details}
          </pre>
        </details>
      </section>
    </div>
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
