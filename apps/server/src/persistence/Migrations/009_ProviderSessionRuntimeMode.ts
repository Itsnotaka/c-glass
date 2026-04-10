import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

export default Effect.gen(function* () {
  yield* SqlClient.SqlClient;
}).pipe(Effect.withSpan("persistence/migration/009_ProviderSessionRuntimeMode"));
