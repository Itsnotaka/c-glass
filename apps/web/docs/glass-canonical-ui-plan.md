# Glass Canonical UI Plan

This document is the canonical plan for the unreleased Glass shell UI.

It is not a migration plan, a V1 plan, or a stopgap plan. It describes the final intended architecture and behavior for the left thread rail, center hero/chat canvas, right git context panel, and the overlay hierarchy that governs them.

The goal is to make the product coherent before release, not to preserve accidental constraints from the current implementation.

## Product Model

Glass is a standalone desktop-first app.

Glass does not require a workspace to be chosen before the app becomes useful.

Glass starts in a default workspace rooted at the user home directory when no explicit project has been chosen.

A Glass session is always attached to a workspace context.

A workspace context may or may not be a git repository.

The shell is always a three-panel application shell.

The three-panel shell is the product.

## Canonical Shell

The app shell is a single three-slot layout with these responsibilities.

### Left Panel

The left panel is the navigation rail for creating and finding conversations.

The left panel contains `New Agent` and the session list (grouped by workspace).

The left panel is collapsible.

The left panel has an explicit toggle.

The left panel width is resizable on desktop.

The left panel open state and width are persisted per workspace.

The left panel content is session-backed and workspace-aware.

The left panel is not duplicated inside route-specific components.

### Center Panel

The center panel is the primary task surface.

The center panel shows the hero state when there is no active thread.

The center panel shows the chat session when there is an active thread.

The center panel owns the main composer surface.

The center panel owns the message timeline.

The center panel owns inline tool cards inside the transcript.

The center panel never owns the persistent thread rail.

The center panel never invents right-panel state.

### Right Panel

The right panel is the git context and diff review surface.

The right panel is collapsible.

The right panel has an explicit toggle.

The right panel width is resizable on desktop.

The right panel open state and width are persisted per workspace.

The right panel content comes from git state.

The right panel never uses transcript tool cards as the source of truth for diffs.

The right panel may use session activity to auto-open or auto-select a file.

The right panel may be present and empty.

The right panel does not disappear just because the center panel is in hero mode.

## Canonical Overlay Hierarchy

Overlay ownership must be explicit and stable.

This hierarchy is the source of truth.

### Shell-Level Overlays

Shell-level overlays are global to the application window.

Shell-level overlays include settings when presented as a sheet or modal (workbench settings live in-route under `/settings`).

Shell-level overlays include the mobile left panel sheet.

Shell-level overlays include the mobile right panel sheet.

Shell-level overlays include provider authentication dialogs.

Shell-level overlays include future global workspace pickers.

Shell-level overlays are rendered once at the app shell level.

Shell-level overlays are never duplicated inside both hero and chat canvases.

### Panel-Level Interactive Layers

Panel-level layers include collapsible sections, popovers, comboboxes, and menus that belong to a specific panel.

These layers must visually sit above their owning panel content but below global dialogs.

They do not own application routing.

They do not own shell panel visibility.

### Transcript-Level Expandables

Transcript-level expandables include tool cards, bash cards, and inline collapsible detail sections.

They stay inside the timeline.

They do not become side panels.

They do not create global overlays.

### Layering Rules

The center panel should never create an overlay that visually breaks the shell.

The right panel should never be implemented as a fake overlay floating over the center panel on desktop.

Desktop panel toggles change layout width, not z-index tricks.

Mobile may convert left and right panels into sheets.

Dialogs always outrank sheets.

Sheets always outrank panel content.

Panel content always outranks decorative backgrounds.

## Routing Model

Routing remains simple.

The root chat index route renders the shell with no active thread selected.

The thread route renders the shell with an active thread selected.

Routing chooses the center content.

Routing does not construct separate shell architectures per route.

The shell component is shared.

The route decides whether the center slot receives `GlassHeroCanvas` or `GlassChatSession`.

The route does not duplicate thread list rendering.

The route does not duplicate right-panel rendering.

## Left Panel: Agent sessions

The left panel is a real session browser, not a local placeholder.

It is backed by session summaries from the desktop session service.

It must update live as sessions are created, renamed, or streamed.

### Minimum Canonical Content

The minimum canonical content is:

- `New Agent`
- Session list (threads) grouped by workspace

No additional top-level navigation is required for the canonical shell.

### Grouping Model

Threads are grouped by workspace folder.

Grouping is part of the canonical design, not a later enhancement.

A standalone app needs a stable navigation model when multiple workspaces exist.

The top grouping key is the workspace root or effective folder label.

