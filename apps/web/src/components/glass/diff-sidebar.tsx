import { IconArrowCornerDownRight, IconFileBend } from "central-icons";
import { memo, useMemo, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Collapsible } from "~/components/ui/collapsible";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { cn } from "~/lib/utils";
import { ScrollArea } from "~/components/ui/scroll-area";

interface FileStats {
  additions: number;
  deletions: number;
}

interface DiffFile {
  id: string;
  name: string;
  path: string;
  type: "change" | "new" | "deleted" | "rename-pure" | "rename-changed";
  stats: FileStats;
}

interface Props {
  files: DiffFile[];
  selectedFileId?: string | null;
  onSelectFile?: (id: string) => void;
  diffStyle?: "unified" | "split";
  onDiffStyleChange?: (style: "unified" | "split") => void;
  className?: string;
}

interface FileRowProps {
  file: DiffFile;
  selected: boolean;
  onSelect: () => void;
}

// Note: FileRow is a simple variant kept for reference
const _FileRow = memo(function _FileRow(props: FileRowProps) {
  return (
    <button
      type="button"
      onClick={props.onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-glass-control px-2 py-1.5 text-left transition-colors",
        props.selected
          ? "bg-glass-active/60 text-foreground"
          : "text-foreground/80 hover:bg-glass-hover/40",
      )}
    >
      <IconFileBend className="size-4 shrink-0 text-muted-foreground/70" />
      <span className="min-w-0 flex-1 truncate text-body/[1.3] font-medium">{props.file.name}</span>
      {props.file.type === "new" ? (
        <Badge variant="addition">new</Badge>
      ) : props.file.type === "deleted" ? (
        <Badge variant="deletion">deleted</Badge>
      ) : (
        <div className="flex shrink-0 items-center gap-1 text-detail/[1]">
          {props.file.stats.additions > 0 && (
            <span className="font-medium text-glass-diff-addition">
              +{props.file.stats.additions}
            </span>
          )}
          {props.file.stats.deletions > 0 && (
            <span className="font-medium text-glass-diff-deletion">
              -{props.file.stats.deletions}
            </span>
          )}
        </div>
      )}
    </button>
  );
});

interface CollapsibleFileProps {
  file: DiffFile;
  selected: boolean;
  onSelect: () => void;
}

const CollapsibleFile = memo(function CollapsibleFile(props: CollapsibleFileProps) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible.Root open={open}>
      <div className="min-w-0">
        <Collapsible.Trigger
          onClick={() => setOpen(!open)}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 rounded-glass-control px-2 py-1.5 text-left transition-colors",
            props.selected
              ? "bg-glass-active/60 text-foreground"
              : "text-foreground/80 hover:bg-glass-hover/40",
          )}
        >
          <span
            className={cn(
              "flex size-3.5 shrink-0 items-center justify-center text-muted-foreground/60 transition-transform duration-150",
            )}
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            <IconArrowCornerDownRight className="size-3" />
          </span>
          <IconFileBend className="size-4 shrink-0 text-muted-foreground/70" />
          <span className="min-w-0 flex-1 truncate text-body/[1.3] font-medium">
            {props.file.name}
          </span>
          {props.file.type === "new" ? (
            <Badge variant="addition">new</Badge>
          ) : props.file.type === "deleted" ? (
            <Badge variant="deletion">deleted</Badge>
          ) : (
            <div className="flex shrink-0 items-center gap-1 text-detail/[1]">
              {props.file.stats.additions > 0 && (
                <span className="font-medium text-glass-diff-addition">
                  +{props.file.stats.additions}
                </span>
              )}
              {props.file.stats.deletions > 0 && (
                <span className="font-medium text-glass-diff-deletion">
                  -{props.file.stats.deletions}
                </span>
              )}
            </div>
          )}
        </Collapsible.Trigger>
        {open && (
          <Collapsible.Panel className="pl-6">
            <div className="min-w-0 truncate text-detail/[1.3] text-muted-foreground/60">
              {props.file.path}
            </div>
          </Collapsible.Panel>
        )}
      </div>
    </Collapsible.Root>
  );
});

export const GlassDiffSidebar = memo(function GlassDiffSidebar(props: Props) {
  const stats = useMemo(() => {
    return props.files.reduce(
      (acc, file) => ({
        files: acc.files + 1,
        additions: acc.additions + file.stats.additions,
        deletions: acc.deletions + file.stats.deletions,
      }),
      { files: 0, additions: 0, deletions: 0 },
    );
  }, [props.files]);

  return (
    <div className={cn("flex h-full min-w-0 flex-col", props.className)}>
      {/* Header with title and toggle */}
      <div className="flex shrink-0 items-center justify-between border-b border-glass-border/40 px-3 py-2">
        <h2 className="text-body/[1.2] font-semibold text-foreground/85">Changes</h2>
        <SegmentedControl
          value={props.diffStyle ?? "unified"}
          onChange={(v) => props.onDiffStyleChange?.(v as "unified" | "split")}
          options={[
            { value: "unified", label: "Unified" },
            { value: "split", label: "Split" },
          ]}
          size="sm"
        />
      </div>

      {/* Stats summary */}
      <div className="flex shrink-0 items-center gap-3 border-b border-glass-border/30 px-3 py-2 text-detail/[1.2] text-muted-foreground/72">
        <span>
          {stats.files} file{stats.files !== 1 ? "s" : ""} changed
        </span>
        <span className="text-glass-diff-addition">+{stats.additions}</span>
        <span className="text-glass-diff-deletion">-{stats.deletions}</span>
      </div>

      {/* File list */}
      <ScrollArea className="min-h-0 flex-1 px-2 py-2">
        <div className="flex flex-col gap-1">
          {props.files.map((file) => (
            <CollapsibleFile
              key={file.id}
              file={file}
              selected={file.id === props.selectedFileId}
              onSelect={() => props.onSelectFile?.(file.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});
