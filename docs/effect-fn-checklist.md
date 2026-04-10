# Effect.fn refactor checklist

Derived from [t3code `docs/effect-fn-checklist.md`](https://github.com/pingdotgg/t3code/blob/main/docs/effect-fn-checklist.md). Use it when converting wrapper-style effects to `Effect.fn` for consistent naming and tracing boundaries.

## Refactor pattern

```ts
// Before
function old() {
  return Effect.gen(function* () {
    // ...
  });
}

const old2 = () =>
  Effect.gen(function* () {
    // ...
  });
```

```ts
// After (real inputs — keep `Effect.fn`, do not call it with `()`)
export const run = Effect.fn("functionName")(function* (input: Input) {
  // ...
});
```

**Zero-argument** effects (migrations, `Layer.effect` bodies, one-shot setup) should **not** use `Effect.fn("…")(function* () { … })()` — `@effect/language-service` reports TS46. Use a traced generator instead:

```ts
export default Effect.gen(function* () {
  // ...
}).pipe(Effect.withSpan("persistence/migration/001_Example"));
```

- Use `Effect.fn("name")(function* (input: Input): Effect.fn.Return<...> {})` when you need an explicit return type.
- The optional second argument pipes the effect and input (logging, `catch`, etc.):

```ts
Effect.fn("name")(
  function* (input: Input): Effect.fn.Return<A, E, R> {
    // ...
  },
  (effect, input) => Effect.catch(effect, (reason) => Effect.logWarning("Err", { input, reason })),
);
```

## Glass repo snapshot

The list below is a **starting point**, not a complete audit. Regenerate ordering with ripgrep when you need an up-to-date file list:

```bash
rg "Effect\\.gen" apps/server packages/shared --glob "*.ts" -c | sort -t: -k2 -nr
```

Skip `*.test.ts` unless you are deliberately normalizing test helpers.

### Suggested order (higher `Effect.gen` count first)

Work from hot paths (WebSocket RPC, startup, orchestration, provider) downward. Counts are approximate; re-run the ripgrep sort when this drifts.

- [ ] `apps/server/src/ws.ts`
- [ ] `apps/server/src/serverRuntimeStartup.ts`
- [ ] `apps/server/src/keybindings.ts`
- [ ] `apps/server/src/serverSettings.ts`
- [ ] `apps/server/src/provider/Layers/ProviderService.ts`
- [ ] `apps/server/src/terminal/Layers/Manager.ts`
- [ ] `apps/server/src/server.ts`
- [ ] `apps/server/src/orchestration/Layers/OrchestrationEngine.ts`
- [ ] `apps/server/src/telemetry/Identify.ts`
- [ ] `apps/server/src/orchestration/projector.ts`
- [ ] `apps/server/src/orchestration/Layers/ProviderCommandReactor.ts`
- [ ] `apps/server/src/observability/RpcInstrumentation.ts`
- [ ] `apps/server/src/http.ts`
- [ ] `apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.ts`
- [ ] `apps/server/src/git/Layers/RoutingTextGeneration.ts`
- [ ] `apps/server/src/terminal/Layers/NodePTY.ts`
- [ ] `apps/server/src/telemetry/Layers/AnalyticsService.ts`
- [ ] `apps/server/src/project/Layers/ProjectSetupScriptRunner.ts`
- [ ] `apps/server/src/orchestration/Normalizer.ts`
- [ ] `apps/server/src/orchestration/Layers/WorkingState.ts`
- [ ] `apps/server/src/observability/Layers/Observability.ts`
- [ ] `apps/server/src/cli.ts`
- [ ] `apps/server/src/git/Layers/GitStatusBroadcaster.ts`
- [ ] `apps/server/src/git/Layers/CodexTextGeneration.ts`
- [ ] Remaining files under `apps/server/src/` and `apps/server/scripts/` with `Effect.gen` (omit `*.test.ts` unless intentional)
- [ ] `packages/shared/src/DrainableWorker.ts`, `packages/shared/src/KeyedCoalescingWorker.ts`

Track `- [ ]` / `- [x]` per file (or per function if you split work that way).
