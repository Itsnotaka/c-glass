"use client";

import { Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import { readGlass } from "../../host";
import { useGlassAgents } from "../../hooks/use-glass-agents";
import { useGlassGitPanel } from "../../hooks/use-glass-git";
import { useGlassShellPanels } from "../../hooks/use-glass-shell-panels";
import { useShellState } from "../../hooks/use-shell-cwd";
import { PI_GLASS_SHELL_CHANGED_EVENT } from "../../lib/pi-glass-constants";
import { useGlassShellStore } from "../../lib/glass-shell-store";
import { usePiStore } from "../../lib/pi-session-store";
import { GlassAppShell } from "./glass-app-shell";
import { GlassGitPanel } from "./glass-git-panel";
import { GlassProviderShellOverlay } from "./glass-provider-shell-overlay";
import { GlassThreadRail } from "./glass-thread-rail";

export function GlassChatShell() {
  const navigate = useNavigate();
  const { cwd, home } = useShellState();
  const p = useGlassShellPanels(cwd);
  const sums = usePiStore((state) => state.sums);
  const clear = useGlassShellStore((state) => state.clear);
  const mute = useGlassShellStore((state) => state.mute);
  const unmute = useGlassShellStore((state) => state.unmute);
  const muted = useGlassShellStore((state) => (cwd ? Boolean(state.mutes[cwd]) : false));
  const { sections, routeThreadId } = useGlassAgents(cwd, home);
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

    void g.shell
      .setWorkspace(sum.cwd)
      .then(() => {
        if (!live) return;
        window.dispatchEvent(new CustomEvent(PI_GLASS_SHELL_CHANGED_EVENT));
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [cwd, sum?.cwd]);

  useEffect(() => {
    if (!routeThreadId) return;
    if (!git.hit || muted || rightOpen) return;
    setRightOpen(true);
  }, [git.hit, muted, rightOpen, routeThreadId, setRightOpen]);

  const title = routeThreadId
    ? sum?.name?.trim() || sum?.firstMessage?.trim()?.slice(0, 48) || "Untitled"
    : "New chat";

  const create = useCallback(() => {
    const g = readGlass();
    if (!g) return;
    void g.session.create().then((s) => {
      navigate({ to: "/$threadId", params: { threadId: s.id } });
    });
  }, [navigate]);

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
      void g.shell
        .setWorkspace(next.cwd)
        .then(() => {
          window.dispatchEvent(new CustomEvent(PI_GLASS_SHELL_CHANGED_EVENT));
          go();
        })
        .catch(() => {});
    },
    [cwd, navigate, sums],
  );

  return (
    <>
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
          <GlassThreadRail
            sections={sections}
            selectedId={routeThreadId}
            onSelectAgent={select}
            onNewAgent={create}
            onToggleLeft={p.toggleLeft}
          />
        }
        center={<Outlet />}
        right={<GlassGitPanel git={git} />}
      />
      <GlassProviderShellOverlay />
    </>
  );
}
