# @glass/contracts

Shared Effect schemas and TypeScript types. Used by all three layers — server, renderer, and desktop. Contains no runtime business logic.

## Entry points

- `src/orchestration.ts` — `GlassSessionSnapshot`, `ThreadSummary`, `HarnessKind`, orchestration WS method names (`ORCHESTRATION_WS_METHODS`)
- `src/thread.ts` — `ThreadId` and thread-level types
- `src/session.ts` — session lifecycle schemas
- `src/provider.ts` / `src/providerRuntime.ts` / `src/providerNotice.ts` — provider event schemas and runtime types
- `src/rpc.ts` — WebSocket RPC method contracts
- `src/ipc.ts` — Electron IPC channel contracts
- `src/harness.ts` — `HarnessKind` and harness config schemas
- `src/model.ts` — model and provider identity types
- `src/settings.ts` — settings schemas
- `src/index.ts` — barrel export

## Design rule

Schema- and types-first: no business logic, no side effects. Every module must be importable from server, renderer, or desktop without pulling in environment-specific dependencies.

## Build

```bash
pnpm run build:contracts   # from repo root; required before dev/test/typecheck
```
