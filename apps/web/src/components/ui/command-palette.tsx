"use client";

import { Command as Cmd } from "cmdk";
import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

function Root({ className, ...props }: ComponentProps<typeof Cmd>) {
  return (
    <Cmd
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-glass-control bg-glass-surface/95 backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  );
}

function Dialog({
  overlayClassName,
  contentClassName,
  ...props
}: ComponentProps<typeof Cmd.Dialog>) {
  return (
    <Cmd.Dialog
      overlayClassName={cn("fixed inset-0 z-50 bg-black/25", overlayClassName)}
      contentClassName={cn(
        "fixed top-[20%] left-1/2 z-50 w-[600px] -translate-x-1/2 rounded-glass-control border border-glass-border/60 bg-glass-surface/95 shadow-glass-popup backdrop-blur-xl",
        "animate-in fade-in-0 zoom-in-[0.98] duration-100",
        contentClassName,
      )}
      {...props}
    />
  );
}

function Input({ className, ...props }: ComponentProps<typeof Cmd.Input>) {
  return (
    <Cmd.Input
      className={cn(
        "w-full border-b border-glass-border/30 bg-transparent px-3 py-2 text-body text-foreground outline-none placeholder:text-muted-foreground/50",
        className,
      )}
      {...props}
    />
  );
}

function List({ className, ...props }: ComponentProps<typeof Cmd.List>) {
  return (
    <Cmd.List
      className={cn("max-h-[440px] overflow-y-auto overscroll-contain p-1", className)}
      {...props}
    />
  );
}

function Empty({ className, ...props }: ComponentProps<typeof Cmd.Empty>) {
  return (
    <Cmd.Empty
      className={cn("px-3 py-4 text-center text-detail text-muted-foreground/60", className)}
      {...props}
    />
  );
}

function Group({ className, ...props }: ComponentProps<typeof Cmd.Group>) {
  return (
    <Cmd.Group
      className={cn(
        "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-detail [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground/50",
        className,
      )}
      {...props}
    />
  );
}

function Item({ className, ...props }: ComponentProps<typeof Cmd.Item>) {
  return (
    <Cmd.Item
      className={cn(
        "flex min-h-[22px] cursor-pointer items-center gap-2 rounded-[3px] px-2 py-1 text-body text-foreground/90 transition-colors duration-75 select-none",
        "data-[selected=true]:bg-glass-hover/60",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export const CommandPalette = {
  Root,
  Dialog,
  Input,
  List,
  Empty,
  Group,
  Item,
  Separator: Cmd.Separator,
};
