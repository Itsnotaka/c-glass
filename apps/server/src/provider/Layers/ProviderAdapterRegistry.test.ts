import type { ProviderKind } from "@glass/contracts";
import { it, assert } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";

import { Effect, Layer } from "effect";

import { ProviderAdapterRegistry } from "../Services/ProviderAdapterRegistry.ts";
import { ProviderAdapterRegistryLive } from "./ProviderAdapterRegistry.ts";
import { ProviderUnsupportedError } from "../Errors.ts";
import * as NodeServices from "@effect/platform-node/NodeServices";

const layer = it.layer(Layer.mergeAll(ProviderAdapterRegistryLive, NodeServices.layer));

layer("ProviderAdapterRegistryLive", (it) => {
  it.effect("has no adapters by default", () =>
    Effect.gen(function* () {
      const registry = yield* ProviderAdapterRegistry;
      assert.deepEqual(yield* registry.listProviders(), []);
      const pi = yield* registry.getByProvider("pi").pipe(Effect.result);
      assertFailure(pi, new ProviderUnsupportedError({ provider: "pi" }));
    }),
  );

  it.effect("fails with ProviderUnsupportedError for unknown providers", () =>
    Effect.gen(function* () {
      const registry = yield* ProviderAdapterRegistry;
      const adapter = yield* registry.getByProvider("unknown" as ProviderKind).pipe(Effect.result);
      assertFailure(adapter, new ProviderUnsupportedError({ provider: "unknown" }));
    }),
  );
});