Within each workspace group, threads are sorted by last modified time.

The active thread is highlighted.

Thread titles come from the session name when available.

When the session name is absent, the title falls back to the first user message.

When both are absent, the title falls back to `Untitled`.

### Default Workspace Behavior

When Glass starts without an explicit project, the default workspace is the user home directory.

Threads created in that state belong to the home-directory workspace group.

If the user later picks a workspace, sessions created there appear under that workspace group.

The app does not require the user to choose a workspace before they can create a thread.

### Sidebar Interactions

Selecting a thread navigates to that thread.

Creating a new agent creates a session in the current workspace context and selects it.

The left panel toggle works on both hero and active-thread routes.

The left panel remains mounted on desktop even when collapsed.

The mobile left panel becomes a sheet controlled by the same conceptual toggle.

## Center Panel: Hero State

The hero state is a first-class screen.

It is not an empty placeholder.

It is not a text-only message telling the user to select an agent.

### Hero Requirements

The hero state contains the main composer.

The hero state contains quick actions.

The hero state reflects the current workspace context.

The hero state supports model selection and thinking-level selection through the composer controls.

The hero state can create a session by sending the first message.

The hero state can coexist with an empty or populated right panel.

### Hero Layout

The hero state is centered and intentional.

It should feel like the starting surface shown in the reference screenshot.

It should not collapse because the right panel is open.

It should adapt gracefully to a collapsed or expanded left panel.

## Center Panel: Active Thread State

The active thread state is the canonical chat screen.

### Chat Requirements

The message timeline is scrollable and sticky to bottom when appropriate.

The composer is always present at the bottom.

The composer never disappears because the right panel is open.

The top bar may show the thread title and panel toggles.

The transcript owns inline tool detail rendering.

The transcript may show tool cards, bash cards, system cards, compaction summaries, and branch summaries.

The transcript does not own git diffs.

### Tool Card Role

Tool cards represent what the agent attempted or observed.

Tool cards may show `read`, `edit`, `write`, `bash`, `grep`, `find`, and similar details.

Tool cards remain useful for auditing the agent.

Tool cards do not drive the file list or patch content of the right panel.

## Right Panel: Git Context Panel

The right panel is the source control and diff review panel.

This panel behaves more like VS Code or the Notion Calendar side context panel than a transcript attachment viewer.

### Source of Truth

Git is the source of truth.

The right panel file list comes from git.

The right panel count comes from git.

The rendered diff comes from git patch data.

Transcript tool calls are not the source of truth.

### What Git State Includes

The panel must account for tracked changes.

The panel must account for staged and unstaged changes.

The panel must account for untracked files.

The panel must account for renames and deletions.

The panel should present the total changed-file count as a combined workspace truth.

### Empty and Non-Repo States

When the current workspace is a git repository with no changes, the right panel shows a clean empty state.

When the current workspace is not a git repository, the right panel shows a non-repo empty state with an `Init Git` button.

The non-repo state should feel like a source-control panel, not like an error screen.

The user can initialize git from the right panel.

The right panel never crashes when the workspace is not a repository.

### Hero Compatibility

The right panel is allowed to remain open on the hero screen.

If the workspace has git changes, the hero screen can coexist with a populated right panel.

If the workspace has no git repository, the right panel shows the `Init Git` state even on the hero screen.

### Selection Model

If no file is selected and there are changed files, the panel selects a sensible default.

If the user selects a file, that selection persists until it becomes invalid.

If the current chat edits a file and that file appears in git changes, the panel may auto-select it.

### Auto-Open Model

The right panel may auto-open when the current session performs a file-changing operation.

Auto-open is a convenience, not the state model.

Open or collapsed state is still persisted.

The panel should not repeatedly steal focus after the user intentionally closes it.

## Canonical Git Data Pipeline

The desktop process owns git inspection.

The web process consumes normalized git state through a contract.

### Desktop Responsibilities

The desktop layer detects the effective workspace root and git root.

The desktop layer can answer whether the current workspace is inside a git repository.

The desktop layer can initialize git for the current workspace.

The desktop layer can produce a changed-file summary.

The desktop layer can produce raw patch text or normalized patch data for the current workspace.

The desktop layer can refresh git state on demand and on relevant file changes.

### Web Responsibilities

The web layer renders the right panel using the git contract.

The web layer does not spawn git directly.

The web layer parses or consumes patch data and feeds `@pierre/diffs`.

The web layer manages selection, expansion, and panel chrome.

