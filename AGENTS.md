# [AGENTS.md](http://AGENTS.md)

## Icon Library

Use `central-icons` for all icons. It is installed as an alias for `@central-icons-react/round-outlined-radius-2-stroke-1.5`. Import icons from the package directly:

```ts
import { IconHome } from "central-icons";
```

Do not use `lucide-react` or any other icon library.

## Web app layout (`apps/web`)

Structural reference: [t3code](https://github.com/pingdotgg/t3code) (folder boundaries only, not its UI).

- **Primitives**: `src/components/ui/` (Button, Input, Switch, Dialog, …).
- **Feature / product UI**: `src/components/<domain>/` (e.g. `glass/`, `settings/`).
- **App wiring**: `src/hooks/`, `src/lib/`, `src/routes/`.
- **Workspace packages**: `packages/contracts`, `packages/shared` — types and non-UI helpers only; **do not** add `packages/ui` unless multiple apps must share compiled UI.

Imports:

- Primitives: `~/components/ui/...`.
- Dependency direction: domain code imports primitives; primitives do not import feature layers.

### Canonical naming (Glass runtime)

The renderer and shared IPC types use **Glass**, **thread**, and **harness** vocabulary (`@glass/contracts`: `GlassSessionSnapshot`, `ThreadSummary`, `HarnessKind`, …). Do not prefix shared UI or cross-package DTOs with `pi-` unless the value is strictly Pi-adapter internals. Pi subprocess code lives under `apps/desktop` adapter paths (e.g. `pi-runtime/`); the web app imports `thread-session-store`, `chat-composer`, `use-runtime-session`, and `runtime-models` — not `pi-session-store` / `pi-composer` for product chrome.

### Tailwind CSS

Keep utility strings where the editor Tailwind extension can see them: **inline** on the element as `className={cn("…", "…", className)}` (multiple string-literal arguments for logical groups), not long module-level `const` blobs. Same pattern as `apps/web/src/components/glass/settings-nav-rail.tsx` (`activeProps` / `inactiveProps`). That preserves autocomplete, lint, and hover for class names.

## Package roles

Aligned with [t3code](https://github.com/pingdotgg/t3code) package boundaries (adapted for Glass):

- `apps/server`: Node.js HTTP + WebSocket server. Wraps Codex `app-server` (JSON-RPC over stdio) for Codex sessions, serves the web app, and runs orchestration, persistence, and provider adapters.
- `apps/web`: React/Vite UI. Owns session UX, conversation rendering, and client state. Talks to the server over WebSocket RPC (`apps/web/src/wsRpcClient.ts`, `wsNativeApi.ts`).
- `apps/desktop`: Electron shell (loads the renderer and native integrations).
- `packages/contracts`: Shared Effect schemas and TypeScript contracts for orchestration, RPC method names, provider events, and session types. Keep this package schema- and types-first — no ad-hoc business logic.
- `packages/shared`: Shared runtime utilities used by server, web, or desktop.

## Codex app server

Glass is Codex-oriented for the Codex provider: the server spawns `codex app-server` (JSON-RPC over stdio) per Codex-backed session and folds provider output into orchestration.

How it shows up in this repo:

- Session lifecycle and Codex child management: `apps/server/src/codexAppServerManager.ts`; spawn/initialize helpers: `apps/server/src/provider/codexAppServer.ts`.
- Provider wiring and adapters: `apps/server/src/provider/` (e.g. `Layers/ProviderService`, `Layers/CodexAdapter`).
- WebSocket RPC surface (orchestration and related methods): `apps/server/src/ws.ts` (routes line up with `ORCHESTRATION_WS_METHODS` in `@glass/contracts`).
- Web client: `apps/web/src/wsRpcClient.ts` and `wsNativeApi.ts` — use `orchestration.onDomainEvent` for live orchestration stream updates (and snapshot/replay APIs as needed).

Docs: [Codex App Server (OpenAI)](https://developers.openai.com/codex/sdk/#app-server).

Reference repos (implementation and protocol patterns): [openai/codex](https://github.com/openai/codex), [Dimillian/CodexMonitor](https://github.com/Dimillian/CodexMonitor).

## Task Completion Requirements

- All of `pnpm run fmt`, `pnpm run lint`, and `pnpm run typecheck` must pass before considering tasks completed.
- NEVER run `pnpm test`. Always use `pnpm run test` (runs Vitest via Turbo).

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable.
- Avoid try/catch where possible.
- Avoid using the `any` type.
- Prefer single word variable names where possible.
- Use **Node** APIs for tooling and scripts (`node:fs`, `node:fs/promises`); Bun is not the package manager or runtime for this repo.
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
const journal = JSON.parse(await readFile(path.join(dir, "journal.json"), "utf8"));

// Bad
const journalPath = path.join(dir, "journal.json");
const journal = JSON.parse(await readFile(journalPath, "utf8"));
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

## Cursor Cloud specific instructions

### Environment

- Requires Node.js `^24.13.1` (see `engines` in root `package.json`). Install via `nvm install 24`.
- Package manager is `pnpm@10.33.0` (managed by corepack).

### Key commands

All commands are in root `package.json`. Highlights:

- `pnpm run build:contracts` -- must run before dev/test/typecheck (turbo `dependsOn` handles this automatically for `dev` and `test` tasks).
- `pnpm run dev:web` -- starts Vite dev server on port 5733.
- `pnpm run dev` -- starts full dev mode (desktop + web via turbo).
- `pnpm run lint` -- oxlint.
- `pnpm run fmt` -- oxfmt.
- `pnpm run typecheck` -- tsc across all packages.
- `pnpm run test` -- vitest via turbo.
