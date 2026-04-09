import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    UPDATE projection_projects
    SET default_model_selection_json = json_set(
      default_model_selection_json,
      '$.provider',
      CASE
        WHEN json_extract(default_model_selection_json, '$.provider') = 'pi' THEN 'codex'
        WHEN json_extract(default_model_selection_json, '$.provider') = 'claudeCode'
        THEN 'claudeAgent'
        WHEN json_extract(default_model_selection_json, '$.provider') = 'claude'
        THEN 'claudeAgent'
        ELSE json_extract(default_model_selection_json, '$.provider')
      END
    )
    WHERE json_type(default_model_selection_json, '$.provider') = 'text'
      AND json_extract(default_model_selection_json, '$.provider') IN ('pi', 'claudeCode', 'claude')
  `;

  yield* sql`
    UPDATE projection_threads
    SET model_selection_json = json_set(
      model_selection_json,
      '$.provider',
      CASE
        WHEN json_extract(model_selection_json, '$.provider') = 'pi' THEN 'codex'
        WHEN json_extract(model_selection_json, '$.provider') = 'claudeCode' THEN 'claudeAgent'
        WHEN json_extract(model_selection_json, '$.provider') = 'claude' THEN 'claudeAgent'
        ELSE json_extract(model_selection_json, '$.provider')
      END
    )
    WHERE json_type(model_selection_json, '$.provider') = 'text'
      AND json_extract(model_selection_json, '$.provider') IN ('pi', 'claudeCode', 'claude')
  `;

  yield* sql`
    UPDATE orchestration_events
    SET payload_json = json_set(
      payload_json,
      '$.defaultModelSelection.provider',
      CASE
        WHEN json_extract(payload_json, '$.defaultModelSelection.provider') = 'pi' THEN 'codex'
        WHEN json_extract(payload_json, '$.defaultModelSelection.provider') = 'claudeCode'
        THEN 'claudeAgent'
        WHEN json_extract(payload_json, '$.defaultModelSelection.provider') = 'claude'
        THEN 'claudeAgent'
        ELSE json_extract(payload_json, '$.defaultModelSelection.provider')
      END
    )
    WHERE json_type(payload_json, '$.defaultModelSelection.provider') = 'text'
      AND json_extract(payload_json, '$.defaultModelSelection.provider') IN (
        'pi',
        'claudeCode',
        'claude'
      )
  `;

  yield* sql`
    UPDATE orchestration_events
    SET payload_json = json_set(
      payload_json,
      '$.modelSelection.provider',
      CASE
        WHEN json_extract(payload_json, '$.modelSelection.provider') = 'pi' THEN 'codex'
        WHEN json_extract(payload_json, '$.modelSelection.provider') = 'claudeCode'
        THEN 'claudeAgent'
        WHEN json_extract(payload_json, '$.modelSelection.provider') = 'claude'
        THEN 'claudeAgent'
        ELSE json_extract(payload_json, '$.modelSelection.provider')
      END
    )
    WHERE json_type(payload_json, '$.modelSelection.provider') = 'text'
      AND json_extract(payload_json, '$.modelSelection.provider') IN ('pi', 'claudeCode', 'claude')
  `;

  yield* sql`
    UPDATE provider_session_runtime
    SET provider_name = CASE
      WHEN provider_name = 'pi' THEN 'codex'
      WHEN provider_name = 'claudeCode' THEN 'claudeAgent'
      WHEN provider_name = 'claude' THEN 'claudeAgent'
      ELSE provider_name
    END
    WHERE provider_name IN ('pi', 'claudeCode', 'claude')
  `;

  yield* sql`
    UPDATE provider_session_runtime
    SET runtime_payload_json = json_set(
      runtime_payload_json,
      '$.modelSelection.provider',
      CASE
        WHEN json_extract(runtime_payload_json, '$.modelSelection.provider') = 'pi' THEN 'codex'
        WHEN json_extract(runtime_payload_json, '$.modelSelection.provider') = 'claudeCode'
        THEN 'claudeAgent'
        WHEN json_extract(runtime_payload_json, '$.modelSelection.provider') = 'claude'
        THEN 'claudeAgent'
        ELSE json_extract(runtime_payload_json, '$.modelSelection.provider')
      END
    )
    WHERE json_type(runtime_payload_json, '$.modelSelection.provider') = 'text'
      AND json_extract(runtime_payload_json, '$.modelSelection.provider') IN (
        'pi',
        'claudeCode',
        'claude'
      )
  `;

  yield* sql`
    UPDATE projection_thread_sessions
    SET provider_name = CASE
      WHEN provider_name = 'pi' THEN 'codex'
      WHEN provider_name = 'claudeCode' THEN 'claudeAgent'
      WHEN provider_name = 'claude' THEN 'claudeAgent'
      ELSE provider_name
    END
    WHERE provider_name IN ('pi', 'claudeCode', 'claude')
  `;
});
