import type { ComponentProps } from "react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const chromeRow =
  "font-glass glass-sidebar-label flex min-h-7.5 w-full items-center justify-start gap-2 rounded-glass-control border border-transparent px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-glass-hover hover:text-foreground data-[selected=true]:border-glass-border/90 data-[selected=true]:bg-glass-active data-[selected=true]:text-foreground";

const agentRow =
  "font-glass flex min-h-7.5 w-full items-center justify-start gap-2 rounded-glass-control border border-transparent px-2 py-1 text-left text-body/[18px] text-muted-foreground transition-colors hover:bg-glass-hover hover:text-foreground data-[selected=true]:border-glass-border/90 data-[selected=true]:bg-glass-active data-[selected=true]:text-foreground";

type RowProps = Omit<ComponentProps<typeof Button>, "type" | "variant">;

/** Sidebar rows: `chrome` matches the New Agent label style; `agent` uses the list type scale. */
export function GlassRowButton(
  props: RowProps & {
    variant: "chrome" | "agent";
  },
) {
  const { variant, className, ...rest } = props;
  const base = variant === "chrome" ? chromeRow : agentRow;
  return <Button type="button" variant="ghost" className={cn(base, className)} {...rest} />;
}
