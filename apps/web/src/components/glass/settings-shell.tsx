"use client";

import { Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useGlassShellPanels } from "../../hooks/use-glass-shell-panels";
import { useShellState } from "../../hooks/use-shell-cwd";
import { useGlassShellStore } from "../../lib/glass-shell-store";
import { GlassAppShell } from "./glass-app-shell";
import { GlassSettingsNavRail } from "./glass-settings-nav-rail";
import { GlassSidebarFooter } from "./glass-sidebar-footer";

export function GlassSettingsShell() {
  const navigate = useNavigate();
  const match = useMatchRoute();
  const { cwd } = useShellState();
  const p = useGlassShellPanels(cwd);
  const mute = useGlassShellStore((state) => state.mute);
  const setRightOpen = p.setRightOpen;
  const title = match({ to: "/settings/appearance" })
    ? "Appearance"
    : match({ to: "/settings/agents" })
      ? "Agents"
      : match({ to: "/settings/extensions" })
        ? "Extensions"
        : match({ to: "/settings/archived" })
          ? "Archived"
          : "Settings";

  useEffect(() => {
    if (cwd) mute(cwd);
    setRightOpen(false);
  }, [cwd, mute, setRightOpen]);

  return (
    <GlassAppShell
      title={title}
      changesCount={0}
      onBack={() => void navigate({ to: "/" })}
      panels={p}
      left={
        <div className="glass-thread-rail-pad flex min-h-0 flex-1 flex-col px-0">
          <GlassSettingsNavRail />
          <GlassSidebarFooter settings />
        </div>
      }
      center={
        <div className="flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden px-4 py-4">
          <Outlet />
        </div>
      }
      right={null}
    />
  );
}
