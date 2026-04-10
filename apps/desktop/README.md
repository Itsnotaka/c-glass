# @glass/desktop

Glass's Electron shell. Loads the renderer from `@glass/web` and provides native integrations: IPC bridge, auto-update, and platform packaging.

## Entry points

- `src/main.ts` — Electron main process; creates the window, registers IPC handlers, initializes auto-update
- `src/preload.ts` — preload script; exposes a safe IPC bridge to the renderer via `contextBridge`
- `src/updateMachine.ts` / `src/updateState.ts` — auto-update state machine (`electron-updater`)
- `src/syncShellEnvironment.ts` — syncs shell environment variables into the Electron process
- `src/confirmDialog.ts` — native confirm dialog helper
- `scripts/` — dev and release helpers:
  - `dev-electron.mjs` — launches Electron in dev mode after waiting for renderer and server
  - `start-electron.mjs` — starts a production build locally
  - `smoke-test.mjs` — basic smoke test for CI

## Build and release

```bash
pnpm run dev:desktop            # from repo root (Electron + renderer via concurrently)
pnpm run build:desktop          # from repo root (builds web + desktop)
pnpm run dist:desktop:artifact  # from repo root (build + package installer)
```

Tagged releases (`v*.*.*`) trigger [`.github/workflows/release.yml`](../../.github/workflows/release.yml), which builds and publishes platform installers for macOS, Windows, and Linux.
