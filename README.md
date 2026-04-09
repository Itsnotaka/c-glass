# Glass Monorepo

> **Glass** is a desktop and web runtime for AI coding sessions: orchestration, provider adapters (including OpenAI Codex `app-server`), and a React UI that talks to the stack over WebSocket RPC.

Glass is **based on [t3code](https://github.com/pingdotgg/t3code)** (T3 Code / pingdotgg): same monorepo layout—app and package boundaries, Turborepo wiring—with a Glass product layer (**Glass**, **thread**, **harness** in `@glass/contracts`, orchestration, desktop packaging).

It is a [pnpm](https://pnpm.io/) workspace (Turborepo).

## Packages

| Package                                    | Description                                                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [**@glass/server**](apps/server)           | Node.js HTTP + WebSocket server: orchestration, persistence, Codex and other provider adapters, static web bundle. Publishes the `glass-server` CLI. |
| [**@glass/web**](apps/web)                 | React / Vite UI: session UX, conversation rendering, client state; connects via `ws-rpc-client` and orchestration events.                            |
| [**@glass/desktop**](apps/desktop)         | Electron shell that loads the renderer and native integrations.                                                                                      |
| [**@glass/contracts**](packages/contracts) | Shared Effect schemas and TypeScript contracts: orchestration, RPC method names, provider events, session types.                                     |
| [**@glass/shared**](packages/shared)       | Shared runtime utilities for server, web, and desktop.                                                                                               |

## Requirements

- **Node.js** `^24.13.1` (see root `package.json` `engines`)
- **pnpm** `10.33.0` via [Corepack](https://nodejs.org/api/corepack.html): `corepack enable` then `corepack prepare pnpm@10.33.0 --activate`

## Git remotes (fork + upstream)

GitHub Flow expects **`origin` = your fork** (where you push) and **`upstream` = the parent repo** (where you pull changes from). That naming is standard in Git and in guides like **[How to move to a fork after cloning](https://gist.github.com/ElectricRCAircraftGuy/8ca9c04924ac11a50d48c2061d28b090)**.

Here the parent is **[pingdotgg/t3code](https://github.com/pingdotgg/t3code)**. Your fork is typically **[Itsnotaka/c-glass](https://github.com/Itsnotaka/c-glass)** (or another name under your account that GitHub shows as forked from t3code).

| Remote       | Points at                         | Role |
| ------------ | --------------------------------- | ---- |
| **`origin`** | `YOUR_USER/c-glass` (your fork)   | Default push target (`git push`). |
| **`upstream`** | `pingdotgg/t3code`              | Fetch and merge/rebase (`git fetch upstream`, merge `upstream/main`). Do not push here. |

### GitHub CLI (preferred)

With [GitHub CLI](https://cli.github.com/) installed and authenticated (`gh auth login`):

- If you cloned **pingdotgg/t3code** first and only then want a fork, run **`gh repo fork`** from that clone. It can create the fork on GitHub and wire **`origin`** to your fork and **`upstream`** to the original. See **[`gh repo fork`](https://cli.github.com/manual/gh_repo_fork)** (flags like `--remote` control remotes).

- If **`origin`** already points at your fork but **`upstream`** is missing:

  ```bash
  git remote add upstream https://github.com/pingdotgg/t3code.git
  git fetch upstream
  ```

### Manual setup (no `gh`)

Follow the gist: fork on GitHub, then **`git remote rename origin upstream`**, **`git remote add origin`** with your fork URL, **`git fetch origin`**, and **`git branch --set-upstream-to origin/main main`** (use your default branch name). Shortcut from the same thread: **`git remote set-url origin`** to your fork and **`git remote add upstream`** to the parent.

Optional: **`git remote set-url --push upstream no_push`** so a mistaken **`git push upstream`** fails.

### Contributing back to t3code

Push branches to **`origin`** and open pull requests **your fork → pingdotgg/t3code** on GitHub. Sync from the parent with **`git fetch upstream`** and merge or rebase onto **`upstream/main`** before sending PRs.

## Development

```bash
pnpm install
pnpm run build:contracts   # contracts build; turbo depends on this for dev/build elsewhere
pnpm run dev               # full dev (orchestrated dev runner)
pnpm run dev:web           # Vite only (port 5733)
pnpm run dev:server        # server package dev
pnpm run dev:desktop       # desktop shell dev
```

Quality gates (run before shipping changes):

```bash
pnpm run fmt
pnpm run lint
pnpm run typecheck
pnpm run test
```

Agent- and contributor-oriented rules (icons, Tailwind, naming, package roles, Codex app-server pointers) live in **[AGENTS.md](AGENTS.md)**.

## Desktop release

Tagged releases build desktop artifacts and publish a GitHub Release (see [.github/workflows/release.yml](.github/workflows/release.yml)). Pushing a tag matching `v*.*.*` triggers the workflow; you can also run it manually with a version string.

## License

MIT (see published packages such as `@glass/server` in each `package.json` where applicable).
