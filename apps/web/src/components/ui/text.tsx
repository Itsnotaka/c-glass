import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

const variants = cva("", {
  variants: {
    size: {
      caption: "text-caption",
      detail: "text-detail",
      body: "text-body",
      title: "text-title",
      heading: "text-heading tracking-tight",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    color: {
      default: "",
      muted: "text-muted-foreground",
      foreground: "text-foreground",
    },
  },
  defaultVariants: {
    size: "body",
  },
});

type As = "span" | "p" | "h1" | "h2" | "h3" | "h4" | "label" | "div";

interface Props extends VariantProps<typeof variants> {
  as?: As;
  className?: string;
  children?: ReactNode;
}

function Text({ as: Tag = "span", size, weight, color, className, children }: Props) {
  return <Tag className={cn(variants({ size, weight, color }), className)}>{children}</Tag>;
}

export { Text };
