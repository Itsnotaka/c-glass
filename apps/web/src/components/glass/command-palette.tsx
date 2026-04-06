"use client";

import {
  IconPlusLarge,
  IconSettingsGear2,
  IconSidebar,
  IconSidebarHiddenLeftWide,
  IconSidebarHiddenRightWide,
} from "central-icons";
import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useHotkey } from "@tanstack/react-hotkeys";

import { CommandPalette } from "~/components/ui/command-palette";
import { Kbd } from "~/components/ui/kbd";
import { useTheme } from "../../hooks/use-theme";
import type { GlassAppShellPanels } from "./app-shell";

interface Props {
  panels: GlassAppShellPanels;
  onNewChat: () => void;
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

  return (
    <CommandPalette.Dialog open={open} onOpenChange={setOpen} label="Command palette" loop>
      <CommandPalette.Input placeholder="Type a command..." />
      <CommandPalette.List>
        <CommandPalette.Empty>No commands found.</CommandPalette.Empty>

        <CommandPalette.Group heading="Navigation">
          <CommandPalette.Item value="new agent chat" onSelect={() => run(props.onNewChat)}>
            <IconPlusLarge className="size-4 shrink-0 text-muted-foreground/60" />
            <span className="flex-1">New Agent Chat</span>
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
      </CommandPalette.List>
    </CommandPalette.Dialog>
  );
}
