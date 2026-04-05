import { Select } from "@base-ui/react/select";
import { IconChevronBottom } from "central-icons";

import { cn } from "../../lib/utils";

export function GlassSelect(props: {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select.Root
      value={props.value}
      onValueChange={(v) => {
        if (v != null) props.onValueChange(String(v));
      }}
      disabled={props.disabled}
      modal={false}
    >
      <Select.Trigger
        className={cn(
          "flex h-9 min-w-[10rem] cursor-pointer items-center justify-between gap-2 rounded-glass-control border border-input bg-background px-2.5 text-left text-body text-foreground shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          props.className,
        )}
      >
        <Select.Value />
        <Select.Icon>
          <IconChevronBottom className="size-4 shrink-0 opacity-60" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4} className="outline-none">
          <Select.Popup className="max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) rounded-glass-card border border-border bg-popover py-1 text-popover-foreground shadow-md outline-none">
            <Select.List className="outline-none">
              {props.options.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  className="flex cursor-pointer select-none items-center rounded-glass-control px-2.5 py-1.5 text-body outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                >
                  <Select.ItemText>{opt.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
