import { FileDiff, parseDiffFromFile, type FileDiffMetadata } from "@pierre/diffs";
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
    <div className={cn("h-full min-h-0 overflow-hidden", props.className)} data-diffs-container>
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
 * Parse a patch string into file diffs for use with GlassDiffViewer
 */
export function parseDiffPatch(patchContent: string): FileDiffMetadata[] {
  const lines = patchContent.split("\n");
  const files: FileDiffMetadata[] = [];

  let currentFile: Partial<FileDiffMetadata> | null = null;
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      if (currentFile && currentFile.name) {
        files.push({
          ...(currentFile as FileDiffMetadata),
        });
      }
      const match = line.match(/a\/(.+) b\/(.+)/);
      currentFile = {
        name: match?.[2] ?? match?.[1] ?? "unknown",
        path: match?.[2] ?? match?.[1] ?? "unknown",
        type: "change",
        hunks: [],
        splitLineCount: 0,
        unifiedLineCount: 0,
        isPartial: true,
        deletionLines: [],
        additionLines: [],
      };
      additions = 0;
      deletions = 0;
    } else if (line.startsWith("new file mode")) {
      if (currentFile) {
        currentFile.type = "new";
      }
    } else if (line.startsWith("deleted file mode")) {
      if (currentFile) {
        currentFile.type = "deleted";
      }
    } else if (line.startsWith("rename from")) {
      if (currentFile) {
        currentFile.prevName = line.replace("rename from ", "");
      }
    } else if (line.startsWith("rename to")) {
      if (currentFile && currentFile.prevName) {
        currentFile.type = "rename-changed";
      }
    } else if (line.startsWith("--- ")) {
      // skip
    } else if (line.startsWith("+++ ")) {
      // skip
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      additions++;
      if (currentFile) {
        currentFile.additionLines = currentFile.additionLines ?? [];
        currentFile.additionLines.push(line.slice(1));
      }
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      deletions++;
      if (currentFile) {
        currentFile.deletionLines = currentFile.deletionLines ?? [];
        currentFile.deletionLines.push(line.slice(1));
      }
    } else if (line.startsWith("@@")) {
      // Hunk header - simplified parsing
      if (currentFile) {
        currentFile.hunks = currentFile.hunks ?? [];
        // Parse hunk header for line numbers
        const hunkMatch = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
        if (hunkMatch) {
          currentFile.hunks.push({
            collapsedBefore: 0,
            additionStart: parseInt(hunkMatch[3], 10),
            additionCount: parseInt(hunkMatch[4] || "1", 10),
            additionLines: parseInt(hunkMatch[4] || "1", 10),
            additionLineIndex: 0,
            deletionStart: parseInt(hunkMatch[1], 10),
            deletionCount: parseInt(hunkMatch[2] || "1", 10),
            deletionLines: parseInt(hunkMatch[2] || "1", 10),
            deletionLineIndex: 0,
            hunkContent: [],
            splitLineStart: 0,
            splitLineCount: 0,
            unifiedLineStart: 0,
            unifiedLineCount: 0,
            noEOFCRDeletions: false,
            noEOFCRAdditions: false,
          });
        }
      }
    }
  }

  if (currentFile && currentFile.name) {
    files.push(currentFile as FileDiffMetadata);
  }

  // If no files parsed, try to parse as unified diff
  if (files.length === 0 && patchContent.trim()) {
    const result = parseDiffFromFile({
      name: "diff.patch",
      contents: patchContent,
    });
    if (result && result.files.length > 0) {
      return result.files;
    }
  }

  return files;
}

/**
 * Create sample diff data for testing/development
 */
export function createSampleDiff(): FileDiffMetadata[] {
  return [
    {
      name: "src/components/button.tsx",
      path: "src/components/button.tsx",
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
      path: "src/lib/utils.ts",
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
