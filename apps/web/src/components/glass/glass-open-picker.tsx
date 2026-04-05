import { Menu } from "@base-ui/react/menu";
import { EDITORS, type EditorId } from "@glass/contracts";
import {
  IconArrowOutOfBox,
  IconCheckmark1Small,
  IconChevronDownSmall,
  IconFolderOpen,
} from "central-icons";

import { usePreferredEditor } from "../../editor-preferences";
import { getGlass } from "../../host";
import { useShellState } from "../../hooks/use-shell-cwd";
import { cn } from "../../lib/utils";
import {
  IconAntigravityEditor,
  IconCursorEditor,
  IconGenericEditor,
  IconVSCodeEditor,
  IconVSCodeInsidersEditor,
  IconVSCodiumEditor,
  IconZedEditor,
} from "~/components/icons/editor-icons";

function manager() {
  if (typeof navigator === "undefined") return "File Manager";
  const os = navigator.platform.toLowerCase();
  if (os.includes("mac")) return "Finder";
  if (os.includes("win")) return "Explorer";
  return "Files";
}

function label(id: EditorId) {
  if (id === "file-manager") return manager();
  return EDITORS.find((item) => item.id === id)?.label ?? id;
}

function icon(id: EditorId) {
  if (id === "file-manager") return IconFolderOpen;
  if (id === "cursor") return IconCursorEditor;
  if (id === "vscode") return IconVSCodeEditor;
  if (id === "vscode-insiders") return IconVSCodeInsidersEditor;
  if (id === "vscodium") return IconVSCodiumEditor;
  if (id === "zed") return IconZedEditor;
  if (id === "antigravity") return IconAntigravityEditor;
  return IconGenericEditor;
}

export function GlassOpenPicker(props: { variant?: "hero" | "settings" }) {
  const shell = useShellState();
  const [editor, save] = usePreferredEditor(shell.availableEditors);
  const items = EDITORS.filter((item) => shell.availableEditors.includes(item.id)).map((item) => ({
    id: item.id,
    label: label(item.id),
    Icon: icon(item.id),
  }));
  const active = items.find((item) => item.id === editor) ?? null;
  const Icon = active?.Icon ?? IconArrowOutOfBox;
  const text = active ? `Open in ${active.label}` : "Open in editor";
  const disabled = !shell.cwd || !editor;
  const locked = !shell.cwd || items.length === 0;
  const hero = props.variant !== "settings";

  function open(id: EditorId | null) {
    if (!shell.cwd || !id) return;
    save(id);
    void getGlass().shell.openInEditor(shell.cwd, id);
  }

  return (
    <Menu.Root>
      <div className="flex items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => open(editor)}
          className={cn(
            "relative inline-flex items-center gap-1.5 border outline-none transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50",
            hero
              ? "font-glass min-h-7 rounded-l-full border-glass-stroke border-r-0 bg-glass-bubble px-2.5 text-detail/[17px] text-muted-foreground shadow-glass-card backdrop-blur-md hover:border-glass-stroke-strong hover:bg-glass-hover hover:text-foreground"
              : "h-8 rounded-l-[var(--glass-radius-control)] border-input border-r-0 bg-popover px-3 text-body text-foreground shadow-xs/5 hover:bg-accent/50",
          )}
          aria-label={text}
          title={text}
        >
          <Icon className={cn(hero ? "glass-composer-icon opacity-60" : "size-3.5 opacity-70")} />
          <span className="max-w-[16rem] truncate">{text}</span>
        </button>
        <Menu.Trigger
          aria-label="Choose editor"
          disabled={locked}
          className={cn(
            "relative inline-flex items-center justify-center border outline-none transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50",
            hero
              ? "font-glass min-h-7 w-7 rounded-r-full border-glass-stroke bg-glass-bubble text-muted-foreground shadow-glass-card backdrop-blur-md hover:border-glass-stroke-strong hover:bg-glass-hover hover:text-foreground"
              : "h-8 w-8 rounded-r-[var(--glass-radius-control)] border-input bg-popover text-foreground shadow-xs/5 hover:bg-accent/50",
          )}
          title="Choose editor"
        >
          <IconChevronDownSmall
            className={cn(hero ? "glass-composer-icon opacity-60" : "size-3.5 opacity-70")}
          />
        </Menu.Trigger>
      </div>
      <Menu.Portal>
        <Menu.Positioner
          className="z-50 outline-none ring-0"
          side="bottom"
          align="end"
          sideOffset={4}
        >
          <Menu.Popup className="w-[min(15rem,var(--available-width))] min-w-[10rem] overflow-hidden rounded border border-glass-stroke bg-glass-bubble py-1 text-foreground shadow-glass-popup outline-none ring-0 backdrop-blur-xl focus:outline-none focus-visible:outline-none">
            {items.length === 0 ? (
              <div className="px-4 py-2 text-body/[1.3] text-muted-foreground">
                No installed editors found.
              </div>
            ) : (
              items.map((item) => {
                const Mark = item.Icon;
                return (
                  <Menu.Item
                    key={item.id}
                    onClick={() => open(item.id)}
                    className={cn(
                      "flex min-h-7 cursor-pointer items-center gap-2 rounded px-4 py-1 text-body/[1.3] outline-none ring-0 transition-colors hover:bg-glass-hover data-highlighted:bg-glass-hover focus-visible:outline-none focus-visible:ring-0",
                      editor === item.id && "bg-glass-active",
                    )}
                  >
                    <Mark className="size-3.5 shrink-0 text-muted-foreground/75" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {editor === item.id ? (
                      <IconCheckmark1Small className="size-3.5 shrink-0 text-muted-foreground/70" />
                    ) : null}
                  </Menu.Item>
                );
              })
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
