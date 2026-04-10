# Glass

Glass is a desktop application for AI coding sessions: orchestration, provider adapters (Codex, Claude), and a native UI.

> **Install**: download the latest release from [GitHub Releases](https://github.com/itsnotaka/c-glass/releases).

## Monorepo structure

| Package                                    | Role                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **[@glass/desktop](apps/desktop)**         | Electron shell — window, IPC bridge, auto-update, platform packaging                       |
| **[@glass/web](apps/web)**                 | Renderer — React/Vite UI, session UX, conversation rendering                               |
| **[@glass/server](apps/server)**           | Server — orchestration, provider adapters, WebSocket RPC surface                           |
| **[@glass/contracts](packages/contracts)** | Shared Effect schemas and TypeScript types (RPC contracts, session types, provider events) |
| **[@glass/shared](packages/shared)**       | Shared runtime utilities used by server, renderer, and desktop                             |

## Requirements

- **Node.js** `^24.13.1` (install via `nvm install 24`)
- **pnpm** `10.33.0` via [Corepack](https://nodejs.org/api/corepack.html): `corepack enable && corepack prepare pnpm@10.33.0 --activate`

## Development

```bash
pnpm install
pnpm run build:contracts   # required before first dev run
pnpm run dev               # full dev — Electron + renderer + server
pnpm run dev:web           # renderer only (port 5733, browser)
pnpm run dev:desktop       # Electron shell only
```

Quality gates (all must pass before shipping changes):

```bash
pnpm run fmt
pnpm run lint
pnpm run typecheck
pnpm run test
```

## Desktop release

Tagged releases (`v*.*.*`) trigger [`.github/workflows/release.yml`](.github/workflows/release.yml) to build and publish platform installers. Run manually with a version string, or use `pnpm run dist:desktop:artifact`.

## Contributing

Coding rules, package roles, style guide, and agent-specific instructions: see [AGENTS.md](AGENTS.md).

## License

MIT
