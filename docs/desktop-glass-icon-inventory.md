# Glass Desktop — icon inventory

The Electron app (`apps/desktop`) loads the web UI from `apps/web`. **In-app UI icons** come from the `central-icons` package (alias for `@central-icons-react/round-outlined-radius-2-stroke-1.5`). **Native / asset icons** are separate (window icon, editor brand SVGs).

**Live preview:** run the web app and open `/dev/icons` (e.g. `http://localhost:5733/dev/icons`).

**Package version:** see root `package.json` → `central-icons` (currently `^1.1.178`).

---

## `central-icons` (UI)

| Icon name                         | Where it appears                                 |
| --------------------------------- | ------------------------------------------------ |
| `IconAgent`                       | Settings: Agents                                 |
| `IconAppearanceLightMode`         | Settings: Appearance                             |
| `IconArchive`                     | Settings: Archived                               |
| `IconArrowCornerDownRight`        | Diff sidebar: nested file                        |
| `IconArrowLeft`                   | App shell: back                                  |
| `IconArrowOutOfBox`               | Open picker: external                            |
| `IconArrowRotateClockwise`        | Update pill: refresh                             |
| `IconArrowRotateCounterClockwise` | Git panel, settings: discard / reset             |
| `IconArrowUp`                     | Composer: send                                   |
| `IconBolt`                        | Slash menu: default / subagent                   |
| `IconBrain`                       | Model picker                                     |
| `IconCheckmark1Small`             | Selections, combobox, open picker                |
| `IconChevronBottom`               | Expand, combobox, chat rows                      |
| `IconChevronDownSmall`            | Git panel, open picker                           |
| `IconChevronLeft`                 | Ask tool: prev                                   |
| `IconChevronRight`                | Menus, git, model picker                         |
| `IconCircleCheck`                 | Sonner: success                                  |
| `IconClipboard`                   | Chat rows: copy                                  |
| `IconCloudDownload`               | Update pill: download                            |
| `IconConsole`                     | Chat rows: terminal attachment                   |
| `IconCrossSmall`                  | Close, destructive, dialogs, composer            |
| `IconFileBend`                    | Files, git, slash, fallback file icon            |
| `IconFolder1`                     | Workspace picker, slash: folder                  |
| `IconFolderOpen`                  | Open picker: open folder                         |
| `IconImages1`                     | Composer / chat: image                           |
| `IconLoader`                      | Loading rows, Sonner                             |
| `IconPlusLarge`                   | Sidebar header, composer attach, command palette |
| `IconPuzzle`                      | Settings: Extensions                             |
| `IconSearchIntelligence`          | Composer file preview                            |
| `IconSettingsGear2`               | Footer, slash app, command palette               |
| `IconSidebar`                     | Sidebar toggle (visible)                         |
| `IconSidebarHiddenLeftWide`       | Sidebar hidden (left)                            |
| `IconSidebarHiddenRightWide`      | Composer sidebar hidden                          |
| `IconSparklesSoft`                | Slash menu: skills                               |
| `IconStop`                        | Composer: stop                                   |
| `IconToolbox`                     | Chat rows: tools                                 |
| `IconX`                           | Sheet, combobox clear                            |

Canonical list for codegen / drift checks: `apps/web/src/lib/glass-central-icon-inventory.tsx`.

---

## Native shell & bundled assets (not `central-icons`)

| Kind                     | Location / API                                                                            | Notes                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Window / OS icon         | `getIconOption()` in `apps/desktop/src/main.ts`; `icon.png` / `icon.ico` / bundle `.icns` | Taskbar / window chrome                                      |
| Destructive menu (macOS) | `nativeImage.createFromNamedImage("trash")` in `main.ts`                                  | Context menu delete                                          |
| Editor brands            | `apps/web/public/icons/` (`cursor`, `vscode`, `zed`); see `public/icons/index.ts`         | Paths also referenced from `shell-service.ts` for deep links |

---

## Related

- `AGENTS.md` — use `central-icons` for UI icons in this repo.
