import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react";
import { memo } from "react";
import { cn } from "~/lib/utils";
import { useTheme } from "../../hooks/use-theme";

interface Props {
  fileDiff: FileDiffMetadata | null;
  diffStyle?: "unified" | "split";
  className?: string;
  collapsed?: boolean;
}

export const GlassDiffViewer = memo(function GlassDiffViewer(props: Props) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "pierre-dark" : "pierre-light";

  if (!props.fileDiff) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-body/[1.4] text-muted-foreground/60">Select a file to view changes</p>
      </div>
    );
  }

  return (
    <div
      className={cn("web-component min-h-0 min-w-0 w-full overflow-auto", props.className)}
      data-diffs-container
    >
      <FileDiff
        fileDiff={props.fileDiff}
        options={{
          theme,
          diffStyle: props.diffStyle ?? "unified",
          hunkSeparators: "line-info",
          overflow: "scroll",
          disableFileHeader: true,
          ...(props.collapsed !== undefined ? { collapsed: props.collapsed } : {}),
        }}
      />
    </div>
  );
});
