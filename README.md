# Glass Monorepo

> **Glass** is a desktop and web runtime for AI coding sessions: orchestration, provider adapters (including OpenAI Codex `app-server`), and a React UI that talks to the stack over WebSocket RPC.

This project is **based on [t3code](https://github.com/pingdotgg/t3code)** by pingdotgg: we adopted the same monorepo layout—app and package boundaries, Turborepo wiring—and built the Glass product layer on top (**Glass**, **thread**, **harness** vocabulary in `@glass/contracts`, orchestration, desktop packaging).

It is a [pnpm](https://pnpm.io/) workspace (Turborepo).

## Packages


| Package                                    | Description                                                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[@glass/server](apps/server)**           | Node.js HTTP + WebSocket server: orchestration, persistence, Codex and other provider adapters, static web bundle. Publishes the `glass-server` CLI. |
| **[@glass/web](apps/web)**                 | React / Vite UI: session UX, conversation rendering, client state; connects via `ws-rpc-client` and orchestration events.                            |
| **[@glass/desktop](apps/desktop)**         | Electron shell that loads the renderer and native integrations.                                                                                      |
| **[@glass/contracts](packages/contracts)** | Shared Effect schemas and TypeScript contracts: orchestration, RPC method names, provider events, session types.                                     |
| **[@glass/shared](packages/shared)**       | Shared runtime utilities for server, web, and desktop.                                                                                               |


## Requirements

- **Node.js** `^24.13.1` (see root `package.json` `engines`)
- **pnpm** `10.33.0` via [Corepack](https://nodejs.org/api/corepack.html): `corepack enable` then `corepack prepare pnpm@10.33.0 --activate`

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

Tagged releases build desktop artifacts and publish a GitHub Release (see [.github/workflows/release.yml](.github/workflows/release.yml)). Pushing a tag matching `v*.*.`* triggers the workflow; you can also run it manually with a version string.

## License

MIT (see published packages such as `@glass/server` in each `package.json` where applicable).