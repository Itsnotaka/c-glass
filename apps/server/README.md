# @glass/server

Glass's server layer. Runs orchestration, manages provider sessions (Codex, Claude), and exposes the WebSocket RPC surface the renderer connects to. Also published as the standalone `glass-server` CLI.

## Entry points

- `src/bin.ts` — CLI entry; bootstraps the Effect runtime and starts the server
- `src/server.ts` — HTTP server setup
- `src/ws.ts` — WebSocket RPC routes; methods map to `ORCHESTRATION_WS_METHODS` from `@glass/contracts`
- `src/codexAppServerManager.ts` — lifecycle for Codex `app-server` child processes (spawn, initialize, teardown)
- `src/provider/` — provider adapter layer:
  - `Layers/ProviderService.ts` — Effect layer wiring
  - `Layers/CodexAdapter.ts` / `Layers/ClaudeAdapter.ts` — provider-specific adapters
  - `Services/ProviderAdapter.ts` — adapter interface
- `src/orchestration/` — orchestration domain (session state, event projection)
- `src/persistence/` — session and thread persistence
- `src/bootstrap.ts` — server Effect layer composition

## Architecture

```
renderer ──WS──▶ ws.ts ──▶ orchestration/ ──▶ provider/Layers/ ──▶ Codex app-server (stdio)
                                                              └──▶ Claude SDK
```

The server spawns one Codex `app-server` process per Codex-backed session over JSON-RPC stdio, projects provider output into orchestration domain events, and pushes them to the renderer via WebSocket push on `orchestration.domainEvent`.

## Development

```bash
pnpm run dev   # from repo root (includes server via dev-runner)
```

The `glass-server` binary is published from this package (`bin.glass-server → dist/bin.mjs`).
