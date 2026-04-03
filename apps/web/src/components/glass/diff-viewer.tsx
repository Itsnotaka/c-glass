import { FileDiff, type FileDiffMetadata } from "@pierre/diffs";
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
      className={cn("web-component h-full min-h-0 overflow-hidden", props.className)}
      data-diffs-container
    >
      {/* @ts-expect-error - @pierre/diffs FileDiff has incompatible React types */}
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

/**
 * Create sample diff data for testing/development
 */
export function createSampleDiff(): FileDiffMetadata[] {
  return [
    {
      name: "src/components/button.tsx",
      type: "change",
      hunks: [
        {
          collapsedBefore: 0,
          additionStart: 1,
          additionCount: 8,
          additionLines: 6,
          additionLineIndex: 0,
          deletionStart: 1,
          deletionCount: 5,
          deletionLines: 3,
          deletionLineIndex: 0,
          hunkContent: [
            {
              type: "change",
              deletions: 2,
              deletionLineIndex: 0,
              additions: 4,
              additionLineIndex: 0,
            },
            {
              type: "context",
              lines: 2,
              additionLineIndex: 4,
              deletionLineIndex: 2,
            },
            {
              type: "change",
              deletions: 1,
              deletionLineIndex: 4,
              additions: 2,
              additionLineIndex: 6,
            },
          ],
          splitLineStart: 0,
          splitLineCount: 11,
          unifiedLineStart: 0,
          unifiedLineCount: 11,
          noEOFCRDeletions: false,
          noEOFCRAdditions: false,
        },
      ],
      splitLineCount: 11,
      unifiedLineCount: 11,
      isPartial: false,
      deletionLines: [
        "import { type FC } from 'react';",
        "import { cn } from '@/lib/utils';",
        "",
        "interface ButtonProps {",
      ],
      additionLines: [
        "import { type FC, type ReactNode } from 'react';",
        "import { cn } from '@/lib/utils';",
        "import { type VariantProps } from 'class-variance-authority';",
        "",
        "interface ButtonProps extends VariantProps<typeof buttonVariants> {",
        "  children: ReactNode;",
        "  className?: string;",
      ],
    },
    {
      name: "src/lib/utils.ts",
      type: "new",
      hunks: [
        {
          collapsedBefore: 0,
          additionStart: 1,
          additionCount: 12,
          additionLines: 12,
          additionLineIndex: 0,
          deletionStart: 0,
          deletionCount: 0,
          deletionLines: 0,
          deletionLineIndex: 0,
          hunkContent: [
            {
              type: "change",
              deletions: 0,
              deletionLineIndex: 0,
              additions: 12,
              additionLineIndex: 0,
            },
          ],
          splitLineStart: 0,
          splitLineCount: 12,
          unifiedLineStart: 0,
          unifiedLineCount: 12,
          noEOFCRDeletions: false,
          noEOFCRAdditions: false,
        },
      ],
      splitLineCount: 12,
      unifiedLineCount: 12,
      isPartial: false,
      deletionLines: [],
      additionLines: [
        "export function cn(...inputs: CxOptions) {",
        "  return twMerge(cx(...inputs));",
        "}",
        "",
        "export function formatDate(date: Date): string {",
        "  return new Intl.DateTimeFormat('en-US', {",
        "    month: 'short',",
        "    day: 'numeric',",
        "    year: 'numeric',",
        "  }).format(date);",
        "}",
      ],
    },
  ];
}
