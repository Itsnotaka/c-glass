# AGENTS.md

## Task Completion Requirements

- All of `bun fmt`, `bun lint`, and `bun typecheck` must pass before considering tasks completed.
- NEVER run `bun test`. Always use `bun run test` (runs Vitest).

## Project Snapshot

T3 Code is a minimal web GUI for using coding agents like Codex and Claude.

This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## File naming

Use **kebab-case** for new file names (e.g. `glass-composer-card.tsx`, `use-glass-agents.ts`, `thread-meta.ts`). Older files may use PascalCase or other styles; prefer kebab-case when adding or renaming files.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable.
- Avoid try/catch where possible.
- Avoid using the `any` type.
- Prefer single word variable names where possible.
- Use Bun APIs when possible, like `Bun.file()`.
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity.
- Prefer functional array methods (`flatMap`, `filter`, `map`) over `for` loops; use type guards on `filter` to maintain type inference downstream.

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

#### Naming Enforcement (Read This)

**THIS RULE IS MANDATORY FOR AGENT WRITTEN CODE.**

- Use single word names by default for new locals, params, and helper functions.
- Multi-word names are allowed only when a single word would be unclear or ambiguous.
- Do not introduce new camelCase compounds when a short single-word alternative is clear.
- Before finishing edits, review touched lines and shorten newly introduced identifiers where possible.

Good short names to prefer: `pid`, `cfg`, `err`, `opts`, `dir`, `root`, `child`, `state`, `timeout`.

Examples to avoid unless truly required: `inputPID`, `existingClient`, `connectTimeout`, `workerPath`.

```ts
// Good
const foo = 1;
function journal(dir: string) {}

// Bad
const fooBar = 1;
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json();

// Bad
const journalPath = path.join(dir, "journal.json");
const journal = await Bun.file(journalPath).json();
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a;
obj.b;

// Bad
const { a, b } = obj;
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2;

// Bad
let foo;
if (condition) foo = 1;
else foo = 2;
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1;
  return 2;
}

// Bad
function foo() {
  if (condition) return 1;
  else return 2;
}
```

### Schema Definitions (Drizzle)

Use `snake_case` for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
});

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
});
```

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Package Roles

- `apps/server`: Node.js WebSocket server. Wraps Codex app-server (JSON-RPC over stdio), serves the React web app, and manages provider sessions.
- `apps/web`: React/Vite UI. Owns session UX, conversation/event rendering, and client-side state. Connects to the server via WebSocket.
- `packages/contracts`: Shared effect/Schema schemas and TypeScript contracts for provider events, WebSocket protocol, and model/session types. Keep this package schema-only — no runtime logic.
- `packages/shared`: Shared runtime utilities consumed by both server and web. Uses explicit subpath exports (e.g. `@glass/shared/git`) — no barrel index.

## Codex App Server (Important)

T3 Code is currently Codex-first. The server starts `codex app-server` (JSON-RPC over stdio) per provider session, then streams structured events to the browser through WebSocket push messages.

How we use it in this codebase:

- Session startup/resume and turn lifecycle are brokered in `apps/server/src/codexAppServerManager.ts`.
- Provider dispatch and thread event logging are coordinated in `apps/server/src/providerManager.ts`.
- WebSocket server routes NativeApi methods in `apps/server/src/wsServer.ts`.
- Web app consumes orchestration domain events via WebSocket push on channel `orchestration.domainEvent` (provider runtime activity is projected into orchestration events server-side).

Docs:

- Codex App Server docs: https://developers.openai.com/codex/sdk/#app-server

## Reference Repos

- Open-source Codex repo: https://github.com/openai/codex
- Codex-Monitor (Tauri, feature-complete, strong reference implementation): https://github.com/Dimillian/CodexMonitor

Use these as implementation references when designing protocol handling, UX flows, and operational safeguards.

## Learned Workspace Facts

- Glass shell UI (sidebar agent list, empty-canvas chat, marketplace placeholder) lives under `apps/web/src/components/glass/`. It is wired via `AppSidebarLayout`, `_chat.index.tsx`, and `_chat.$threadId.tsx`.
- **Pi chat** uses `@mariozechner/pi-agent-core` (`Agent`, `AgentMessage`, `AgentEvent`) and `@mariozechner/pi-ai` (`getModel`) in the renderer. **IndexedDB session** and provider keys use the `@mariozechner/pi-web-ui` **storage** layer (`AppStorage`, `SessionsStore`, etc.) in `src/lib/pi-glass-storage.ts`; **do not** embed the Lit `ChatPanel` from pi-web-ui. Use [`badlogic/pi-mono`](https://github.com/badlogic/pi-mono) `packages/web-ui` as a **reference** for how to wire transport and persistence. Glass UI lives in `glass-chat-session.tsx`, `glass-pi-messages.tsx`, `glass-pi-composer.tsx`, `glass-provider-key-dialog.tsx` with helpers in `src/lib/pi-*.ts`.
- Local doc mirror for pi-mono: clone to `.pi-mono-reference/` (gitignored) and read `README.md` at the repo root.
- For **local / Pi-only** development without the Codex WebSocket server, **`apps/web/src/nativeApi.ts`** uses **`createLocalGlassNativeApi`** (`src/lib/local-native-api.ts`).
- Settings live in a dialog, not a route: `glass-settings-context.tsx` + `glass-settings-dialog.tsx` in `components/glass/`. Footer and desktop menu open it via context — no `/settings` route navigation from Glass shell.
- `glass-hero-canvas.tsx` renders the index route empty state (centered hero composer + quick actions). `use-pi-session.ts` is the shared Pi session initialization hook used by both hero and thread views; duplicate init logic between hero and thread belongs there.
- Desktop build: `bun run dist:desktop:dmg:arm64` builds a macOS ARM64 DMG to `release/`. Auto-updates only activate in packaged builds (`app.isPackaged`). Mock update server: `bun run start:mock-update-server` serves `release-mock/`; `GLASS_DESKTOP_MOCK_UPDATES` env overrides the update feed URL to localhost.
- Font aligned with Cursor: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` (DM Sans removed from `index.html`); `--radius: 0.5rem` (8px). Cursor radius px scale: `xs:2 sm:4 md:6 lg:8 xl:12 2xl:14 3xl:16`.
- Tailwind v4 CSS variable arbitrary values: use `hover:bg-[var(--glass-sidebar-hover)]` (not custom CSS utility classes that define `.hover:bg-*` selectors — Tailwind v4 does not escape those correctly).

## Knip

Root `knip.json` ignores `.pi/**`, `.pi-mono-reference/**`, and `**/dist/**` so `bunx knip` stays usable. Run from the repo root after `bun install`.

## Learned User Preferences

- Align UI with Cursor Glass source: inspect `/Applications/Cursor.app/Contents/Resources/app/` bundle CSS/JS directly for exact tokens, radius values, font stacks, and HTML structure rather than guessing or using t3-code defaults.
- Use CVA for component variants; make `variant` required (not optional `?`) when all call sites always pass it.
- Prefer Glass UI components over t3-code/shadcn defaults; avoid pulling in new shadcn defaults that conflict with Glass shell aesthetics. When a missing Glass-specific component is needed, ask the user before reaching for a generic shadcn widget.
