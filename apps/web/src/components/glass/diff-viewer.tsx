import { FileDiff, type FileDiffMetadata } from "@pierre/diffs/react";
import { memo, useMemo } from "react";
import { cn } from "~/lib/utils";

interface Props {
  fileDiff: FileDiffMetadata | null;
  diffStyle?: "unified" | "split";
  className?: string;
}

export const GlassDiffViewer = memo(function GlassDiffViewer(props: Props) {
  const isDark = useMemo(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  }, []);

  if (!props.fileDiff) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[12px]/[1.4] text-muted-foreground/60">Select a file to view changes</p>
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
          theme: isDark ? "pierre-dark" : "pierre-light",
          diffStyle: props.diffStyle ?? "split",
          hunkSeparators: "line-info",
          overflow: "scroll",
        }}
      />
    </div>
  );
});
