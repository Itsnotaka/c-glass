# Cursor Glass research scratchpad

**Install surveyed:** `/System/Volumes/Data/Applications/Cursor.app` (macOS)  
**App version:** `3.0.4` (`Contents/Resources/app/package.json`)  
**Workbench bundle:** `Contents/Resources/app/out/vs/workbench/workbench.desktop.main.{js,css}`

**Disclaimer:** Go all in, this is a research doc, go through the source code as long as you need the info

---

## Product note: Glass as “new agent window”

Glass is a **distinct workbench mode**, not only a skin:

- `nativeWorkbenchEnvironmentService.isGlass` gates behavior (e.g. selected-context utilities only run when Glass is active).
- Window chrome strings reference an **Agents window**: “Minimize / Maximize / Restore / Close **Agents window**”.
- Opening flows use `**cursorForceNewWindow`** (alongside normal `forceNewWindow`) when routing folder/file opens.
- **Unified sidebar / agents toggles:** `workbench.action.toggleAgents`, `workbench.action.toggleAgentsFromKeyboard`, `workbench.action.toggleUnifiedSidebar`, `workbench.action.toggleUnifiedSidebarFromKeyboard`, and `cursor.toggleAgentWindowIDEUnification`.

Treat “new agent window” as: **a BrowserWindow (or equivalent) running the workbench with Glass layout + agent UI**, separate from the classic IDE shell where the agent is only a side panel.

---

## Parallel research tracks (10)

Each track is what a dedicated pass over the same bundle would own. Evidence is from **Cursor 3.0.4** unless noted.

### 1. DOM contract: `data-cursor-glass-mode` and body classes

- `**data-cursor-glass-mode`** on `body` (boolean attribute; CSS uses both `=true` and `="true"` forms in different rules).
- **Theme family:** `body.cursor-light`, `body.cursor-dark`, `body.cursor-high-contrast` (and Glass-specific rules stack on top).
- **macOS vibrancy:** `body.cursor-glass-os-vibrancy-on` vs `cursor-glass-os-vibrancy-off` — switches which **surface** tokens map to vibrancy-tuned values.

### 2. `data-component` hooks (stable selectors)


| Value                  | Role                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `root`                 | Top-level shell; receives **mapped** `--glass-*-surface-background` variables under vibrancy rules. |
| `agent-panel`          | Agent UI root; used in selectors for tool-call stop button, etc.                                    |
| `glass-in-app-menubar` | In-window menu bar region for Glass.                                                                |
| `workspaces-container` | Workspace switcher / workspace UI host.                                                             |


### 3. CSS variables: `--glass-*` (authoritative list from `workbench.desktop.main.css`)


| Token                                             | Typical role                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `--glass-traffic-lights-spacer-width`             | Reserves horizontal space for macOS traffic lights (often `80px` in devtools). |
| `--glass-in-app-menu-bar-height`                  | Height of in-app menu bar (`0px` when native menu only).                       |
| `--glass-sidebar-surface-background`              | Sidebar / agent list column surface.                                           |
| `--glass-chat-surface-background`                 | Chat / transcript column surface (also used in error boundaries in JS).        |
| `--glass-editor-surface-background`               | Editor / main pane surface in Glass layout.                                    |
| `--glass-surface-background`                      | Generic glass surface.                                                         |
| `--glass-onboard-surface-background`              | Onboarding flows.                                                              |
| `--glass-chat-bubble-background`                  | Chat bubble fill.                                                              |
| `--glass-chat-bubble-opaque-background`           | Opaque bubble variant.                                                         |
| `--glass-vibrancy-on-sidebar-surface-background`  | Vibrancy **on**: sidebar tint source.                                          |
| `--glass-vibrancy-on-chat-surface-background`     | Vibrancy **on**: chat tint source.                                             |
| `--glass-vibrancy-on-editor-surface-background`   | Vibrancy **on**: editor tint source.                                           |
| `--glass-vibrancy-on-surface-background`          | Shared vibrancy-on base.                                                       |
| `--glass-vibrancy-off-sidebar-surface-background` | Vibrancy **off** sidebar.                                                      |
| `--glass-vibrancy-off-chat-surface-background`    | Vibrancy **off** chat.                                                         |
| `--glass-vibrancy-off-editor-surface-background`  | Vibrancy **off** editor.                                                       |
| `--glass-window-border-color`                     | Window / split chrome.                                                         |
| `--glass-static`                                  | Static (non-animated) hint for subtrees.                                       |
| `--glass-image-preview-scale`                     | Image preview sizing.                                                          |
| `--glass-subagent-breadcrumb-border-bottom`       | Subagent breadcrumb separator.                                                 |
| `--glass-sidebar-agent-status-dot-size`           | Status dot in sidebar.                                                         |
| `--glass-sidebar-status-affordance-opacity`       | Muted status affordance.                                                       |


**Vibrancy mapping (matches your DevTools snippet):** when `body...cursor-glass-os-vibrancy-on[data-cursor-glass-mode=true] [data-component=root]` applies, the **surface** variables alias the **vibrancy-on** ones, e.g.:

`--glass-sidebar-surface-background` → `var(--glass-vibrancy-on-sidebar-surface-background)` (and similarly for chat / editor).

**Underlying Cursor palette:** vibrancy-on/off entries resolve to `**--cursor-bg-*`** tokens (e.g. `--cursor-bg-sidebar`, `--cursor-bg-chrome`, `--cursor-bg-elevated`), not raw hex in the vibrancy layer.

### 4. Layout: traffic lights and sidebar top bar

