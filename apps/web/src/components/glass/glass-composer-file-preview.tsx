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
      <div className="flex h-full min-h-56 items-center justify-center px-4 py-6 text-center text-body/[1.45] text-muted-foreground/72">
        <div className="max-w-52">
          <div className="mb-2 flex justify-center text-muted-foreground/65">
            <IconSearchIntelligence className="size-5" />
          </div>
          <div>Select a file to preview</div>
        </div>
      </div>
    );
  }

  if (props.preview.kind === "image" && props.preview.data) {
    return (
      <div className="flex h-full min-h-56 flex-col gap-3 p-3">
        <div className="truncate text-body/[1.2] font-medium text-foreground/84">
          {props.item.path}
        </div>
        <img
          alt={props.item.name}
          className="min-h-0 flex-1 rounded-2xl border border-glass-border/40 object-contain bg-black/12"
          src={`data:${props.preview.mimeType ?? "image/png"};base64,${props.preview.data}`}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-56 flex-col p-3">
      <div className="mb-3 truncate text-body/[1.2] font-medium text-foreground/84">
        {props.item.path}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-glass-border/40 bg-glass-hover/10">
        <ScrollArea className="h-full">
          <pre className="font-glass-mono whitespace-pre-wrap p-3 text-detail/[1.45] text-foreground/78">
            {props.preview.text || "Binary file"}
            {props.preview.truncated ? "\n\n[truncated]" : ""}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
});
