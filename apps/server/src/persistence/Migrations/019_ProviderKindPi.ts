import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";

/** Migrate persisted provider identifiers from codex/claudeAgent to pi (pi-mono only). */
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    UPDATE provider_session_runtime
    SET
      provider_name = 'pi',
      adapter_key = 'pi'
    WHERE provider_name IN ('codex', 'claudeAgent')
       OR adapter_key IN ('codex', 'claudeAgent')
  `;

  yield* sql`
    UPDATE projection_thread_sessions
    SET provider_name = 'pi'
    WHERE provider_name IN ('codex', 'claudeAgent')
  `;

  yield* sql`
    UPDATE projection_projects
    SET default_model_selection_json = json_set(default_model_selection_json, '$.provider', 'pi')
    WHERE json_extract(default_model_selection_json, '$.provider') IN ('codex', 'claudeAgent')
  `;

  yield* sql`
    UPDATE projection_threads
    SET model_selection_json = json_set(model_selection_json, '$.provider', 'pi')
    WHERE json_extract(model_selection_json, '$.provider') IN ('codex', 'claudeAgent')
  `;

  yield* sql`
    UPDATE orchestration_events
    SET payload_json = replace(
      replace(payload_json, '"provider":"claudeAgent"', '"provider":"pi"'),
      '"provider":"codex"',
      '"provider":"pi"'
    )
    WHERE payload_json LIKE '%"provider":"codex"%'
       OR payload_json LIKE '%"provider":"claudeAgent"%'
  `;

  yield* sql`
    UPDATE orchestration_events
    SET metadata_json = replace(
      replace(metadata_json, '"adapterKey":"claudeAgent"', '"adapterKey":"pi"'),
      '"adapterKey":"codex"',
      '"adapterKey":"pi"'
    )
    WHERE metadata_json LIKE '%"adapterKey":"codex"%'
       OR metadata_json LIKE '%"adapterKey":"claudeAgent"%'
  `;

  yield* sql`
    UPDATE provider_session_runtime
    SET runtime_payload_json = replace(
      replace(runtime_payload_json, '"provider":"claudeAgent"', '"provider":"pi"'),
      '"provider":"codex"',
      '"provider":"pi"'
    )
    WHERE runtime_payload_json LIKE '%"provider":"codex"%'
       OR runtime_payload_json LIKE '%"provider":"claudeAgent"%'
  `;
});
