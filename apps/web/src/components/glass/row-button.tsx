import type { ComponentProps } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type RowProps = Omit<ComponentProps<typeof Button>, "type" | "variant">;

/** Sidebar rows: `chrome` matches the New Chat label style; `agent` uses the list type scale. */
export function GlassRowButton(
  props: RowProps & {
    variant: "chrome" | "agent";
  },
) {
  const { variant, className, ...rest } = props;
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        variant === "chrome"
          ? "font-glass glass-sidebar-label flex min-h-7.5 w-full items-center justify-start gap-2 rounded-glass-control border border-transparent px-2 py-1 text-left text-muted-foreground transition-colors"
          : "font-glass flex min-h-7.5 w-full items-center justify-start gap-2 rounded-glass-control border border-transparent px-2 py-1 text-left text-body/[18px] text-muted-foreground transition-colors",
        "hover:bg-glass-hover hover:text-foreground data-[selected=true]:border-glass-border/90 data-[selected=true]:bg-glass-active data-[selected=true]:text-foreground",
        className,
      )}
      {...rest}
    />
  );
}
