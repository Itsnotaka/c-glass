"use client";

import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import { isElectron } from "../../env";
import { readGlass } from "../../host";
import { useGlassAgents } from "../../hooks/use-glass-agents";
import { useGlassGitPanel } from "../../hooks/use-glass-git";
import { useGlassShellPanels } from "../../hooks/use-glass-shell-panels";
import { useShellState } from "../../hooks/use-shell-cwd";
import { useGlassNewChatStore } from "../../lib/glass-new-chat-store";
import { PI_GLASS_SHELL_CHANGED_EVENT } from "../../lib/pi-glass-constants";
import { useGlassShellStore } from "../../lib/glass-shell-store";
import { usePiStore, usePiSumsStatus } from "../../lib/pi-session-store";
import { cn } from "../../lib/utils";
import { GlassAppShell } from "./glass-app-shell";
import { GlassWorkspacePicker } from "./glass-workspace-picker";
import { GlassGitPanel } from "./glass-git-panel";
import { GlassProviderShellOverlay } from "./glass-provider-shell-overlay";
import { GlassSettingsNavRail } from "./glass-settings-nav-rail";
import { GlassSidebarFooter } from "./glass-sidebar-footer";
import { GlassThreadRail } from "./glass-thread-rail";

export function GlassChatShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const settingsMode = pathname.startsWith("/settings");
  const { cwd, home } = useShellState();
  const p = useGlassShellPanels(cwd);
  const sums = usePiStore((state) => state.sums);
  const reset = usePiStore((state) => state.resetForWorkspaceChange);
  const sumsStatus = usePiSumsStatus();
  const clear = useGlassShellStore((state) => state.clear);
  const bump = useGlassNewChatStore((state) => state.bump);
  const mute = useGlassShellStore((state) => state.mute);
  const unmute = useGlassShellStore((state) => state.unmute);
  const muted = useGlassShellStore((state) => (cwd ? Boolean(state.mutes[cwd]) : false));
  const { sections, routeThreadId, loading, error } = useGlassAgents(cwd, home);
  const git = useGlassGitPanel();
  const sum = routeThreadId ? sums[routeThreadId] : undefined;
  const rightOpen = p.rightOpen;
  const setRightOpen = p.setRightOpen;

  useEffect(() => {
    clear();
  }, [clear, routeThreadId]);

  useEffect(() => {
    const g = readGlass();
    if (!g || !sum?.cwd) return;
    if (cwd !== null && sum.cwd === cwd) return;

    let live = true;
    reset();
    void g.shell
      .setWorkspace(sum.cwd)
      .then(() => {
        if (!live) return;
        window.dispatchEvent(new CustomEvent(PI_GLASS_SHELL_CHANGED_EVENT));
      })
      .catch(() => {
        void Promise.all([usePiStore.getState().refreshCfg(), usePiStore.getState().refreshSums()]);
      });

    return () => {
      live = false;
    };
  }, [cwd, reset, sum?.cwd]);

  useEffect(() => {
    if (!settingsMode) return;
    if (cwd) mute(cwd);
    setRightOpen(false);
  }, [cwd, mute, setRightOpen, settingsMode]);

  useEffect(() => {
    if (settingsMode) return;
    if (!routeThreadId) return;
    if (!git.hit || muted || rightOpen) return;
    setRightOpen(true);
  }, [git.hit, muted, rightOpen, routeThreadId, setRightOpen, settingsMode]);

  const threadTitle =
    !routeThreadId
      ? "New chat"
      : sumsStatus === "loading"
        ? "Loading chat"
        : sumsStatus === "error"
          ? "Chat unavailable"
          : sum?.messageCount === 0
            ? "New chat"
            : sum?.name?.trim() || sum?.firstMessage?.trim()?.slice(0, 48) || "Untitled";

  const title = settingsMode
    ? pathname.startsWith("/settings/appearance")
      ? "Appearance"
      : pathname.startsWith("/settings/agents")
        ? "Agents"
        : pathname.startsWith("/settings/archived")
          ? "Archived"
          : "Settings"
    : threadTitle;

  const create = useCallback(() => {
    bump();
    void navigate({ to: "/" });
  }, [bump, navigate]);

  const select = useCallback(
    (id: string) => {
      const next = sums[id];
      const go = () => {
        navigate({ to: "/$threadId", params: { threadId: id } });
      };
      const g = readGlass();
      if (!g || !next?.cwd || next.cwd === cwd) {
        go();
        return;
      }
      reset();
      void g.shell
        .setWorkspace(next.cwd)
        .then(() => {
          window.dispatchEvent(new CustomEvent(PI_GLASS_SHELL_CHANGED_EVENT));
          go();
        })
        .catch(() => {
          void Promise.all([usePiStore.getState().refreshCfg(), usePiStore.getState().refreshSums()]);
        });
    },
    [cwd, navigate, reset, sums],
  );

  return (
    <>
      <GlassAppShell
        title={title}
        changesCount={git.count}
        {...(settingsMode ? { onBack: () => void navigate({ to: "/" }) } : {})}
        panels={{
          ...p,
          setRightOpen: (open) => {
            if (cwd) {
              if (open) unmute(cwd);
              if (!open) mute(cwd);
            }
            p.setRightOpen(open);
          },
          toggleRight: () => {
            const next = !p.rightOpen;
            if (cwd) {
              if (next) unmute(cwd);
              if (!next) mute(cwd);
            }
            p.setRightOpen(next);
          },
        }}
        left={
          <div className="glass-thread-rail-pad flex min-h-0 flex-1 flex-col px-0">
            {isElectron ? (
              <div
                className={cn(
                  "no-drag shrink-0 px-2 py-1.5",
                  settingsMode && "pointer-events-none invisible",
                )}
                aria-hidden={settingsMode}
              >
                <GlassWorkspacePicker className="w-full justify-start" />
              </div>
            ) : null}
            {settingsMode ? (
              <GlassSettingsNavRail />
            ) : (
              <GlassThreadRail
                loading={loading}
                error={error}
                sections={sections}
                selectedId={routeThreadId}
                onSelectAgent={select}
                onNewAgent={create}
              />
            )}
            <GlassSidebarFooter />
          </div>
        }
        center={<Outlet />}
        right={settingsMode ? null : <GlassGitPanel git={git} />}
      />
      <GlassProviderShellOverlay />
    </>
  );
}
