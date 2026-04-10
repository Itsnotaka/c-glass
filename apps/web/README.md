# @glass/web

Glass's renderer layer. A React/Vite application that runs inside the Electron shell (`@glass/desktop`). During development it can run standalone in a browser.

## Entry points

- `src/main.tsx` — renderer bootstrap; hash history in Electron, browser history in dev
- `src/router.ts` — TanStack Router configuration
- `src/routes/` — route tree (`routeTree.gen.ts` is auto-generated; hand-authored files under `_chat/`)
- `src/ws-rpc-client.ts` — typed WebSocket RPC client to `@glass/server`
- `src/ws-native-api.ts` / `src/native-api.ts` — native API bridge (Electron IPC in desktop, no-op shim in browser)
- `src/components/glass/` — product UI (chat, thread list, composer, harness picker, settings)
- `src/components/ui/` — primitives (Button, Input, Dialog, …)
- `src/hooks/` — React hooks for runtime state, session, models, and appearance
- `src/lib/` — domain logic: session view-model, provider intent map, thread store, chat timeline

## Development

```bash
pnpm run dev:web    # Vite dev server on port 5733 (from repo root)
```

In browser dev mode, `isElectron` is `false`. The app connects via WebSocket to a locally running `@glass/server`.
