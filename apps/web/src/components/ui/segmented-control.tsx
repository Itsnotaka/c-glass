import { cn } from "~/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  size?: "sm" | "default";
  className?: string;
}

function SegmentedControl({ value, onChange, options, size = "default", className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center rounded-glass-control border border-glass-border/40 bg-glass-hover/15 p-0.5",
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-[4px] font-medium transition-colors",
            size === "sm" ? "px-1.5 py-0.5 text-caption/[1]" : "px-2 py-1 text-detail/[1]",
            value === opt.value
              ? "bg-glass-active/80 text-foreground"
              : "text-muted-foreground/70 hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export { SegmentedControl };
