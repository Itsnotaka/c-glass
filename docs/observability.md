# Observability

Glass uses the same server-side observability model as [t3code](https://github.com/pingdotgg/t3code):

- Pretty logs go to **stdout** for humans.
- Completed spans are written to a **local NDJSON trace file**.
- Traces and metrics can be exported over **OTLP** to a backend such as Grafana LGTM.

The local trace file is the persisted source of truth for spans. There is no separate persisted server log file for trace data.

## Where things live

### Logs

- **Destination:** stdout
- **Format:** pretty console logger from the observability layer
- **Persistence:** none (human-facing only)

To attach log lines to the trace file, emit them **inside an active span** with `Effect.log...`. The tracer logger records them as span events.

### Traces

Completed spans are written as NDJSON to `serverTracePath`. By default, under `GLASS_HOME`:

- Packaged / normal mode: `$GLASS_HOME/userdata/logs/server.trace.ndjson` (default `GLASS_HOME` is `~/.glass`).
- Dev mode with a dev URL: `$GLASS_HOME/dev/logs/server.trace.ndjson` (see `deriveServerPaths` in `apps/server/src/config.ts`).

Important fields per record:

- `name` — span name
- `traceId`, `spanId`, `parentSpanId` — correlation
- `durationMs` — elapsed time
- `attributes` — structured context
- `events` — embedded logs and custom events
- `exit` — success, failure, or interrupted (shape depends on record variant)

The TypeScript shapes live in `apps/server/src/observability/TraceRecord.ts`.

### Metrics

- **Local file:** not written
- **Remote:** OTLP when configured
- **Definitions:** `apps/server/src/observability/Metrics.ts`

Metric names are still prefixed `t3_` in code (carried from upstream) — for example `t3_rpc_request_duration`, `t3_orchestration_command_ack_duration`. Treat the prefix as stable identifiers in dashboards until renamed.

If OTLP URLs are unset, metrics stay in-process only.

### Related artifacts

Provider event NDJSON streams (under the server logs layout) are separate from `server.trace.ndjson`.

## Run the server in instrumented mode

### Local traces only

No extra configuration required. Start the server or desktop stack as usual and tail the trace file.

Examples:

```bash
pnpm run dev:web
```

```bash
pnpm run dev
```

```bash
pnpm run dev:desktop
```

### OTLP to a local LGTM stack

**1. Start Grafana LGTM**

```bash
docker run --name lgtm \
  -p 3000:3000 \
  -p 4317:4317 \
  -p 4318:4318 \
  --rm -ti \
  grafana/otel-lgtm
```

Open `http://localhost:3000` (default Grafana login is often `admin` / `admin` per the LGTM image docs).

**2. Export Glass OTLP environment variables**

```bash
export GLASS_OTLP_TRACES_URL=http://localhost:4318/v1/traces
export GLASS_OTLP_METRICS_URL=http://localhost:4318/v1/metrics
export GLASS_OTLP_SERVICE_NAME=glass-local
```

Optional:

```bash
export GLASS_TRACE_MIN_LEVEL=Info
export GLASS_TRACE_TIMING_ENABLED=true
```

**3. Launch from that same shell**

So the backend inherits `GLASS_OTLP_*`. For packaged desktop, launching from Finder or the dock usually **does not** pick up shell exports — start the app from a terminal when testing OTLP.

**4. Restart after changing env**

Observability config is read at process start.

## Debugging with traces and metrics

### Tail the local trace file

```bash
tail -f ~/.glass/userdata/logs/server.trace.ndjson
```

Dev tree example (when using dev state dir):

```bash
tail -f ~/.glass/dev/logs/server.trace.ndjson
```

### jq examples

Failed spans (lines with `type: "effect-span"`; OTLP-derived lines use `status` instead of `exit`):

```bash
jq -c 'select(.type == "effect-span" and .exit._tag != "Success") | { name, durationMs, exit, attributes }' \
  ~/.glass/userdata/logs/server.trace.ndjson
```

Slow spans:

```bash
jq -c 'select(.durationMs > 1000) | { name, durationMs, traceId, spanId }' \
  ~/.glass/userdata/logs/server.trace.ndjson
```

Follow one trace:

```bash
jq -r 'select(.traceId == "TRACE_ID_HERE") | [.name, .spanId, (.parentSpanId // "-"), .durationMs] | @tsv' \
  ~/.glass/userdata/logs/server.trace.ndjson
```

Filter orchestration-related attributes (when present):

```bash
jq -c 'select(.attributes["orchestration.command_type"] != null) | { name, durationMs, commandType: .attributes["orchestration.command_type"] }' \
  ~/.glass/userdata/logs/server.trace.ndjson
```

Filter git-related attributes (when present):

```bash
jq -c 'select(.attributes["git.operation"] != null) | { name, durationMs, operation: .attributes["git.operation"], cwd: .attributes["git.cwd"] }' \
  ~/.glass/userdata/logs/server.trace.ndjson
```

### Tempo / Grafana

Use Tempo in Grafana when you need trace search and parent/child visualization. Start with a broad time range and your `GLASS_OTLP_SERVICE_NAME`, then narrow by span name or attributes.

### Metrics vs traces

- **Traces:** one request, one failure, which child span broke.
- **Metrics:** trends, rates, “is everything slow after the deploy?”

Useful timers (names as defined in `Metrics.ts`): `t3_rpc_request_duration`, `t3_orchestration_command_duration`, `t3_orchestration_command_ack_duration`, `t3_provider_turn_duration`, `t3_git_command_duration`, and related counters.

### Ack latency metric

`t3_orchestration_command_ack_duration` measures server-side time from command dispatch to the first committed domain event for that command. It does **not** include WebSocket RTT or React render time.

## Adding instrumentation

- Prefer **boundaries** (RPC, orchestration commands, provider calls, git, persistence) over tiny helpers.
- Reuse **`Effect.fn("name")`** where it already defines a boundary.
- Put **high-cardinality** detail on span attributes; keep **metric labels** low cardinality.
- Use **`Effect.log...` inside spans** so messages become span events.
- Use **`withMetrics`** from `Metrics.ts` for counters and timers on effects.

Ad hoc span example:

```ts
import { Effect } from "effect";

const runThing = Effect.gen(function* () {
  yield* Effect.annotateCurrentSpan({
    "thing.id": "abc123",
    "thing.kind": "example",
  });
  yield* Effect.logInfo("starting thing");
  return yield* doWork();
}).pipe(Effect.withSpan("thing.run"));
```

## Environment reference

Resolved in `apps/server/src/cli.ts` and layered in `apps/server/src/observability/Layers/Observability.ts`.

**Trace file**

| Variable                      | Role                                 |
| ----------------------------- | ------------------------------------ |
| `GLASS_TRACE_FILE`            | Override trace file path             |
| `GLASS_TRACE_MAX_BYTES`       | Rotation size (default `10485760`)   |
| `GLASS_TRACE_MAX_FILES`       | Rotated file count (default `10`)    |
| `GLASS_TRACE_BATCH_WINDOW_MS` | Flush window ms (default `200`)      |
| `GLASS_TRACE_MIN_LEVEL`       | Minimum trace level (default `Info`) |
| `GLASS_TRACE_TIMING_ENABLED`  | Timing metadata (default `true`)     |

**OTLP**

| Variable                        | Role                                  |
| ------------------------------- | ------------------------------------- |
| `GLASS_OTLP_TRACES_URL`         | OTLP traces endpoint                  |
| `GLASS_OTLP_METRICS_URL`        | OTLP metrics endpoint                 |
| `GLASS_OTLP_EXPORT_INTERVAL_MS` | Export interval (default `10000`)     |
| `GLASS_OTLP_SERVICE_NAME`       | Service name (default `glass-server`) |

**Layout**

| Variable     | Role                                                          |
| ------------ | ------------------------------------------------------------- |
| `GLASS_HOME` | Base dir for `userdata/` or `dev/` state (default `~/.glass`) |

Persisted OTLP URLs can also be merged from server settings via `@glass/shared/serverSettings` (used by CLI and desktop when settings exist).

## Browser traces

The HTTP server exposes an OTLP-traces ingestion path used to fold browser-emitted spans into the same pipeline (see `apps/server/src/http.ts` and `BrowserTraceCollector`).

## Constraints

- Logs **outside** active spans are not persisted to the trace file.
- Metrics are not snapshotted locally.
- `serverLogPath` may still exist in config for compatibility; the **trace NDJSON file** is the primary persisted trace artifact.
