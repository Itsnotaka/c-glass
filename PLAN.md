# Glass App — Extraction Plan & First-Page UI Alignment

## North star

Ship a **coherent Glass application surface**: a dark, minimal desktop shell (sidebar, canvas, native titlebar affordances) with **Pi-backed chat** as the primary interaction, while preserving the Electron host and the `contracts` / `shared` boundaries.

**Milestone 1 (this document’s focus)** is **full UI alignment on the first page** — the experience users see at `/` with no thread selected: quiet canvas, centered composer, quick actions, and sidebar chrome that match the Cursor Glass reference shape. Deeper parity (thread chrome, settings-as-dialog, marketplace) follows in later milestones.

---

## What “Glass app” means

| Layer            | Role                                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Glass shell**  | Layout, navigation, tokens, Electron-specific chrome (traffic-light spacer, drag regions, update controls).                                                 |
| **Glass chat**   | Pi-backed session UI: messages, composer, provider key flow, and host snapshots/events. No embedded Lit `ChatPanel` from pi-web-ui — React components only. |
| **Desktop host** | Electron main owns Pi config, session lifecycle, and shell actions. The renderer stays read-only over `window.glass` snapshots and events.                  |

The **Glass app** is the product-facing combination of shell + chat. **Extraction** means making that combination **identifiable, ownable, and eventually isolatable** inside the monorepo without rewriting the harness.

---

## Extraction strategy

### Current state

Glass lives under `apps/web/src/components/glass/`, with styles in `apps/web/src/glass.css`, routes under `apps/web/src/routes/_chat*.tsx`, and layout wired through `AppSidebarLayout`, `GlassShellContext`, and related providers. The web app still carries legacy UI (e.g. Codex `ChatView`, full settings routes) alongside Glass.

### Target boundaries (incremental)

1. **Ownership**
   - **Glass-owned**: everything under `components/glass/`, `glass.css`, `_chat` route tree, and small adapters (`lib/pi-*.ts`, `host.ts`, and bridge-only entry paths).
   - **Shared**: `@glass/contracts`, `@glass/shared`, TanStack Router root, global providers (toast, query client).
   - **Harness / legacy**: remain in `apps/web` until explicitly retired; Glass paths must not depend on them for shell rendering.

2. **Physical extraction (later, optional)**
   - **Phase A — logical module**: enforce imports so `components/glass/**` only depends on shared packages, `lib/pi-*`, bridge helpers, and UI primitives — not on legacy sidebar implementations or removed Codex-only components.
   - **Phase B — package (when stable)**: move Glass UI to something like `packages/glass-ui` (presentational + shell) or `apps/glass-shell` (route slice only), with `apps/web` as a thin host that mounts Glass routes and shared providers. **Do not** block Milestone 1 on this split; use it to prevent entanglement.

3. **Router contract**
   - Treat `/_chat/` (index) and `/_chat/$threadId` as the **Glass primary surface**. Other routes (`/settings/*`, etc.) are secondary until unified into Glass patterns (e.g. settings dialog).

4. **Styling contract**
   - Single source of shell tokens: `glass.css` + theme variables; avoid one-off “t3-code” marketing or legacy chat styles bleeding into Glass routes.

### Extraction checklist (ongoing)

- [ ] No imports from `ChatView`, legacy `Sidebar` (non-Glass), or Codex-only panels inside `components/glass/**`.
- [ ] Glass routes render without loading legacy chat bundles (verify code-splitting / lazy boundaries when legacy is removed).
- [ ] Documented list of **Glass public entry components** (e.g. `GlassSidebar`, `GlassEmptyCanvas`, `GlassChatSession`) vs internal pieces.
- [ ] Optional: `packages/glass-ui` with explicit exports (no barrel file per AGENTS.md — use subpath exports if extracted).

---

## Milestone 1 — Full UI alignment on the first page

**Scope:** `/` (chat index, no `threadId`): the **empty agent** state — not the thread view.

### Reference shape (product)

Align with the Cursor Glass–style shell:

1. **Left sidebar** — `New Agent`, `Marketplace`, grouped agent list (collapsible sections), dense rows with status and recency.
2. **Center** — large, quiet canvas; **no** full-height empty message scroller masquerading as the hero; primary focus is the **centered composer block**.
3. **Composer** — primary card, inline toolbar (model affordance, attach, send/stop), placeholders and density consistent with the reference.
4. **Below composer** — two **quick actions** (e.g. plan-oriented prompt, open workspace in editor).
5. **Top chrome (desktop)** — native titlebar behavior: drag region, traffic-light spacer on macOS, workspace label / picker in the title strip.
6. **Overall** — minimal chrome, generous whitespace, no obvious browser-app framing.

### Engineering acceptance criteria

| Area                | Done when                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Empty vs thread** | Index route uses a **hero layout** (centered composer + quick actions). Thread route uses **conversation layout** (scrollable transcript, composer docked bottom, optional top bar for title/context). |
| **Composer**        | Hero and dock variants share one implementation with clear props; send/stop behavior and disabled states are consistent.                                                                               |
| **Quick actions**   | Wired to real affordances: e.g. prefill composer with a planning prompt; `window.glass.shell.openInEditor` with workspace cwd when available.                                                          |
| **Sidebar footer**  | Update pill, check-for-update, settings entry — aligned with Glass visuals; settings opens via **Glass-appropriate** UX (dialog or dedicated route — pick one product-wide).                           |
| **Marketplace**     | Placeholder acceptable for M1 if visually consistent with shell; no broken layout.                                                                                                                     |
| **A11y / focus**    | Composer is focusable and keyboard-send works; quick actions and sidebar items have labels.                                                                                                            |

### Primary files (living map)

- Routes: `apps/web/src/routes/_chat.index.tsx`, `_chat.$threadId.tsx`
- Shell: `AppSidebarLayout.tsx`, `GlassShell.tsx`, `GlassShellContext.tsx`
- Canvas: `GlassEmptyCanvas.tsx`, `glass-chat-session.tsx`, `glass-pi-composer.tsx`, `glass-pi-messages.tsx`
- Sidebar: `GlassSidebar*.tsx`, `GlassAgentList` / row components
- Styles: `glass.css`, global theme in `index.css` as needed

---

## Milestone 2+ (brief)

- **Thread view parity:** content top bar (title, workspace, overflow), message styling polish, composer footer (usage / model line) as needed.
- **Settings:** single Glass pattern (dialog vs full-page) and desktop menu integration.
- **Marketplace:** real content or structured placeholder per product roadmap.
- **Package extraction:** Phase B above when M1–M2 are stable.

---

## Non-goals (unchanged in spirit)

- Rebuilding the full VS Code workbench or Cursor’s private services.
- Reintroducing a separate server/WebSocket orchestration layer for the canonical desktop runtime.
- Perfect pixel parity with proprietary Cursor builds — **shape and behavior** are the target.

---

## Pi & reference (concise)

- Runtime: Pi-on-disk via `SessionManager` in `@mariozechner/pi-coding-agent`, with live `AgentSession` ownership in Electron main and renderer reads over the `window.glass` bridge.
- Optional local clone: `.pi-mono-reference/` (gitignored) for reading only.

---

## Why this order

**Extraction** reduces merge cost and clarifies ownership as the shell grows. **First-page alignment** is the highest-leverage user-visible milestone: it validates tokens, layout, and composer ergonomics before investing in every secondary surface. Ship the empty canvas + sidebar story first; thread and settings parity follow naturally.
