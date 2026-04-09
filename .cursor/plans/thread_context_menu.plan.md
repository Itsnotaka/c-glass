---
name: Thread context menu + composer worktree control
overview: Base UI context menu on sidebar thread rows (rename, archive, local unread) wired to orchestration.dispatchCommand; plus a new hero-composer control beside GlassWorkspacePicker for local vs worktree workspace targeting, using the same slash-menu surface styling and existing shell/thread worktree fields.
todos:
  - id: inventory-wiring
    content: Add use-thread-actions (or equivalent) with rename/archive dispatchCommand + navigation mirroring t3 commitRename/archiveThread adapted to Glass routes
    status: pending
  - id: context-menu-ui
    content: Implement Base UI ContextMenu for GlassAgentRow with slash-menu surface classes + central-icons; wire Rename (inline) and Archive; local unread store
    status: pending
  - id: view-model-unread
    content: Plumb unread flag from client store into glass-view-model / row presentation
    status: pending
  - id: composer-worktree-picker
    content: New button next to GlassWorkspacePicker (hero composer) — Base UI Menu with local/project vs worktree options; wire to useShellState + thread worktreePath; optional flow to create/select worktree via existing git/orchestration APIs where product allows
    status: pending
  - id: verify
    content: Run fmt, lint, typecheck
    status: pending
isProject: false
---

# Thread context menu + composer worktree control

## Orchestration / effect layer (reference)

- Client: `readNativeApi().orchestration.dispatchCommand` → WebSocket → `OrchestrationEngine` (Effect).
- Thread commands: `thread.meta.update` (title, …), `thread.archive` / `thread.unarchive`, `thread.delete`, `thread.turn.start` (optional `titleSeed` for first-turn title rules).
- Server-side title generation: `ProviderCommandReactor.maybeGenerateThreadTitleForFirstTurn` + `textGeneration.generateThreadTitle` (not triggered from menus unless we add an explicit action later).

## A. Sidebar — thread context menu

**Scope (unchanged):** Base UI `ContextMenu`, slash-menu chrome (`glass-slash-menu-popup` tokens from [`slash-menu.tsx`](apps/web/src/components/glass/composer/slash-menu.tsx)), actions with existing contracts: Rename (`thread.meta.update`), Archive (`thread.archive`), Mark unread (client-only store; [`glass-view-model`](apps/web/src/lib/glass-view-model.ts) today hardcodes `unread: false`). Omit Pin / Move / Fork until contracts exist.

**Files:** [`row.tsx`](apps/web/src/components/glass/agents/row.tsx), new sidebar context-menu module, optional [`use-thread-actions`](apps/web/src/hooks/use-thread-actions.ts).

## B. Composer hero row — local / worktree picker (new)

**Product:** Add a **new button next to** [`GlassWorkspacePicker`](apps/web/src/components/glass/pickers/workspace.tsx) in the hero composer header ([`chat.tsx`](apps/web/src/components/glass/composer/chat.tsx) ~1159–1174), matching the reference layout (repo/workspace on the left, branch on the right — keep branch pill as today).

**UI:** Base UI [`Menu`](apps/web/src/components/glass/pickers/model.tsx) (same family as existing pickers), popup styling aligned with **slash menu** surfaces (border, `rounded-glass-card`, `bg-glass-bubble`, compact type scale — reuse tokens from [`slash-menu.tsx`](apps/web/src/components/glass/composer/slash-menu.tsx) / [`GlassComposerTokenMenu`](apps/web/src/components/glass/composer/slash-menu.tsx)).

**Behavior — wire to what we already have:**

- [`useShellState`](apps/web/src/hooks/use-shell-cwd.ts) already resolves `cwd` as `thread?.worktreePath ?? project?.cwd ?? null` when a route thread exists. The menu should make the **active target** explicit:
  - **Local / project** — use project workspace root (`project.cwd`) for context when it differs from the thread worktree path (or label “This Mac” / project name if we mirror the mock).
  - **Worktree** — when `thread.worktreePath` is set, select that; when absent, optionally offer “Use worktree…” that flows into existing **git worktree** creation (`NativeApi.git.createWorktree` / server bootstrap on `thread.turn.start` with `prepareWorktree` — only where product allows; may be phased).

**Non-goals for v1 unless trivial:** “Cloud” as a third real backend — can be a disabled row or omitted until remote envs exist.

**Connection to thread context menu:** Same mental model — **where** the agent runs (project vs thread worktree) vs **which** thread (sidebar). No new orchestration command types required for basic “show and stick to worktree path” if we only reflect `thread.meta` and shell state.

## Verification

Run `pnpm run fmt`, `pnpm run lint`, `pnpm run typecheck`.

## Relation to other plans

- Independent from [fix_ask_wiring_01193443.plan.md](fix_ask_wiring_01193443.plan.md) (provider/transcript wiring); can ship on separate branch.
