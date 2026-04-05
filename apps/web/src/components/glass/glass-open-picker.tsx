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

// SVG icon paths for editors - using official brand assets
const editorSvgPaths: Record<string, string> = {
  cursor: "/icons/cursor/cursor.svg",
  vscode: "/icons/vscode/vscode.svg",
  "vscode-insiders": "/icons/vscode/vscode.svg",
  vscodium: "/icons/vscode/vscode.svg",
  zed: "/icons/zed/zed.svg",
};

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

function getEditorIcon(id: EditorId): string | null {
  return editorSvgPaths[id] ?? null;
}

export function GlassOpenPicker(props: { variant?: "hero" | "settings" }) {
  const shell = useShellState();
  const [editor, setEditor] = usePreferredEditor(shell.availableEditors);

  const items = EDITORS.filter((item) => shell.availableEditors.includes(item.id)).map((item) => ({
    id: item.id,
    label: label(item.id),
    icon: getEditorIcon(item.id),
  }));
  const active = items.find((item) => item.id === editor) ?? null;
  const text = active ? `Open in ${active.label}` : "Open in editor";
  const disabled = !shell.cwd || !editor;
  const locked = !shell.cwd || items.length === 0;
  const hero = props.variant !== "settings";

  const ActiveIcon = active?.icon ? (
    <img
      src={active.icon}
      alt=""
      className={cn(hero ? "glass-composer-icon opacity-80" : "size-3.5 opacity-70")}
    />
  ) : active?.id === "file-manager" ? (
    <IconFolderOpen
      className={cn(hero ? "glass-composer-icon opacity-60" : "size-3.5 opacity-70")}
    />
  ) : (
    <IconArrowOutOfBox
      className={cn(hero ? "glass-composer-icon opacity-60" : "size-3.5 opacity-70")}
    />
  );

  return (
    <Menu.Root>
      <div className="flex items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!shell.cwd || !editor) return;
            void getGlass().shell.openInEditor(shell.cwd, editor);
          }}
          className={cn(
            "relative inline-flex items-center gap-1.5 border outline-none transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50",
            hero
              ? "font-glass min-h-7 rounded-l-full border-glass-stroke border-r-0 bg-glass-bubble px-2.5 text-detail/[17px] text-muted-foreground shadow-glass-card backdrop-blur-md hover:border-glass-stroke-strong hover:bg-glass-hover hover:text-foreground"
              : "h-8 rounded-l-[var(--glass-radius-control)] border-input border-r-0 bg-popover px-3 text-body text-foreground shadow-xs/5 hover:bg-accent/50",
          )}
          aria-label={text}
          title={text}
        >
          {ActiveIcon}
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
              items.map((item) => (
                <Menu.Item
                  key={item.id}
                  onClick={() => setEditor(item.id)}
                  className={cn(
                    "flex min-h-7 cursor-pointer items-center gap-2 rounded px-4 py-1 text-body/[1.3] outline-none ring-0 transition-colors hover:bg-glass-hover data-highlighted:bg-glass-hover focus-visible:outline-none focus-visible:ring-0",
                    editor === item.id && "bg-glass-active",
                  )}
                >
                  {item.icon ? (
                    <img src={item.icon} alt="" className="size-3.5 shrink-0" />
                  ) : item.id === "file-manager" ? (
                    <IconFolderOpen
                      className="size-3.5 shrink-0 text-muted-foreground/75"
                      aria-hidden
                    />
                  ) : (
                    <IconArrowOutOfBox
                      className="size-3.5 shrink-0 text-muted-foreground/75"
                      aria-hidden
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {editor === item.id ? (
                    <IconCheckmark1Small className="size-3.5 shrink-0 text-muted-foreground/70" />
                  ) : null}
                </Menu.Item>
              ))
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
