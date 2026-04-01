/**
 * ProviderRegistryLive - Aggregates provider-specific snapshot services.
 *
 * No CLI/provider backends are registered in this build (Pi-only client flow).
 *
 * @module ProviderRegistryLive
 */
import type { ProviderKind, ServerProvider } from "@glass/contracts";
import { Effect, Equal, Layer, PubSub, Ref, Stream } from "effect";

import { ProviderRegistry, type ProviderRegistryShape } from "../Services/ProviderRegistry";

export const haveProvidersChanged = (
  previousProviders: ReadonlyArray<ServerProvider>,
  nextProviders: ReadonlyArray<ServerProvider>,
): boolean => !Equal.equals(previousProviders, nextProviders);

export const ProviderRegistryLive = Layer.effect(
  ProviderRegistry,
  Effect.gen(function* () {
    const changesPubSub = yield* Effect.acquireRelease(
      PubSub.unbounded<ReadonlyArray<ServerProvider>>(),
      PubSub.shutdown,
    );
    const providersRef = yield* Ref.make<ReadonlyArray<ServerProvider>>([]);

    const syncProviders = (options?: { readonly publish?: boolean }) =>
      Effect.gen(function* () {
        const previousProviders = yield* Ref.get(providersRef);
        const providers: ReadonlyArray<ServerProvider> = [];
        yield* Ref.set(providersRef, providers);

        if (options?.publish !== false && haveProvidersChanged(previousProviders, providers)) {
          yield* PubSub.publish(changesPubSub, providers);
        }

        return providers;
      });

    return {
      getProviders: syncProviders({ publish: false }).pipe(
        Effect.tapError(Effect.logError),
        Effect.orElseSucceed(() => []),
      ),
      refresh: () =>
        syncProviders().pipe(
          Effect.tapError(Effect.logError),
          Effect.orElseSucceed(() => []),
        ),
      get streamChanges() {
        return Stream.fromPubSub(changesPubSub);
      },
    } satisfies ProviderRegistryShape;
  }),
);
