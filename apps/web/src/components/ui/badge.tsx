import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

const variants = cva(
  "inline-flex shrink-0 items-center rounded-glass-control border px-1 py-0.5 text-caption/[1] font-medium",
  {
    variants: {
      variant: {
        neutral: "border-glass-border/50 bg-glass-hover/30 text-muted-foreground",
        addition:
          "border-glass-diff-addition/40 bg-glass-diff-addition-bg text-glass-diff-addition",
        deletion:
          "border-glass-diff-deletion/40 bg-glass-diff-deletion-bg text-glass-diff-deletion",
        warning: "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        info: "border-info/35 bg-info/10 text-info-foreground",
        destructive: "border-destructive/35 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

interface Props extends VariantProps<typeof variants> {
  className?: string;
  children?: ReactNode;
}

const Badge = ({ variant, className, children }: Props) => (
  <span className={cn(variants({ variant }), className)}>{children}</span>
);

export { Badge };
