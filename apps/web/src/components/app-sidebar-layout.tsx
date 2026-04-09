import { useEffect, type ReactNode } from "react";

import { GlassSettingsProvider, useGlassSettings } from "./glass/settings/context";

import { SidebarProvider } from "./ui/sidebar";

function DesktopMenuBridge(props: { children: ReactNode }) {
  const settings = useGlassSettings();

  useEffect(() => {
    const bridge = window.desktopBridge;
    if (!bridge) return;
    const unsub = bridge.onMenuAction((action) => {
      if (action !== "open-settings") return;
      settings.openSettings();
    });

    return () => {
      unsub?.();
    };
  }, [settings]);

  return <>{props.children}</>;
}

export function AppSidebarLayout(props: { children: ReactNode }) {
  return (
    <GlassSettingsProvider>
      <DesktopMenuBridge>
        <SidebarProvider defaultOpen className="min-h-dvh bg-glass-surface">
          {props.children}
        </SidebarProvider>
      </DesktopMenuBridge>
    </GlassSettingsProvider>
  );
}
