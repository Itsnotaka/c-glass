import { useEffect, type ReactNode } from "react";

import { GlassSettingsProvider, useGlassSettings } from "./glass/glass-settings-context";
import { GlassSettingsDialog } from "./glass/glass-settings-dialog";
import { GlassShellProvider } from "./glass/glass-shell-context";
import { Sidebar } from "./sidebar";
import { Sidebar as SidebarFrame, SidebarProvider, SidebarRail } from "./ui/sidebar";

const THREAD_SIDEBAR_WIDTH_STORAGE_KEY = "chat_thread_sidebar_width";
const THREAD_SIDEBAR_MIN_WIDTH = 13 * 16;
const THREAD_MAIN_CONTENT_MIN_WIDTH = 40 * 16;

function DesktopMenuBridge(props: { children: ReactNode }) {
  const settings = useGlassSettings();

  useEffect(() => {
    const handler = window.desktopBridge?.onMenuAction;
    if (typeof handler !== "function") return;

    const unsub = handler((action) => {
      if (action !== "open-settings") return;
      settings.openSettings();
    });

    return () => {
      unsub?.();
    };
  }, [settings.openSettings]);

  return <>{props.children}</>;
}

export function AppSidebarLayout(props: { children: ReactNode }) {
  return (
    <GlassShellProvider>
      <GlassSettingsProvider>
        <DesktopMenuBridge>
          <SidebarProvider defaultOpen className="glass-app min-h-0">
            <SidebarFrame
              side="left"
              collapsible="offcanvas"
              className="border-r border-glass-panel-border bg-glass-sidebar text-foreground"
              resizable={{
                minWidth: THREAD_SIDEBAR_MIN_WIDTH,
                shouldAcceptWidth: (ctx) =>
                  ctx.wrapper.clientWidth - ctx.nextWidth >= THREAD_MAIN_CONTENT_MIN_WIDTH,
                storageKey: THREAD_SIDEBAR_WIDTH_STORAGE_KEY,
              }}
            >
              <Sidebar />
              <SidebarRail />
            </SidebarFrame>
            {props.children}
          </SidebarProvider>
          <GlassSettingsDialog />
        </DesktopMenuBridge>
      </GlassSettingsProvider>
    </GlassShellProvider>
  );
}
