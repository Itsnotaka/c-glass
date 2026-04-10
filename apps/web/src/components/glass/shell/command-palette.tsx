"use client";

import {
  IconClipboard,
  IconHashtag,
  IconPlusLarge,
  IconSettingsGear2,
  IconSidebar,
  IconSidebarHiddenLeftWide,
  IconSidebarHiddenRightWide,
} from "central-icons";
import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useHotkey } from "@tanstack/react-hotkeys";
import { toast } from "sonner";

import { CommandPalette } from "~/components/ui/command-palette";
import { Kbd } from "~/components/ui/kbd";
import { useTheme } from "~/hooks/use-theme";
import { useGlassChatDraftStore } from "~/lib/glass-chat-draft-store";
import type { GlassAppShellPanels } from "./app";

interface Props {
  panels: GlassAppShellPanels;
  onNewChat: () => void;
  routeThreadId: string | null;
}

export function GlassCommandPalette(props: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();

  useHotkey("Mod+Shift+P", (e) => {
    e.preventDefault();
    setOpen(true);
  });

  const run = useCallback((cb: () => void) => {
    setOpen(false);
    cb();
  }, []);

  const appendThreadId = useCallback(() => {
    const tid = props.routeThreadId;
    if (!tid) {
      toast.error("No active thread");
      return;
    }
    const s = useGlassChatDraftStore.getState();
    if (s.cur === null) {
      const t = s.root.text;
      if (t.endsWith(tid)) {
        toast.info("Thread id already in composer");
        return;
      }
      const next = t.length > 0 && !/\s$/.test(t) ? `${t} ${tid}` : `${t}${tid}`;
      s.saveRoot(next, s.root.files, s.root.skills);
      toast.success("Thread id added to composer");
      return;
    }
    const item = s.items[s.cur];
    if (!item) {
      toast.error("No active draft");
      return;
    }
    const t = item.text;
    if (t.endsWith(tid)) {
      toast.info("Thread id already in composer");
      return;
    }
    const next = t.length > 0 && !/\s$/.test(t) ? `${t} ${tid}` : `${t}${tid}`;
    s.save(s.cur, next, item.files, item.skills);
    toast.success("Thread id added to composer");
  }, [props.routeThreadId]);

  return (
    <CommandPalette.Dialog open={open} onOpenChange={setOpen} label="Command palette" loop>
      <CommandPalette.Input placeholder="Type a command..." />
      <CommandPalette.List>
        <CommandPalette.Empty>No commands found.</CommandPalette.Empty>

        <CommandPalette.Group heading="Navigation">
          <CommandPalette.Item value="new chat" onSelect={() => run(props.onNewChat)}>
            <IconPlusLarge className="size-4 shrink-0 text-muted-foreground/60" />
            <span className="flex-1">New Chat</span>
            <Kbd keys={["⌘", "N"]} />
          </CommandPalette.Item>
          <CommandPalette.Item
            value="open settings"
            onSelect={() => run(() => navigate({ to: "/settings/appearance" }))}
          >
            <IconSettingsGear2 className="size-4 shrink-0 text-muted-foreground/60" />
            <span className="flex-1">Open Settings</span>
            <Kbd keys={["⌘", ","]} />
          </CommandPalette.Item>
        </CommandPalette.Group>

        <CommandPalette.Group heading="Layout">
          <CommandPalette.Item
            value="toggle left panel sidebar"
            onSelect={() => run(() => props.panels.toggleLeft())}
          >
            {props.panels.leftOpen ? (
              <IconSidebarHiddenLeftWide className="size-4 shrink-0 text-muted-foreground/60" />
            ) : (
              <IconSidebar className="size-4 shrink-0 text-muted-foreground/60" />
            )}
            <span className="flex-1">
              {props.panels.leftOpen ? "Hide Left Panel" : "Show Left Panel"}
            </span>
            <Kbd keys={["⌘", "B"]} />
          </CommandPalette.Item>
          <CommandPalette.Item
            value="toggle right panel changes"
            onSelect={() => run(() => props.panels.toggleRight())}
          >
            {props.panels.rightOpen ? (
              <IconSidebarHiddenRightWide className="size-4 shrink-0 text-muted-foreground/60" />
            ) : (
              <IconSidebar className="size-4 shrink-0 text-muted-foreground/60" />
            )}
            <span className="flex-1">
              {props.panels.rightOpen ? "Hide Changes Panel" : "Show Changes Panel"}
            </span>
          </CommandPalette.Item>
        </CommandPalette.Group>

        <CommandPalette.Group heading="Appearance">
          <CommandPalette.Item
            value="toggle theme light dark"
            keywords={["appearance", "mode"]}
            onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
          >
            <span className="flex size-4 shrink-0 items-center justify-center text-detail text-muted-foreground/60">
              {resolvedTheme === "dark" ? "☀" : "☾"}
            </span>
            <span className="flex-1">
              Switch to {resolvedTheme === "dark" ? "Light" : "Dark"} Theme
            </span>
          </CommandPalette.Item>
          <CommandPalette.Item
            value="theme system"
            keywords={["auto", "appearance"]}
            onSelect={() => run(() => setTheme("system"))}
          >
            <span className="flex size-4 shrink-0 items-center justify-center text-detail text-muted-foreground/60">
              ◐
            </span>
            <span className="flex-1">Use System Theme</span>
          </CommandPalette.Item>
        </CommandPalette.Group>

        {import.meta.env.DEV ? (
          <CommandPalette.Group heading="Developer">
            <CommandPalette.Item
              value="dev debug intents"
              keywords={["provider", "runtime", "intents", "debug", "mapping", "ui"]}
              onSelect={() => run(() => void navigate({ to: "/debug/intents" }))}
            >
              <IconClipboard className="size-4 shrink-0 text-muted-foreground/60" />
              <span className="flex-1">Dev: Debug intents</span>
            </CommandPalette.Item>
            <CommandPalette.Item
              value="dev add thread id"
              keywords={["thread", "uuid", "composer", "draft", "id"]}
              onSelect={() => run(appendThreadId)}
            >
              <IconHashtag className="size-4 shrink-0 text-muted-foreground/60" />
              <span className="flex-1">Dev: Add thread id</span>
            </CommandPalette.Item>
          </CommandPalette.Group>
        ) : null}
      </CommandPalette.List>
    </CommandPalette.Dialog>
  );
}
