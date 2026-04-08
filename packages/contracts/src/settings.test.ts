import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import { DEFAULT_SERVER_SETTINGS, ServerSettings } from "./settings";

describe("DEFAULT_SERVER_SETTINGS", () => {
  it("streams assistant output by default", () => {
    expect(DEFAULT_SERVER_SETTINGS.enableAssistantStreaming).toBe(true);
    expect(Schema.decodeSync(ServerSettings)({}).enableAssistantStreaming).toBe(true);
  });
});
