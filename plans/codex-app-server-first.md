# Codex App-Server First Migration

## Goal

Glass is moving to a Codex app-server-first architecture.

`pingdotgg/t3code` is now the source of truth for:

1. file names
2. package boundaries
3. contracts
4. runtime flow
5. type inference patterns
6. WebSocket and orchestration flow

The rule for this migration is simple:

1. prefer copying the `t3code` files and structure exactly
2. keep Glass product naming for now
3. only change package scope, product strings, and Glass-specific branding where required
4. delete Pi-era runtime code instead of adapting it forward
5. keep the existing Glass UI and wire it to the new logic instead of rebasing to `t3code` styling

Source repo inspected: `.pi/codebases/cb-mnp3ntmq-7bxs`

## Naming Rule

1. Keep `Glass` naming in product-facing code for now.
2. Keep upstream `t3code` file names and architecture where possible.
3. Do not adopt `@t3tools/*`, `T3 Code`, or other product-specific upstream names.
4. When an upstream type or file uses generic provider or orchestration naming, keep it.
5. When a name is product vocabulary, translate it to Glass vocabulary.
6. Keep the current Glass UI component names, props, and styling unless a logic adapter requires a narrow change.

## Current Findings

1. `c-glass` has no `apps/server` yet. Runtime orchestration still lives in `apps/desktop/src/main.ts` and Pi-specific desktop files.
2. The current desktop runtime is Pi-first: `apps/desktop/src/pi-config-service.ts`, `apps/desktop/src/pi-imports.ts`, `apps/desktop/src/cursor-provider.ts`, and `apps/desktop/src/pi-runtime/*`.
3. The current web app is still bridged through `window.glass` and Electron IPC via `apps/web/src/host.ts`, `packages/contracts/src/ipc.ts`, and Pi/session/thread contracts.
4. There is already a split between old dead Pi renderer files and newer runtime-thread files. The dead Pi renderer files can be removed now without waiting for the server migration.
5. `t3code` centers the runtime in `apps/server/src/codexAppServerManager.ts`, `apps/server/src/provider/Layers/CodexAdapter.ts`, `apps/server/src/provider/Layers/ProviderService.ts`, and `apps/server/src/ws.ts`, with the web app consuming server-pushed orchestration events over WebSocket.
6. `t3code` desktop is thin. It boots the backend, exposes `desktopBridge`, and does not own provider runtime logic.

## Exact Upstream Files To Use As Source Of Truth

### Contracts

Copy these from `t3code` and use them as the new canonical contract set under `packages/contracts/src/`:

1. `baseSchemas.ts`
2. `editor.ts`
3. `git.ts`
4. `index.ts`
5. `ipc.ts`
6. `keybindings.ts`
7. `model.ts`
8. `orchestration.ts`
9. `project.ts`
10. `provider.ts`
11. `providerRuntime.ts`
12. `rpc.ts`
13. `server.ts`
14. `settings.ts`
15. `terminal.ts`

These replace the Pi-era contract center of gravity in:

1. `packages/contracts/src/pi.ts`
2. `packages/contracts/src/session.ts`
3. `packages/contracts/src/thread.ts`
4. parts of `packages/contracts/src/harness.ts`
5. parts of `packages/contracts/src/ipc.ts`

### Server

Create `apps/server` from `t3code` and keep the file names intact.

Start with these exact files:

1. `apps/server/package.json`
2. `apps/server/src/bin.ts`
3. `apps/server/src/cli.ts`
4. `apps/server/src/bootstrap.ts`
5. `apps/server/src/server.ts`
6. `apps/server/src/http.ts`
7. `apps/server/src/ws.ts`
8. `apps/server/src/codexAppServerManager.ts`
9. `apps/server/src/config.ts`
10. `apps/server/src/serverSettings.ts`
11. `apps/server/src/serverLifecycleEvents.ts`
12. `apps/server/src/serverRuntimeStartup.ts`
13. `apps/server/src/open.ts`
14. `apps/server/src/processRunner.ts`
15. `apps/server/src/attachmentStore.ts`
16. `apps/server/src/attachmentPaths.ts`
17. `apps/server/src/imageMime.ts`
18. `apps/server/src/keybindings.ts`

