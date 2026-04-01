import * as NodeServices from "@effect/platform-node/NodeServices";
import { DEFAULT_SERVER_SETTINGS, ServerSettingsPatch } from "@glass/contracts";
import { assert, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Schema } from "effect";
import { ServerConfig } from "./config";
import { ServerSettingsLive, ServerSettingsService } from "./serverSettings";

const makeServerSettingsLayer = () =>
  ServerSettingsLive.pipe(
    Layer.provideMerge(
      Layer.fresh(
        ServerConfig.layerTest(process.cwd(), {
          prefix: "glass-server-settings-test-",
        }),
      ),
    ),
  );

it.layer(NodeServices.layer)("server settings", (it) => {
  it.effect("decodes nested settings patches", () =>
    Effect.sync(() => {
      const decodePatch = Schema.decodeUnknownSync(ServerSettingsPatch);

      assert.deepEqual(decodePatch({ providers: { pi: { binaryPath: "/tmp/pi" } } }), {
        providers: { pi: { binaryPath: "/tmp/pi" } },
      });

      assert.deepEqual(
        decodePatch({
          textGenerationModelSelection: {
            options: {
              fastMode: false,
            },
          },
        }),
        {
          textGenerationModelSelection: {
            options: {
              fastMode: false,
            },
          },
        },
      );
    }),
  );

  it.effect("deep merges nested settings updates without dropping siblings", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;

      yield* serverSettings.updateSettings({
        providers: {
          pi: {
            binaryPath: "/usr/local/bin/pi",
            homePath: "/Users/julius/.pi",
            customModels: ["pi-custom"],
          },
        },
        textGenerationModelSelection: {
          provider: "pi",
          model: DEFAULT_SERVER_SETTINGS.textGenerationModelSelection.model,
          options: {
            reasoningEffort: "high",
            fastMode: true,
          },
        },
      });

      const next = yield* serverSettings.updateSettings({
        providers: {
          pi: {
            binaryPath: "/opt/homebrew/bin/pi",
          },
        },
        textGenerationModelSelection: {
          options: {
            fastMode: false,
          },
        },
      });

      assert.deepEqual(next.providers.pi, {
        enabled: true,
        binaryPath: "/opt/homebrew/bin/pi",
        homePath: "/Users/julius/.pi",
        customModels: ["pi-custom"],
      });
      assert.deepEqual(next.textGenerationModelSelection, {
        provider: "pi",
        model: DEFAULT_SERVER_SETTINGS.textGenerationModelSelection.model,
        options: {
          reasoningEffort: "high",
          fastMode: false,
        },
      });
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );

  it.effect("preserves model when updating textGenerationModelSelection options", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;

      yield* serverSettings.updateSettings({
        textGenerationModelSelection: {
          provider: "pi",
          model: "claude-sonnet-4-6",
          options: {
            effort: "high",
          },
        },
      });

      const next = yield* serverSettings.updateSettings({
        textGenerationModelSelection: {
          provider: "pi",
          model: "gpt-5.4",
          options: {
            reasoningEffort: "high",
          },
        },
      });

      assert.deepEqual(next.textGenerationModelSelection, {
        provider: "pi",
        model: "gpt-5.4",
        options: {
          reasoningEffort: "high",
          effort: "high",
        },
      });
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );

  it.effect("trims provider path settings when updates are applied", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;

      const next = yield* serverSettings.updateSettings({
        providers: {
          pi: {
            binaryPath: "  /opt/homebrew/bin/pi  ",
            homePath: "   ",
          },
        },
      });

      assert.deepEqual(next.providers.pi, {
        enabled: true,
        binaryPath: "/opt/homebrew/bin/pi",
        homePath: "",
        customModels: [],
      });
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );

  it.effect("defaults blank binary paths to provider executables", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;

      const next = yield* serverSettings.updateSettings({
        providers: {
          pi: {
            binaryPath: "   ",
          },
        },
      });

      assert.equal(next.providers.pi.binaryPath, "pi");
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );

  it.effect("writes only non-default server settings to disk", () =>
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;
      const serverConfig = yield* ServerConfig;
      const fileSystem = yield* FileSystem.FileSystem;
      const next = yield* serverSettings.updateSettings({
        providers: {
          pi: {
            binaryPath: "/opt/homebrew/bin/pi",
          },
        },
      });

      assert.equal(next.providers.pi.binaryPath, "/opt/homebrew/bin/pi");

      const raw = yield* fileSystem.readFileString(serverConfig.settingsPath);
      assert.deepEqual(JSON.parse(raw), {
        providers: {
          pi: {
            binaryPath: "/opt/homebrew/bin/pi",
          },
        },
      });
    }).pipe(Effect.provide(makeServerSettingsLayer())),
  );
});