### Diff Rendering

`@pierre/diffs` is the canonical diff renderer.

Raw patch text should be parsed with `parsePatchFiles` or equivalent library helpers.

The app should not maintain fake sample diff data.

The app should not hand-author `FileDiffMetadata` objects except in tests.

## Session-to-Git Coupling

Session activity and git state are related but not identical.

This distinction must remain clean.

### Session Responsibilities

A session tracks messages, live assistant updates, tool calls, and tool results.

A session may know that the agent executed `edit`, `write`, or `bash`.

A session may know touched file paths.

A session may use tool activity to hint the git panel.

### Git Panel Responsibilities

The git panel decides what actually changed in the workspace.

If a tool call claims a file changed but git shows no change, the git panel trusts git.

If the user manually edits a file outside the session, the git panel still shows that change.

The right panel reflects workspace truth, not only session provenance.

### Auto-Selection Hints

When a tool call includes a `path`, the shell should remember that as a recent candidate for right-panel selection.

If git later reports a changed file matching that path, the panel can select it.

If no matching file exists, the panel should not create synthetic entries.

## Toggle Model

The shell must provide explicit toggles for both side panels.

This is a canonical requirement.

### Left Toggle

The left toggle opens and collapses the thread rail.

The left toggle is available in the shell header.

The left toggle works in both hero and active-thread states.

The left toggle also drives the mobile left sheet.

### Right Toggle

The right toggle opens and collapses the git context panel.

The right toggle is available in the shell header.

The right toggle works in both hero and active-thread states.

The right toggle also drives the mobile right sheet.

### Persistence

Both toggle states are persisted per workspace.

Both panel widths are persisted per workspace.

The app should restore the most recent shell shape when returning to a workspace.

## Canonical Component Ownership

The component tree must make ownership obvious.

### App Shell

The top-level shell owns panel visibility state, panel sizes, and shell-level overlays.

The app shell owns the three-slot layout.

The app shell owns the desktop panel rails and mobile sheets.

### Left Rail Content

The left rail content component owns thread grouping and thread row rendering.

It does not own shell width or shell visibility.

### Center Content

The route picks whether the center slot renders hero or active thread.

The center content owns only center content.

It does not mount a duplicate thread rail.

It does not mount a duplicate right panel.

### Right Panel Content

The right panel content component owns git summary rendering, file list rendering, and diff selection.

It does not own shell width or shell visibility.

It does not fabricate file changes from sample data.

## Canonical Contracts

The codebase needs explicit contracts for the git panel.

### Required Contract Surface

The shell bridge must expose the current workspace state.

A git bridge or shell extension must expose whether the workspace is in a git repository.

A git bridge or shell extension must expose the detected git root when present.

A git bridge or shell extension must expose the changed-file count.

A git bridge or shell extension must expose changed files with status and counts.

A git bridge or shell extension must expose patch content suitable for `@pierre/diffs`.

A git bridge or shell extension must expose `init` support.

A git bridge or shell extension should expose refresh and event subscriptions.

### Event Model

The shell should be able to subscribe to git-state changes for the current workspace.

The shell should refresh git state when the workspace changes.

The shell should refresh git state after relevant tool results and file writes.

The shell should refresh git state when the window regains focus.

## Canonical State Model

The shell needs first-class state for layout and git context.

### Shell State

Shell state includes:

- current workspace
- left panel open state
- left panel width
- right panel open state
- right panel width
- current route thread id
- recent file hints from the active session

### Git State

Git state includes:

- current workspace cwd
- git root or null
- repo status
- changed file summaries
- selected changed file id
- parsed patch data or raw patch text
- clean state
- non-repo state
- loading state
- failure state

### Session State

Session state remains in the existing session store.

Session state should not be overloaded to carry git truth.

Session state may carry recent touched paths that the shell uses as hints.

## Canonical Visual Structure

The shell should visually match the intentional three-panel model from the reference.

### Desktop

Desktop shows three docked regions.

Collapsed panels still leave the center panel in a coherent layout.

Panel boundaries are clear.

Resize handles are explicit and reliable.

The center panel remains readable at common widths.

### Mobile

Mobile collapses side panels into sheets.

The center panel remains primary.

The composer remains accessible.

The right panel remains reachable through the same conceptual toggle.

## Edge Cases

The canonical implementation must define behavior for the awkward cases.

### No Workspace Chosen Yet

Use the home directory workspace context.

Allow new sessions.

Allow file references relative to that context.

Show git state for that context when available.