Then copy these directories intact:

1. `apps/server/src/provider/`
2. `apps/server/src/orchestration/`
3. `apps/server/src/checkpointing/`
4. `apps/server/src/persistence/`
5. `apps/server/src/observability/`
6. `apps/server/src/git/`
7. `apps/server/src/terminal/`
8. `apps/server/src/workspace/`
9. `apps/server/src/project/`
10. `apps/server/src/telemetry/`

The first server files that matter most for Glass are:

1. `apps/server/src/codexAppServerManager.ts`
2. `apps/server/src/provider/Layers/CodexAdapter.ts`
3. `apps/server/src/provider/Layers/ClaudeAdapter.ts`
4. `apps/server/src/provider/Layers/ClaudeProvider.ts`
5. `apps/server/src/provider/Layers/ProviderService.ts`
6. `apps/server/src/provider/Layers/ProviderSessionDirectory.ts`
7. `apps/server/src/provider/Layers/ProviderRegistry.ts`
8. `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts`
9. `apps/server/src/orchestration/Layers/ProviderCommandReactor.ts`
10. `apps/server/src/orchestration/Layers/ProjectionPipeline.ts`
11. `apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.ts`
12. `apps/server/src/orchestration/Layers/OrchestrationEngine.ts`
13. `apps/server/src/ws.ts`

### Desktop

Rebase `apps/desktop` to the thin `t3code` shape.

Use these files as the target:

1. `apps/desktop/package.json`
2. `apps/desktop/src/main.ts`
3. `apps/desktop/src/preload.ts`
4. `apps/desktop/src/confirmDialog.ts`
5. `apps/desktop/src/runtimeArch.ts`
6. `apps/desktop/src/syncShellEnvironment.ts`
7. `apps/desktop/src/updateMachine.ts`
8. `apps/desktop/src/updateState.ts`

The desktop process should only:

1. launch and supervise `apps/server`
2. expose `desktopBridge`
3. surface OS dialogs, menu, updater, and external-open actions
4. stop owning provider runtime logic

### Web Transport And State

Use these `t3code` files as the canonical transport and orchestration layer in `apps/web/src/`:

1. `nativeApi.ts`
2. `wsNativeApi.ts`
3. `wsRpcClient.ts`
4. `wsTransport.ts`
5. `orchestrationEventEffects.ts`
6. `orchestrationRecovery.ts`
7. `providerModels.ts`
8. `session-logic.ts`
9. `threadSelectionStore.ts`
10. `terminalStateStore.ts`
11. `store.ts`
12. `types.ts`
13. `vite-env.d.ts`
14. `routes/__root.tsx`
15. `routes/_chat.$threadId.tsx`

Do not port `t3code` UI styling. Instead, wire the existing Glass UI onto the new transport and domain model through these local files:

1. `apps/web/src/components/glass/chat-session.tsx`
2. `apps/web/src/components/glass/chat-composer.tsx`
3. `apps/web/src/components/glass/chat-messages.tsx`
4. `apps/web/src/components/glass/thread-rail.tsx`
5. `apps/web/src/components/glass/provider-shell-overlay.tsx`
6. `apps/web/src/components/settings/settings-panels.tsx`
7. `apps/web/src/routes/__root.tsx`
8. `apps/web/src/lib/thread-session-store.ts`
9. `apps/web/src/lib/runtime-models.ts`
10. `apps/web/src/hooks/use-runtime-models.ts`
11. `apps/web/src/components/glass/use-runtime-session.ts`

## Local Files To Delete

### Deleted In This First Cleanup Pass

1. `docs/`
2. `apps/web/src/lib/pi-session-store.ts`
3. `apps/web/src/hooks/use-pi-models.ts`
4. `apps/web/src/components/glass/pi-composer.tsx`
5. `apps/web/src/components/glass/pi-composer-search.ts`
6. `apps/web/src/components/glass/use-pi-session.ts`
7. `apps/web/src/components/glass/pi-chat-rows.tsx`
8. `apps/web/src/components/glass/pi-messages.tsx`
9. `apps/web/src/components/glass/pi-model-picker.tsx`
10. `apps/web/src/lib/pi-models.ts`
11. `apps/web/src/lib/pi-chat-timeline.ts`
12. `apps/web/src/lib/pi-chat-timeline.test.ts`
13. `apps/web/src/lib/pi-glass-constants.ts`
14. `apps/web/src/lib/pi-composer-draft-mirror.ts`
15. `apps/web/src/lib/pi-message-preview.ts`

