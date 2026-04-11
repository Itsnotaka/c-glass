"use client";

import {
  IconBranch,
  IconConsole,
  IconFolder1,
  IconGlobe,
  IconSidebarHiddenRightWide,
} from "central-icons";
import type { ComponentType } from "react";

import type { WorkbenchTab } from "~/hooks/use-glass-shell-panels";
import { cn } from "~/lib/utils";

interface Tab {
  id: WorkbenchTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  { id: "git", label: "Git", icon: IconBranch },
  { id: "terminal", label: "Terminal", icon: IconConsole },
  { id: "web", label: "Web", icon: IconGlobe },
  { id: "files", label: "Files", icon: IconFolder1 },
];

export function WorkbenchTabBar(props: {
  active: WorkbenchTab;
  onTab: (tab: WorkbenchTab) => void;
  count: number;
  onToggle: () => void;
}) {
  return (
    <div className="no-drag flex h-(--glass-header-height) shrink-0 items-center border-b border-glass-border/30 px-2">
      <div className="flex flex-1 items-center gap-0.5 rounded-glass-control p-0.5">
        {tabs.map((tab) => {
          const selected = tab.id === props.active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => props.onTab(tab.id)}
              className={cn(
                "font-glass glass-sidebar-label flex h-(--glass-titlebar-control-height) items-center gap-1 rounded-glass-control px-1.5 leading-none transition-colors [&_svg]:block",
                selected
                  ? "bg-glass-active/60 text-foreground"
                  : "text-muted-foreground/70 hover:bg-glass-hover hover:text-foreground",
              )}
              aria-pressed={selected}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="leading-none">{tab.label}</span>
              {tab.id === "git" && props.count > 0 ? (
                <span className="flex min-w-4 items-center justify-center rounded bg-muted-foreground/20 px-1 py-0 leading-none text-inherit tabular-nums">
                  {props.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={props.onToggle}
        className="flex h-(--glass-titlebar-control-height) w-(--glass-titlebar-control-height) shrink-0 items-center justify-center rounded-glass-control bg-transparent p-0 leading-none text-muted-foreground/70 [&_svg]:block hover:bg-glass-hover hover:text-foreground"
        aria-label="Collapse panel"
      >
        <IconSidebarHiddenRightWide className="size-4 shrink-0 opacity-60" />
      </button>
    </div>
  );
}
