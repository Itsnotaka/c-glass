"use client";

import { useNavigate, useRouterState } from "@tanstack/react-router";
import { IconSettingsGear2 } from "central-icons";

import { cn } from "../../lib/utils";
import { GlassUpdatePill } from "./glass-update-pill";

export function GlassSidebarFooter() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname.startsWith("/settings");
  const navigate = useNavigate();

  return (
    <div className="mt-auto flex shrink-0 flex-col px-3 py-1.5">
      <GlassUpdatePill />
      <div className="flex items-center justify-between py-1">
        <span className="text-[11px] text-muted-foreground/50">Glass</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              void navigate({ to: active ? "/" : "/settings/appearance" });
            }}
            className={cn(
              "flex size-7 items-center justify-center rounded-md border border-transparent transition-colors",
              active
                ? "border-glass-border/90 bg-glass-active text-foreground hover:bg-glass-active"
                : "text-muted-foreground/60 hover:bg-glass-hover hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
            aria-label={active ? "Back to chat" : "Open settings"}
          >
            <IconSettingsGear2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