### Delete As Soon As The Server And WebSocket Path Is Live

1. `apps/desktop/src/pi-config-service.ts`
2. `apps/desktop/src/pi-imports.ts`
3. `apps/desktop/src/cursor-provider.ts`
4. `apps/desktop/src/pi-runtime/`
5. Pi/session IPC handling inside `apps/desktop/src/main.ts`
6. Pi/session preload bridge handling inside `apps/desktop/src/preload.ts`
7. `apps/web/src/host.ts`
8. Pi/session/thread bridge assumptions inside `apps/web/src/lib/thread-session-store.ts`
9. Pi-first model helpers in `apps/web/src/lib/runtime-models.ts`
10. Pi-first boot and session wiring in `apps/web/src/components/glass/use-runtime-session.ts`
11. Pi-first contracts in `packages/contracts/src/pi.ts`
12. Pi/session/thread contract shapes that survive only for the old bridge path
13. desktop package dependencies on `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`, and `@mariozechner/pi-coding-agent`

## Phases

### Phase 1: Cleanup The Repo Surface

1. Remove the old docs and dead Pi renderer files.
2. Stop carrying dead Pi component and store variants.
3. Freeze `t3code` as the naming and file-structure reference.

### Phase 2: Land The Server Backbone

1. Create `apps/server` from `t3code`.
2. Bring over the contracts required by `apps/server` unchanged in shape.
3. Bring up both Codex app-server and Claude support from the upstream provider layers.
4. Get session start, resume, turn send, approval, and user-input flow running locally for both providers.
5. Keep package names on the `@glass/*` scope, but preserve upstream file names and type structure.

### Phase 3: Thin The Desktop Process

1. Replace the desktop-owned Pi runtime with server process boot and supervision.
2. Expose only `desktopBridge` from preload.
3. Remove desktop ownership of provider sessions, provider config, and runtime events.

### Phase 4: Move The Web App To WebSocket Native API

1. Replace `window.glass` usage with `nativeApi.ts` and `wsNativeApi.ts`.
2. Move thread state to server-backed orchestration snapshots and `orchestration.domainEvent` subscriptions.
3. Port the `t3code` transport, recovery, provider model, and orchestration state files without changing the existing Glass styling layer.

### Phase 5: Rebase The Main Chat UI Onto The New Domain Model

1. Replace Pi/session/thread-derived UI assumptions with provider/orchestration state.
2. Wire the existing Glass UI components to the new domain model by changing logic, props, and adapters only.
3. Do not change `className` values or styling structure unless a functional integration requires a minimal adjustment.

### Phase 6: Remove The Remaining Pi Runtime

1. Delete `apps/desktop/src/pi-config-service.ts`.
2. Delete `apps/desktop/src/pi-imports.ts`.
3. Delete `apps/desktop/src/cursor-provider.ts`.
4. Delete `apps/desktop/src/pi-runtime/`.
5. Remove Pi packages from `apps/desktop/package.json`.
6. Remove obsolete Pi contracts from `packages/contracts`.

### Phase 7: Verification Gate

Before calling the migration phase complete, all of these must pass:

1. `pnpm run fmt`
2. `pnpm run lint`
3. `pnpm run typecheck`

## Non-Negotiable Rules

1. Stop inventing new runtime structure where `t3code` already has the right file and boundary.
2. Prefer copying whole upstream files over partial rewrites.
3. Do not preserve Pi compatibility layers once the server-first path exists.
4. Do not keep duplicate transport paths alive longer than needed.
5. Codex app-server is the first-class runtime path. Everything else is secondary.
6. Keep Glass naming unless a copied upstream file uses neutral provider or orchestration vocabulary.
7. Do not restyle the UI during this migration. Logic wiring only.
8. Claude support ships in the same migration, not as a later add-on.
