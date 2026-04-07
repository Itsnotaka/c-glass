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
import { PI_GLASS_EDITOR_SET_EVENT, PI_GLASS_SHELL_CHANGED_EVENT } from "../lib/pi-glass-constants";
import { peekComposerDraft } from "../lib/pi-composer-draft-mirror";
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
      <DesktopExtUiBridge />
      <AppSidebarLayout>
        <Outlet />
      </AppSidebarLayout>
      <Toaster />
    </>
  );
}

function DesktopExtUiBridge() {
  useEffect(() => {
    const glass = readGlass();
    if (!glass) return;

    const offReq = glass.desktop.onExtensionUiRequest?.((req) => {
      const reply = async (value: { cancelled?: boolean; value?: string | boolean }) => {
        await glass.desktop.replyExtensionUi?.({ id: req.id, ...value });
      };

      if (req.type === "confirm") {
        void reply({ value: window.confirm(`${req.title}\n\n${req.message}`) });
        return;
      }

      if (req.type === "input") {
        const val = window.prompt(req.title, req.placeholder ?? "");
        void reply(val === null ? { cancelled: true } : { value: val });
        return;
      }

      if (req.type === "editor") {
        const val = window.prompt(req.title, req.prefill ?? "");
        void reply(val === null ? { cancelled: true } : { value: val });
        return;
      }

      if (req.type === "select") {
        const lines = req.options.map((item, i) => `${i + 1}. ${item}`).join("\n");
        const val = window.prompt(`${req.title}\n\n${lines}`, req.options[0] ?? "");
        if (val === null) {
          void reply({ cancelled: true });
          return;
        }
        const num = Number(val);
        if (Number.isInteger(num) && num >= 1 && num <= req.options.length) {
          const pick = req.options[num - 1];
          if (!pick) {
            void reply({ cancelled: true });
            return;
          }
          void reply({ value: pick });
          return;
        }
        const hit = req.options.find((item) => item === val);
        if (!hit) {
          void reply({ cancelled: true });
          return;
        }
        void reply({ value: hit });
        return;
      }

      if (req.type === "get-editor") {
        void reply({ value: peekComposerDraft() });
      }
    });

    const offNotify = glass.desktop.onExtensionUiNotify?.((item) => {
      const type =
        item.type === "error" ? toast.error : item.type === "warning" ? toast.warning : toast;
      type(item.message);
    });

    const offSet = glass.desktop.onExtensionSetEditor?.((item) => {
      window.dispatchEvent(new CustomEvent(PI_GLASS_EDITOR_SET_EVENT, { detail: item.text }));
    });

    return () => {
      offReq?.();
      offNotify?.();
      offSet?.();
    };
  }, []);

  return null;
}

function PiBootBridge() {
  const boot = usePiStore((state) => state.boot);
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
      fetch("http://localhost:60380/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "ui-refresh-sums-sync",
          data: { visibility: document.visibilityState },
        }),
      }).catch(() => {});
      void refreshSums();
    };

    const reload = () => {
      void boot();
    };

    const shell = () => {
      reset();
      reload();
    };

    const offSummary = glass.session.onSummary((event) => {
      fetch("http://localhost:60380/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: "ui-on-summary",
          data: { sessionId: event.sessionId, type: event.type },
        }),
      }).catch(() => {});
      startTransition(() => {
        applySummaryEvent(event);
      });
    });
    const offBoot = glass.desktop.onBootRefresh?.(reload) ?? (() => {});

    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener(PI_GLASS_SHELL_CHANGED_EVENT, shell);

    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener(PI_GLASS_SHELL_CHANGED_EVENT, shell);
      offSummary();
      offBoot();
    };
  }, [applySummaryEvent, boot, refreshSums, reset]);

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
        <p className="mt-8 font-mono text-[8rem]/1 font-bold tracking-tighter text-foreground/4 sm:text-[10rem] select-none">
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
              onClick={() => void copy()}
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