- `**--ui-sidebar-traffic-lights-spacer-width**`: used with sidebar top padding; width rule pattern:  
`max(0px, var(--ui-sidebar-traffic-lights-spacer-width) - var(--ui-sidebar-top-bar-horizontal-padding, 0px))`.
- **Class:** `.traffic-lights-spacer` — `flex-shrink: 0; width: var(--glass-traffic-lights-spacer-width)`.
- `**--zoom-factor`**: appears in bundle (used for scaled UI).

### 5. Typography

- `**--cursor-font-family-sans**`: primary UI sans stack; fallbacks in rules include `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, etc.
- Some headings use `**"SF Pro", var(--cursor-font-family-sans)**`.

### 6. Component / class names (agent tray, prompts, glass chrome)

Representative BEM-style classes in CSS/JS:

- **Agent tray / prompt:** `ui-agent-tray__prompt-wrap`, `ui-prompt-input`, `ui-prompt-input--agent-tray-stack`, `glass-model-picker-wrapper`.
- **Glass-specific UI:** `ui-shell-tool-call__glass-stop`, `ui-slash-menu__content--glass`, `ui-mention-menu-side-preview--glass`, `ui-gallery-glass-chrome`.
- **Sidebar loader:** `glass-sidebar-agent-ascii-loader`.
- **Diff / selection:** extra rules under `body[data-cursor-glass-mode=true].cursor-dark` for `.ui-default-diff` selection colors.
- **Vibrancy mask:** `.ui-vibrancy-sticky-rounded-mask`.

### 7. Commands and internal IDs (agent window lifecycle)

User-visible command **titles** sampled from the bundle:

- Open **New Agent Chat**, **Open Agent as Pane**, **Cycle Agent Location**, **Swap Agent Sidebar Location**, **Focus Agent**, **Open Agent Changes** / **Close Agent Changes**, **Agent Settings**, **Show Cloud Agents**, window **Minimize / Maximize / Restore / Close Agents window**.

Internal **command / action ids** (partial):

- `workbench.action.toggleAgents`, `workbench.action.toggleAgentsFromKeyboard`, `workbench.action.toggleUnifiedSidebar`, `workbench.action.toggleUnifiedSidebarFromKeyboard`, `cursor.toggleAgentWindowIDEUnification`
- `newAgent`, `newAgentFromCmdT`, `newAgentFromKeyboard`, `newAgentKeepPaneFromKeyboard`, `newAgentWithModel`, `newAgentWithQuery`, `cursorai.action.createNewAgentWithImagePrompt`
- Glass menubar update flow: `checkForUpdatesFromGlassMenubar`, `glassMenubarCheckingForUpdates`, `glassMenubarDownloadUpdate`, …
- `composer.openBackgroundComposerAsChat` — opens a background composer session as chat (bridge between background agent and main agent UI).

### 8. Runtime theming (injected CSS)

Workbench stamps dynamic theme CSS into `<style>` elements (IDs present in JS: registry, floating widget, theming rules). Glass mode adds **string-built** rules such as:

`body.{cursor-light|cursor-dark|cursor-highContrast}[data-cursor-glass-mode="true"] { ... }`

Those blocks are generated next to theme color maps (minified names like `OAn`, `kaf` in JS). **Authoritative static tokens** remain in `workbench.desktop.main.css`.

### 9. Background composer ↔ chat

- **Remote authority** `background-composer` still appears in extension manifest (`cursor-socket`) for socket resolution.
- **Unified mode** `"background"` on a composer ties to cloud / background agent flows; utilities check `composerModesService.getComposerUnifiedMode` and `createdFromBackgroundAgent.bcId`.

### 10. Gaps for c-glass


| Cursor Glass                                     | c-glass direction                                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `data-cursor-glass-mode` + vibrancy body classes | Your app can use `data-glass-mode` + theme class on `document.body` or root layout.                                                 |
| `--glass-*` / `--cursor-bg-*` cascade            | Map to CSS variables in web app + `desktop:set-theme`; no need to copy names unless you want token parity.                          |
| `contextBridge` + 100+ VS Code services          | Keep `**glass:*`** IPC as the narrow, stable surface.                                                                               |
| Native traffic-light inset                       | On Electron, use `titleBarStyle: hiddenInset` (or platform equivalent) and replicate `--glass-traffic-lights-spacer-width` padding. |


---

## Your snippet (validated against 3.0.4)

The rule shape you pasted matches shipped CSS:

```css
body.cursor-light.cursor-glass-os-vibrancy-on[data-cursor-glass-mode="true"]
  [data-component="root"] {
  --glass-sidebar-surface-background: var(--glass-vibrancy-on-sidebar-surface-background);
  --glass-chat-surface-background: var(--glass-vibrancy-on-chat-surface-background);
  --glass-editor-surface-background: var(--glass-vibrancy-on-editor-surface-background);
}
```

Supporting utilities from the same stylesheet include:

```css
--glass-traffic-lights-spacer-width: …;
--ui-sidebar-traffic-lights-spacer-width: …;
--glass-in-app-menu-bar-height: …;
--zoom-factor: …;
--cursor-font-family-sans: …;
```

Exact default values can differ by platform and settings; **read computed styles** on `[data-component="root"]` in a live Glass window for ground truth.

---

## Files to re-scan after each Cursor update

1. `Contents/Resources/app/package.json` — app version
2. `out/vs/workbench/workbench.desktop.main.css` — `--glass-`* / `--cursor-*` tokens
3. `out/vs/workbench/workbench.desktop.main.js` — `isGlass`, command IDs, `data-component` strings

---

## Removed from this scratchpad

Older content about generic Cursor infra (`product.json` update URLs, full extension matrix, Composer service string dumps) was **dropped** to keep this document **Glass-only**. Reintroduce those sections from git history or regenerate if you need the full-app atlas again.