"use client";

import { Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import { isElectron } from "../../env";
import { useGlassAgents } from "../../hooks/use-glass-agents";
import { useGlassGitPanel } from "../../hooks/use-glass-git";
import { useGlassShellPanels } from "../../hooks/use-glass-shell-panels";
import { useShellState } from "../../hooks/use-shell-cwd";
import { readGlass } from "../../host";
import { switchWorkspace } from "../../lib/glass-workspace";
import { useGlassShellStore } from "../../lib/glass-shell-store";
import { usePiStore, usePiSumsStatus } from "../../lib/pi-session-store";
import { GlassAppShell } from "./app-shell";
import { GlassWorkspacePicker } from "./workspace-picker";
import { GlassCommandPalette } from "./command-palette";
import { GlassGitPanel } from "./git-panel";
import { GlassSidebarFooter } from "./sidebar-footer";
import { GlassThreadRail } from "./thread-rail";

export function GlassChatShell() {
  const navigate = useNavigate();
  const { cwd, home } = useShellState();
  const p = useGlassShellPanels(cwd);
  const putSnap = usePiStore((state) => state.putSnap);
  const refreshSums = usePiStore((state) => state.refreshSums);
  const sums = usePiStore((state) => state.sums);
  const sumsStatus = usePiSumsStatus();
  const clear = useGlassShellStore((state) => state.clear);
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
    if (!sum?.cwd) return;
    if (cwd !== null && sum.cwd === cwd) return;

    void switchWorkspace(sum.cwd);
  }, [cwd, sum?.cwd]);

  useEffect(() => {
    if (!routeThreadId) return;
    if (!git.hit || muted || rightOpen) return;
    setRightOpen(true);
  }, [git.hit, muted, rightOpen, routeThreadId, setRightOpen]);

  const title = !routeThreadId
    ? "New chat"
    : sumsStatus === "loading"
      ? "Loading chat"
      : sumsStatus === "error"
        ? "Chat unavailable"
        : sum?.messageCount === 0
          ? "New chat"
          : sum?.name?.trim() || sum?.firstMessage?.trim()?.slice(0, 48) || "Untitled";

  const create = useCallback(() => {
    const glass = readGlass();
    if (!glass) {
      void navigate({ to: "/" });
      return;
    }

    void glass.session
      .create()
      .then((next) => {
        putSnap(next);
        void refreshSums();
        void navigate({ to: "/$threadId", params: { threadId: next.id } });
      })
      .catch(() => {
        void navigate({ to: "/" });
      });
  }, [navigate, putSnap, refreshSums]);

  const select = useCallback(
    (id: string) => {
      void navigate({ to: "/$threadId", params: { threadId: id } });
    },
    [navigate],
  );

  return (
    <>
      <GlassCommandPalette panels={p} onNewChat={create} />
      <GlassAppShell
        title={title}
        changesCount={git.count}
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
              <div className="no-drag shrink-0 px-2 py-1.5">
                <GlassWorkspacePicker className="w-full justify-start" />
              </div>
            ) : null}
            <GlassThreadRail
              loading={loading}
              error={error}
              sections={sections}
              selectedId={routeThreadId}
              onSelectAgent={select}
              onNewAgent={create}
            />
            <GlassSidebarFooter />
          </div>
        }
        center={<Outlet />}
        right={<GlassGitPanel git={git} />}
      />
    </>
  );
}
