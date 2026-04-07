/**
 * @mention preview pane — matches Cursor `ui-mention-menu-side-preview--glass`.
 *   header (path)   12px/16px  primary  truncate
 *   image           contain  radius-sm(4px)  border-tertiary
 *   text            mono  11px/14px  tertiary
 *   empty state     11px/14px  tertiary
 */
import type { ShellFileHit, ShellFilePreview } from "@glass/contracts";
import { IconSearchIntelligence } from "central-icons";
import { memo } from "react";
import { ScrollArea } from "~/components/ui/scroll-area";

export const GlassComposerFilePreview = memo(function GlassComposerFilePreview(props: {
  item: ShellFileHit | null;
  preview: ShellFilePreview | null;
}) {
  if (!props.item || !props.preview) {
    return (
      <div className="flex h-full min-h-44 items-center justify-center px-3 py-4 text-center text-[11px] leading-[14px] text-muted-foreground/55">
        <div className="max-w-44">
          <div className="mb-1.5 flex justify-center text-muted-foreground/50">
            <IconSearchIntelligence className="size-4" />
          </div>
          <div>Select a file to preview</div>
        </div>
      </div>
    );
  }

  if (props.preview.kind === "image" && props.preview.data) {
    return (
      <div className="flex h-full min-h-44 flex-col gap-1.5 p-2">
        <div className="truncate px-1 text-[11px] leading-[14px] text-foreground/70">
          {props.item.path}
        </div>
        <img
          alt={props.item.name}
          className="min-h-0 flex-1 rounded-sm border border-glass-border/30 bg-black/10 object-contain"
          src={`data:${props.preview.mimeType ?? "image/png"};base64,${props.preview.data}`}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-44 flex-col p-2">
      <div className="mb-1.5 truncate px-1 text-[11px] leading-[14px] text-foreground/70">
        {props.item.path}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-sm border border-glass-border/30 bg-glass-hover/8">
        <ScrollArea className="h-full">
          <pre className="font-glass-mono p-2 text-[11px] leading-[14px] whitespace-pre-wrap text-foreground/72">
            {props.preview.text || "Binary file"}
            {props.preview.truncated ? "\n\n[truncated]" : ""}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
});
