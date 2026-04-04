# AGENTS.md

## Icon Library

Use `central-icons` for all icons. It is installed as an alias for `@central-icons-react/round-outlined-radius-2-stroke-1.5`. Import icons from the package directly:

```ts
import { IconHome } from "central-icons";
```

Do not use `lucide-react` or any other icon library.

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

## Cursor Cloud specific instructions

### Environment

- Requires Node.js `^24.13.1` (see `engines` in root `package.json`). Install via `nvm install 24`.
- Package manager is `pnpm@10.33.0` (managed by corepack).

### Monorepo structure

| Package | Path | Purpose |
|---------|------|---------|
| `@glass/web` | `apps/web` | React/Vite frontend (renderer UI) |
| `@glass/desktop` | `apps/desktop` | Electron main process |
| `@glass/contracts` | `packages/contracts` | Shared types/schemas (must be built before other packages) |
| `@glass/shared` | `packages/shared` | Shared utilities |
| `@glass/scripts` | `scripts/` | Build/release tooling |

### Key commands

All commands are in root `package.json`. Highlights:

- `pnpm run build:contracts` -- must run before dev/test/typecheck (turbo `dependsOn` handles this automatically for `dev` and `test` tasks).
- `pnpm run dev:web` -- starts Vite dev server on port 5733.
- `pnpm run dev` -- starts full dev mode (desktop + web via turbo).
- `pnpm run lint` -- oxlint.
- `pnpm run fmt` -- oxfmt.
- `pnpm run typecheck` -- tsc across all packages.
- `pnpm run test` -- vitest via turbo (note: `@glass/contracts` has no test files and its `vitest run` exits non-zero; run individual package tests to avoid this).

### Gotchas

- The web app outside Electron will show "Glass bridge not found" errors when actions requiring `window.glass` IPC are triggered. This is expected -- the full app requires Electron.
- `pnpm run test` (turbo) will fail because `@glass/contracts` uses `vitest run` without `--passWithNoTests` and has no test files. Individual package tests all pass.
- No Docker, databases, or external services required. All state is file-based (`~/.glass/`).