### Workspace Outside Git

Show non-repo source-control empty state.

Offer `Init Git`.

Do not fabricate diffs.

### Workspace Inside Git But Clean

Show clean source-control empty state.

Do not show fake counters.

Do not hide the panel entirely if it is explicitly open.

### Session Edits File Outside Git Root

Do not fabricate a right-panel entry.

If the file is outside repo scope, the right panel remains sourced from the repo.

### Multiple Workspaces With Threads

Group threads by workspace folder.

Persist shell layout per workspace.

Keep the active workspace clear in the left rail and top shell context.

## Canonical Implementation Work

The following work must be completed for the UI to be canonical.

### Shell Reconstruction

- [x] Rebuild the app around a single canonical three-slot shell component.
- [x] Remove route-specific shell duplication.
- [x] Move panel state ownership to the shell.
- [x] Implement explicit left and right toggles.
- [x] Implement persisted panel widths and open states.

### Thread Navigation

- [x] Restore session-backed thread summaries in the left rail.
- [x] Implement grouping by workspace folder.
- [x] Implement `New Agent` creation from the left rail.
- [x] Ensure route selection and left-rail selection stay in sync.

### Hero and Chat

- [x] Restore the hero screen as the no-thread center state.
- [x] Keep the bottom composer in active chat at all times.
- [x] Keep transcript tool cards inline.
- [x] Ensure panel toggles exist in both hero and chat states.

### Git Context Panel

- [x] Remove sample diffs and fake counts.
- [x] Add desktop git inspection support.
- [x] Add web-side git store and hooks.
- [x] Render changed files from git state.
- [x] Render patches with `@pierre/diffs`.
- [x] Implement clean, non-repo, loading, and failure states.
- [x] Implement `Init Git`.
- [ ] Implement auto-open and auto-select from session file-change hints.

### Overlay Cleanup

- [x] Move provider auth dialog ownership to the shell level.
- [x] Keep settings dialog at the shell level.
- [x] Ensure mobile side panels use sheet semantics.
- [x] Remove duplicated overlay ownership from hero and chat subtrees.

### Contracts and Stores

- [x] Extend shared contracts for git data.
- [x] Extend preload and desktop services.
- [x] Add a web store or hook for git state.
- [x] Keep session and git state separate.

### QA and Verification

- [x] Verify left rail toggle behavior.
- [x] Verify right panel toggle behavior.
- [x] Verify hero screen presence.
- [x] Verify active-thread composer presence.
- [x] Verify thread updates while streaming.
- [x] Verify clean repo behavior.
- [x] Verify non-repo `Init Git` behavior.
- [ ] Verify auto-selection after edits.
- [x] Verify grouped threads across multiple workspaces.
- [x] Verify desktop persistence of panel widths and open states.

## Definition of Done

This work is done only when all of the following are true.

- [x] The app always renders as a coherent three-panel shell.
- [x] The left rail shows `New Agent` and grouped sessions (threads).
- [x] The left rail is session-backed and workspace-aware.
- [x] The hero state is restored and intentional.
- [x] The active-thread state always includes the composer.
- [x] The right panel is git-backed.
- [x] The right panel never shows fake sample diffs.
- [x] The right panel supports clean, dirty, and non-repo states.
- [x] The right panel supports `Init Git`.
- [x] Both side panels have explicit toggles.
- [x] Both side panels persist size and open state.
- [x] Overlay ownership is centralized and non-duplicated.
- [x] Route transitions do not destroy shell coherence.
- [x] The app behaves like a standalone desktop tool even before the user picks a folder.

## Implementation Notes

- [x] The old `GlassWorkbench` fake shell state is removed; canonical shell owns layout.
- [x] The three-slot layout is implemented in the canonical app shell (component props for left, center, right).
- [x] The sample diff implementation is deleted rather than adapted.
- [x] Sidebar session data flow is reattached to the canonical shell instead of route-local duplication.
- [x] Thread grouping is built into the sidebar view-model instead of bolted on in rendering only.
- [x] Panel toggles and overlay ownership are treated as architectural concerns in the shell.

## UI Todos

