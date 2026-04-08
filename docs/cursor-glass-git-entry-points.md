# Cursor Glass Git Entry Points

This doc is a focused map for two jobs:

1. Find the exact Cursor source entry points for Git panel styling and behavior.
2. Decide how to implement comparable `git + diff + terminal + browser` surfaces in `c-glass`.

This is a research doc only. No implementation is implied by anything here.

---

## Goal

Target the Cursor Glass Git experience shown in the screenshot:

1. Git panel with top chrome, branch context, and action CTA.
2. Tree-like changed-files list with grouped paths.
3. Right-side diff viewer.
4. Integrated terminal surface.
5. Embedded browser/webview that is good enough for auth and login flows.

---

## Cursor Source Of Truth

Cursor 3.0.4 is bundled into two main workbench files:

1. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.css`
2. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js`

Use them as follows:

1. `workbench.desktop.main.css` is the styling source of truth for Glass surfaces, SCM rows, review groups, quick input, and many exact selectors.
2. `workbench.desktop.main.js` is the runtime source of truth for view wiring, browser/webview behavior, SCM actions, tree widgets, and editor integrations.

---

## Cursor Entry Points For Styling

If you want to inspect Cursor styling exactly, start in the CSS bundle with these selector families.

### Git / Changes Panel

Search for these first:

```bash
rg -n "review-changes|smart-review-panel|scm-view|scm-review-file-header" \
  "/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.css"
```

Important selectors:

1. `.changes-list`
2. `.changes-container`
3. `.review-changes-selectable-cell`
4. `.review-changes-file-name`
5. `.review-changes-path-prefix`
6. `.review-changes-group`
7. `.review-changes-group__header`
8. `.review-changes-group__body`
9. `.smart-review-panel`
10. `.smart-review-panel__header`
11. `.smart-review-panel__header-tab`
12. `.commit-message-textarea`
13. `.scm-view`
14. `.scm-review-status-header`
15. `.scm-review-file-header`
16. `.scm-review-file-name`

These selectors are the shortest path to the file tree, diff card framing, and panel chrome that matters for the screenshot.

### Glass Surface Tokens

Search for:

```bash
rg -n "--glass-|data-cursor-glass-mode|cursor-glass-os-vibrancy" \
  "/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.css"
```

Important token families:

1. `--glass-sidebar-surface-background`
2. `--glass-chat-surface-background`
3. `--glass-editor-surface-background`
4. `--glass-surface-background`
5. `--glass-chat-bubble-background`
6. `--glass-window-border-color`
7. `--glass-traffic-lights-spacer-width`
8. `--glass-in-app-menu-bar-height`

These tell you how Cursor maps surface colors under Glass mode and vibrancy.

### Quick Input / Command Palette

Search for:

```bash
rg -n "quick-input-widget|quick-input-list|quick-input-header" \
  "/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.css"
```

This matters because Cursor reuses the same sizing language across floating panels.

### Tree / List Styling

Cursor uses Monaco tree/list primitives under the hood. Search for:

```bash
rg -n "monaco-list-row|monaco-tl-|file-icon-themable-tree" \
  "/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.css" \
  "/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js"
```

This is the path to the file tree feel rather than just the Git-specific row classes.

### Dirty Diff / Multi Diff

Search for:

```bash
rg -n "dirty-diff|openMultiDiffEditor|quickdiff|diffEditor" \
  "/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js"
```

This tells you how Cursor handles diff widgets beyond just a plain patch renderer.

---

## Cursor Entry Points For Behavior

### Browser / Webview

Search for:

```bash
rg -n "WebviewBrowserManager|openBrowserEditor|webview-browser-content|<webview>|devtools" \
  "/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js"
```

What is happening there:

1. Cursor creates Electron `<webview>` elements.
2. It mounts them into the workbench under the Glass root.
3. It manages navigation, focus, popups, find-in-page, devtools, certificates, and context menu.
4. This is why Cursor can support auth flows and login popups inside the app.

### SCM / Review Views

Search for:

```bash
rg -n "scm-view|history-item|openMultiDiffEditor|SCM" \
  "/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js"
```

This is where the review tree and diff-opening behavior live.

### Terminal

Search for:

```bash
rg -n "xterm|terminal|terminal tabs|xterm-256color" \
  "/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js"
```

Cursor is following the usual VS Code shape here: integrated terminal service, xterm frontend, PTY-backed process control.

---

## c-glass Local Entry Points

If we implement parity here, these are the local files to start from.

### Shell Mount Point

Start at:

1. `apps/web/src/components/glass/chat-shell.tsx`
2. `apps/web/src/components/glass/app-shell.tsx`

Why:

1. `chat-shell.tsx` mounts the Git panel into the right rail via `GlassGitPanel`.
2. `app-shell.tsx` owns the right-side shell, resize behavior, toggle chip, and Glass framing.

### Git UI

Read next:

1. `apps/web/src/components/glass/git-panel.tsx`
2. `apps/web/src/hooks/use-glass-git.ts`
3. `apps/web/src/hooks/use-glass-git-viewed.ts`
4. `apps/web/src/components/glass/diff-viewer.tsx`

