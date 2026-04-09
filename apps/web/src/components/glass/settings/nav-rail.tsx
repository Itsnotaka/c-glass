import { Link } from "@tanstack/react-router";
import {
  IconAgent,
  IconAppearanceLightMode,
  IconArchive,
  IconArrowRotateCounterClockwise,
} from "central-icons";
import type { ComponentType } from "react";

import { Button } from "~/components/ui/button";
import { useSettingsRestore } from "../../settings/settings-panels";
import { cn } from "~/lib/utils";

const items: {
  to: "/settings/appearance" | "/settings/agents" | "/settings/archived";
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { to: "/settings/appearance", label: "Appearance", icon: IconAppearanceLightMode },
  { to: "/settings/agents", label: "Agents", icon: IconAgent },
  { to: "/settings/archived", label: "Archived", icon: IconArchive },
];

export function GlassSettingsNavRail(props: { onRestoreTick?: () => void }) {
  const { changedSettingLabels, restoreDefaults } = useSettingsRestore(props.onRestoreTick);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 pt-1.5 pb-2">
      <nav className="flex min-h-0 flex-1 flex-col gap-px" aria-label="Settings">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{
                className: cn(
                  "font-glass glass-sidebar-label flex min-h-7.5 min-w-0 w-full items-center justify-start gap-2 rounded-glass-control border border-transparent px-2 py-1 text-body/[18px] transition-colors",
                  "border-glass-border/90 bg-glass-active text-foreground",
                ),
                "aria-current": "page",
              }}
              inactiveProps={{
                className: cn(
                  "font-glass glass-sidebar-label flex min-h-7.5 min-w-0 w-full items-center justify-start gap-2 rounded-glass-control border border-transparent px-2 py-1 text-body/[18px] transition-colors",
                  "text-muted-foreground hover:bg-glass-hover hover:text-foreground",
                ),
              }}
            >
              <Icon className="size-4 shrink-0 opacity-60" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-glass-border/40 pt-2">
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="w-full px-2"
          disabled={changedSettingLabels.length === 0}
          onClick={() => void restoreDefaults()}
        >
          <IconArrowRotateCounterClockwise className="size-3.5" />
          Restore defaults
        </Button>
      </div>
    </div>
  );
}
