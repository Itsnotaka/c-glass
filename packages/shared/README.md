# @glass/shared

Shared runtime utilities consumed by `@glass/server`, `@glass/web`, and `@glass/desktop`. Uses explicit subpath exports — there is no barrel index.

## Subpath exports

| Export                                | Description                         |
| ------------------------------------- | ----------------------------------- |
| `@glass/shared/Net`                   | HTTP/WebSocket fetch helpers        |
| `@glass/shared/model`                 | Shared model utilities              |
| `@glass/shared/git`                   | Git helpers                         |
| `@glass/shared/shell`                 | Shell execution utilities           |
| `@glass/shared/logging`               | Logging primitives                  |
| `@glass/shared/serverSettings`        | Server settings schema and defaults |
| `@glass/shared/schemaJson`            | Effect schema JSON utilities        |
| `@glass/shared/Struct`                | Struct helpers                      |
| `@glass/shared/String`                | String utilities                    |
| `@glass/shared/projectScripts`        | Project script helpers              |
| `@glass/shared/desktop-chrome`        | Desktop chrome state types          |
| `@glass/shared/DrainableWorker`       | Worker with drain semantics         |
| `@glass/shared/KeyedCoalescingWorker` | Worker with keyed coalescing        |

## Usage

Import from the specific subpath:

```ts
import { fetchJson } from "@glass/shared/Net";
import { resolveModel } from "@glass/shared/model";
```
