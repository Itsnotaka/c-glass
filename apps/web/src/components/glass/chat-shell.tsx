"use client";

import { Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import { isElectron } from "../../env";
import { useGlassAgents } from "../../hooks/use-glass-agents";
import { useGlassGitPanel } from "../../hooks/use-glass-git";
import { useGlassShellPanels } from "../../hooks/use-glass-shell-panels";
import { useShellState } from "../../hooks/use-shell-cwd";
import { useGlassChatDraftStore, hasDraft } from "../../lib/glass-chat-draft-store";
import { switchWorkspace } from "../../lib/glass-workspace";
import { useDefaultHarness } from "../../lib/harness-picker";
import { useGlassShellStore } from "../../lib/glass-shell-store";
import { useThreadSummariesStatus } from "../../lib/thread-session-store";
import { useStore } from "../../store";
import { GlassAppShell } from "./app-shell";
import { GlassCommandPalette } from "./command-palette";
import { GlassGitPanel } from "./git-panel";
import { GlassSidebarFooter } from "./sidebar-footer";
import { GlassThreadRail } from "./thread-rail";
import { GlassWorkspacePicker } from "./workspace-picker";

export function GlassChatShell() {
  const navigate = useNavigate();
  const { cwd, home } = useShellState();
  const p = useGlassShellPanels(cwd);
  const { kind } = useDefaultHarness();
  const projects = useStore((state) => state.projects);
  const sumsStatus = useThreadSummariesStatus();
  const clear = useGlassShellStore((state) => state.clear);
  const mute = useGlassShellStore((state) => state.mute);
  const unmute = useGlassShellStore((state) => state.unmute);
  const muted = useGlassShellStore((state) => (cwd ? Boolean(state.mutes[cwd]) : false));
  const root = useGlassChatDraftStore((state) => state.root);
  const items = useGlassChatDraftStore((state) => state.items);
  const cur = useGlassChatDraftStore((state) => state.cur);
  const pick = useGlassChatDraftStore((state) => state.pick);
  const park = useGlassChatDraftStore((state) => state.park);
  const { sections, routeThreadId, selectedId, selected, loading, error } = useGlassAgents(
    cwd,
    home,
  );
  const git = useGlassGitPanel();
  const rightOpen = p.rightOpen;
  const setRightOpen = p.setRightOpen;

  useEffect(() => {
    clear();
  }, [clear, selectedId]);

  useEffect(() => {
    if (!routeThreadId || cur === null) return;
    pick(null);
  }, [cur, pick, routeThreadId]);

  useEffect(() => {
    if (!selected?.cwd) return;
    if (cwd !== null && selected.cwd === cwd) return;

    void switchWorkspace(selected.cwd);
  }, [cwd, selected?.cwd]);

  useEffect(() => {
    if (!routeThreadId) return;
    if (!git.hit || muted || rightOpen) return;
    setRightOpen(true);
  }, [git.hit, muted, rightOpen, routeThreadId, setRightOpen]);

  const title = !selectedId
    ? "New chat"
    : routeThreadId && sumsStatus === "loading"
      ? "Loading chat"
      : routeThreadId && sumsStatus === "error"
        ? "Chat unavailable"
        : selected?.title || "New chat";

  const create = useCallback(() => {
    if (routeThreadId) {
      pick(null);
      void navigate({ to: "/" });
      return;
    }
    if (cur) {
      pick(null);
      return;
    }
    if (!hasDraft(root.text, root.files)) return;
    const dir = cwd ?? projects[0]?.cwd ?? "/";
    park(dir, kind);
  }, [cur, cwd, kind, navigate, park, pick, projects, root.files, root.text, routeThreadId]);

  const select = useCallback(
    (id: string) => {
      if (id in items) {
        pick(id);
        void navigate({ to: "/" });
        return;
      }
      pick(null);
      void navigate({ to: "/$threadId", params: { threadId: id } });
    },
    [items, navigate, pick],
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
              selectedId={selectedId}
              onSelectAgent={select}
              onNewChat={create}
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