- [x] Rebuild the app around a single canonical three-slot shell using component props for left, center, and right content.
- [x] Restore a persistent left rail with explicit open and collapse toggle in the shell header.
- [x] Restore a persistent right git context panel with explicit open and collapse toggle in the shell header.
- [x] Add reliable desktop resize handles for both side panels.
- [x] Persist left panel width per workspace.
- [x] Persist right panel width per workspace.
- [x] Persist left panel open or collapsed state per workspace.
- [x] Persist right panel open or collapsed state per workspace.
- [x] Restore the hero screen as the canonical center state when no thread is selected.
- [x] Preserve the active chat screen as the canonical center state when a thread is selected.
- [x] Ensure the bottom composer is always present in the active chat state.
- [x] Ensure the hero composer and quick actions match the intended centered shell composition.
- [x] Remove the fake empty placeholder center state that replaced the hero screen.
- [x] Restore `New Agent` in the left rail.
- [x] Restore the session list in the left rail.
- [x] Render threads grouped by workspace folder in the left rail.
- [x] Clearly indicate the active thread in the left rail.
- [x] Keep the left rail usable when the app starts in the default home-directory workspace.
- [x] Design a clean empty source-control state for git repositories with no changes.
- [x] Design a non-repo source-control state with an `Init Git` call to action.
- [x] Render changed files in the right panel with real git statuses and counts.
- [x] Render the selected file diff in the right panel using `@pierre/diffs`.
- [x] Keep the right panel usable on the hero screen, including empty and non-repo states.
- [x] Ensure transcript tool cards remain inline transcript elements rather than becoming shell panels.
- [x] Move provider authentication UI to a shell-level overlay owner.
- [x] Keep settings as a shell-level overlay.
- [x] Convert left and right panels to mobile sheets while preserving the same shell model.
- [x] Ensure desktop panel collapse uses layout width changes rather than fake overlays.
- [x] Verify the shell remains visually coherent with left collapsed, right collapsed, both open, and both collapsed.

## Logic Todos

- [x] Make the canonical shell the single owner of panel visibility state.
- [x] Make the canonical shell the single owner of panel size state.
- [x] Remove route-local shell duplication and stop letting routes construct their own side panels.
- [x] Reconnect the left rail to the session summary flow used by the old sidebar wiring.
- [x] Keep session summaries live while threads stream, rename, or get created.
- [x] Build a workspace-grouped thread view-model instead of a flat session-id list.
- [x] Define the default workspace context as the user home directory when no explicit workspace has been chosen.
- [x] Ensure new sessions are created in the current workspace context.
- [x] Ensure selecting a thread updates routing and shell selection consistently.
- [x] Add canonical contracts for git inspection to the shared contract layer.
- [x] Extend preload so the web app can query git state through Electron.
- [x] Add a desktop-side git service keyed by workspace `cwd`.
- [x] Detect whether the current workspace is inside a git repository.
- [x] Detect the effective git root for the current workspace when present.
- [x] Expose a command to initialize git for a non-repo workspace.
- [x] Expose changed-file summaries from git including modified, staged, deleted, renamed, and untracked files.
- [x] Define the right-panel counter as combined workspace git truth rather than transcript-derived counts.
- [x] Expose raw patch text or equivalent normalized patch payloads from the desktop git layer.
- [x] Parse git patch data with `parsePatchFiles` from `@pierre/diffs` instead of sample metadata.
- [x] Delete `createSampleDiff()` and all fake diff-derived shell state.
- [x] Add a dedicated web-side git store or hook separate from the session store.
- [x] Keep session state and git state separate.
- [ ] Use session tool activity only as a hint for right-panel auto-open and file selection.
- [ ] Capture recent touched file paths from `edit` and `write` tool activity.
- [ ] Auto-open the right panel when the active session changes files and the user has not intentionally suppressed it.
- [ ] Auto-select the matching changed file when a recent touched path exists in the git file list.
- [ ] Avoid synthetic right-panel entries when touched files do not appear in git state.
- [x] Refresh git state when the workspace changes.
- [ ] Refresh git state when relevant file-changing session activity completes.
- [x] Refresh git state when the app window regains focus.
- [x] Preserve selected diff file when the file still exists across refreshes.
- [x] Fallback to a sensible default selection when the previous selected file disappears.
- [x] Keep right-panel behavior correct in clean repos.
- [x] Keep right-panel behavior correct in non-repo workspaces.
- [ ] Keep right-panel behavior correct when edits happen outside the current git root.
- [x] Centralize provider authentication overlay ownership so it is not duplicated in both hero and chat trees.
- [x] Ensure mobile left and right sheets obey the same shell state model as desktop panels.
- [x] Verify route transitions do not destroy shell-level state unnecessarily.
- [x] Verify the final implementation passes `pnpm run fmt`, `pnpm run lint`, and `pnpm run typecheck`.