Current state:

1. `git-panel.tsx` already has grouped file rows and a split tree/diff layout.
2. `use-glass-git.ts` currently reduces backend Git state down to a minimal UI model.
3. `patch` is always `null` today.
4. `discard` is stubbed.
5. Branch, upstream, PR, ahead/behind, and repo metadata exist in contracts but are not exposed to the panel model.

### Git Backend

Read:

1. `packages/contracts/src/git.ts`
2. `packages/contracts/src/rpc.ts`
3. `packages/contracts/src/ipc.ts`
4. `apps/web/src/wsRpcClient.ts`
5. `apps/web/src/wsNativeApi.ts`
6. `apps/server/src/ws.ts`
7. `apps/server/src/git/Services/GitStatusBroadcaster.ts`
8. `apps/server/src/git/Layers/GitStatusBroadcaster.ts`
9. `apps/server/src/git/Services/GitManager.ts`
10. `apps/server/src/git/Services/GitCore.ts`
11. `apps/server/src/git/Layers/GitCore.ts`

Key observation:

1. The backend already has enough state to build a richer Git panel.
2. The web adapter currently throws away a lot of it.
3. `wsRpcClient.ts` already supports `git.runStackedAction`.
4. `ipc.ts` and `wsNativeApi.ts` do not currently expose `runStackedAction` through `NativeApi.git`.

### Diff Styling

Read:

1. `apps/web/src/components/glass/diff-viewer.tsx`
2. `apps/web/src/styles/glass.css`
3. `apps/web/src/styles/app.css`
4. `apps/web/src/lib/pierre-color-presets.ts`

Important detail:

1. The main diff viewer uses `@pierre/diffs/react`.
2. The real styling bridge is global CSS via `[data-diffs-container]` in `glass.css`.
3. The panel container framing is in `app.css` under `.diff-panel-viewport` and `.diff-render-file`.

### File Search / Explorer Foundation

Read:

1. `packages/contracts/src/project.ts`
2. `apps/server/src/workspace/Services/WorkspaceEntries.ts`
3. `apps/server/src/workspace/Layers/WorkspaceEntries.ts`
4. `apps/web/src/lib/vscode-file-icon.tsx`
5. `apps/web/src/vscode-icons-manifest.json`

What exists already:

1. We do not have a full Explorer tree yet.
2. We do have a cached project entry search service.
3. That service prefers Git-based workspace listing when possible.
4. File icon rendering is already in place using VS Code icon manifests.

### Terminal Foundation

Read:

1. `packages/contracts/src/terminal.ts`
2. `apps/server/src/terminal/Services/PTY.ts`
3. `apps/server/src/terminal/Layers/NodePTY.ts`
4. `apps/server/src/terminal/Services/Manager.ts`
5. `apps/server/src/terminal/Layers/Manager.ts`
6. `apps/web/src/main.tsx`
7. `apps/web/src/styles/app.css`

What exists already:

1. Backend terminal infrastructure is real and complete enough to build on.
2. It uses `node-pty` and `xterm-256color`.
3. It persists history, supports resize/restart, and streams terminal events.
4. The frontend already imports `@xterm/xterm/css/xterm.css` in `apps/web/src/main.tsx`.
5. There are xterm scrollbar overrides in `apps/web/src/styles/app.css`.
6. I did not find the active terminal drawer component in this pass, so the server side is more obvious than the current renderer surface.

### Browser / Webview Foundation

Read:

1. `apps/server/src/open.ts`
2. `apps/web/src/components/glass/open-picker.tsx`
3. `apps/web/src/wsNativeApi.ts`

Current state:

1. c-glass currently opens URLs externally or opens folders in an editor/file manager.
2. It does not have a Cursor-style embedded browser tab system yet.
3. If we want login-compatible browser behavior, we will need a dedicated Electron webview surface rather than only `openExternal`.

---

## How I Would Implement It

This is the pragmatic path I would take.

### Phase 1: Make The Existing Git Panel Honest

Keep the current architecture and deepen it.

1. Expand `use-glass-git.ts` so it preserves branch, repo, upstream, ahead/behind, PR, and remote metadata from `GitStatusResult`.
2. Add a real panel header matching the Cursor screenshot shape: current mode, branch context, totals, and CTA slot.
3. Wire `runStackedAction` into `NativeApi.git` through `packages/contracts/src/ipc.ts` and `apps/web/src/wsNativeApi.ts` so the UI can do `commit`, `push`, or `commit_push`.
4. Add a real `discard` action on the server and surface it through the same RPC layer.
5. Add file patch loading per selected row instead of `patch: null`.

Why first:

1. It gives a much better Git panel without introducing a new shell concept.
2. It uses the backend that already exists.
3. It keeps iteration speed high.

### Phase 2: Move The File List Closer To Cursor

Replace the ad hoc grouped list feel with a stronger tree model.

