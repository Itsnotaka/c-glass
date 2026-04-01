import { describe, it, assert } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { haveProvidersChanged, ProviderRegistryLive } from "./ProviderRegistry";
import { ProviderRegistry } from "../Services/ProviderRegistry";
import * as NodeServices from "@effect/platform-node/NodeServices";

describe("ProviderRegistry (empty)", () => {
  it.effect("exposes an empty provider list", () =>
    Effect.gen(function* () {
      const registry = yield* ProviderRegistry;
      const providers = yield* registry.getProviders;
      assert.deepEqual(providers, []);
    }).pipe(Effect.provide(Layer.mergeAll(ProviderRegistryLive, NodeServices.layer))),
  );

  it("haveProvidersChanged treats equal snapshots as unchanged", () => {
    const a = [] as const;
    assert.strictEqual(haveProvidersChanged(a, []), false);
  });
});