1. Keep the current React implementation at first, but move toward a true nested tree data structure instead of grouping only by parent directory string.
2. Use the VS Code icon stack from `vscode-file-icon.tsx` for files and folder glyphs for directories.
3. Match Cursor row sizing from the scratchpad: `12px` to `13px` text, `22px` row rhythm, `4px` to `6px` gaps, sticky group headers, and RTL path prefix truncation.
4. Preserve the current Glass shell styling, but use Cursor spacing and row structure as the visual reference.

I would not start by importing Monaco tree primitives. I would first get parity in shape and spacing using the current React panel. Monaco is only worth it if we need exact keyboard/tree semantics later.

### Phase 3: Strengthen The Diff Side

1. Keep `@pierre/diffs/react` initially.
2. Improve the file header and mode switching around it rather than replacing the renderer immediately.
3. Add `unified` and `split` toggle in the Git header.
4. Add sticky file metadata and totals above the diff pane.
5. If Pierre becomes the visual blocker, then evaluate swapping to a renderer with better line-level header control.

I would not replace the diff renderer in the first pass. The shell and panel layout will matter more than the exact hunk internals.

### Phase 4: Build The Real Terminal Surface

Use the existing server terminal services and finish the frontend layer.

1. Add a dedicated terminal panel component using xterm.
2. Subscribe to terminal events via `nativeApi.terminal.onEvent`.
3. Reuse the thread-scoped terminal session model that the backend already understands.
4. Start with one terminal tab plus split later.
5. Only add terminal tab chrome after a stable first terminal surface exists.

This is lower risk than browser because the backend is already done.

### Phase 5: Add Embedded Browser / Webview

For auth and login flows, I would make this an Electron-native surface.

1. Build an Electron webview-backed browser panel or tab surface rather than trying to fake login inside a plain iframe.
2. Expose a narrow desktop bridge for browser events, popup handling, URL changes, back/forward/reload, and optional cookie/session management.
3. Support popup windows or new-tab behavior for OAuth flows.
4. Keep external browser fallback for unsupported cases.

If the requirement is "supports login and stuff", a real Electron webview is the right tool. Plain external open is not enough, and a normal web iframe is too limited.

---

## Recommended Implementation Order

If the aim is fast useful parity, I would do it in this order:

1. Git panel header and action plumbing.
2. Real patch loading and discard support.
3. Better file tree structure and styling parity.
4. Proper terminal frontend.
5. Embedded browser/webview.

That order keeps risk low and makes each step visible.

---

## Exact Files To Open First

If you only want the shortest reading path, open these in order.

### Cursor

1. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.css`
2. `/System/Volumes/Data/Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js`

Then search these strings in the CSS bundle:

1. `review-changes`
2. `smart-review-panel`
3. `scm-view`
4. `scm-review-file-header`
5. `quick-input-widget`
6. `data-cursor-glass-mode`
7. `--glass-sidebar-surface-background`

Then search these strings in the JS bundle:

1. `WebviewBrowserManager`
2. `workbench.action.openBrowserEditor`
3. `openMultiDiffEditor`
4. `dirty-diff`
5. `scm-view`
6. `xterm`

### c-glass

1. `apps/web/src/components/glass/chat-shell.tsx`
2. `apps/web/src/components/glass/app-shell.tsx`
3. `apps/web/src/components/glass/git-panel.tsx`
4. `apps/web/src/hooks/use-glass-git.ts`
5. `apps/web/src/components/glass/diff-viewer.tsx`
6. `apps/web/src/styles/glass.css`
7. `apps/web/src/styles/app.css`
8. `apps/server/src/ws.ts`
9. `apps/server/src/git/Layers/GitStatusBroadcaster.ts`
10. `apps/server/src/git/Layers/GitCore.ts`
11. `apps/server/src/terminal/Layers/Manager.ts`
12. `apps/server/src/terminal/Layers/NodePTY.ts`
13. `apps/server/src/open.ts`

---

## Notes On Styling Parity

If the goal is "look into their styling exactly", these are the highest-value visual details to compare side by side:

1. Row height and text size in SCM rows.
2. Sticky directory group headers.
3. Path prefix truncation using RTL.
4. Header padding and border rhythm.
5. Panel background vs diff background separation.
6. Hover and active row backgrounds.
7. Add/delete color values and opacity.
8. Action button radius and vertical alignment.
9. The spacing between left file tree and right diff pane.
10. Glass surface token mapping under light and dark themes.

---

## Current Gaps To Keep In Mind

1. c-glass does not yet expose `git.runStackedAction` through `NativeApi`, even though the RPC client supports it.
2. c-glass does not yet have a real selected-file patch pipeline in the Git panel.
3. c-glass does not yet have a real discard pipeline in the Git panel.
4. c-glass does not yet have a full Explorer tree.
5. c-glass does not yet have a Cursor-style embedded browser surface.
6. c-glass terminal backend is ready, but the frontend terminal surface is not obvious from the current web app code.

---

## Suggested Next Research Follow-Ups

If you want, the next useful docs I can add are:

1. A selector atlas of Cursor Git/SCM CSS copied into a compact reference table.
2. A local implementation map for `Git panel -> RPC -> server Git service` with exact functions and data shape changes.
3. A browser/webview design note just for auth-compatible embedded browsing in Electron.
