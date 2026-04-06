#!/usr/bin/env node

import { homedir } from "node:os";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { NetService } from "@glass/shared/Net";
import { Config, Data, Effect, Hash, Layer, Logger, Option, Path, Schema } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { ChildProcess } from "effect/unstable/process";

const BASE_WEB_PORT = 5733;
const MAX_HASH_OFFSET = 3000;
const MAX_PORT = 65535;

const MODE_ARGS = {
  dev: ["run", "dev", "--ui=tui", "--filter=@glass/desktop"],
  "dev:web": ["run", "dev", "--filter=@glass/web"],
  "dev:desktop": ["run", "dev", "--filter=@glass/desktop"],
} as const;

const MODES = Object.keys(MODE_ARGS) as Array<keyof typeof MODE_ARGS>;

export const DEFAULT_GLASS_HOME = Effect.map(Effect.service(Path.Path), (path) =>
  path.join(homedir(), ".glass"),
);

class DevRunnerError extends Data.TaggedError("DevRunnerError")<{
  readonly message: string;
  readonly cause?: Error | string | number | boolean | null | object;
}> {}

const optionalString = (name: string) =>
  Config.string(name).pipe(
    Config.option,
    Config.map((value) => Option.getOrUndefined(value)),
  );

const optionalPort = (name: string) =>
  Config.port(name).pipe(
    Config.option,
    Config.map((value) => Option.getOrUndefined(value)),
  );

const optionalInteger = (name: string) =>
  Config.int(name).pipe(
    Config.option,
    Config.map((value) => Option.getOrUndefined(value)),
  );

const optionalUrl = (name: string) =>
  Config.url(name).pipe(
    Config.option,
    Config.map((value) => Option.getOrUndefined(value)),
  );

const OffsetConfig = Config.all({
  portOffset: optionalInteger("GLASS_PORT_OFFSET"),
  devInstance: optionalString("GLASS_DEV_INSTANCE"),
});

export function resolveOffset(input: {
  readonly portOffset: number | undefined;
  readonly devInstance: string | undefined;
}) {
  if (input.portOffset !== undefined) {
    if (input.portOffset < 0) {
      throw new Error(`Invalid GLASS_PORT_OFFSET: ${input.portOffset}`);
    }
    return {
      offset: input.portOffset,
      source: `GLASS_PORT_OFFSET=${input.portOffset}`,
    };
  }

  const seed = input.devInstance?.trim();
  if (!seed) {
    return { offset: 0, source: "default ports" };
  }

  if (/^\d+$/.test(seed)) {
    return { offset: Number(seed), source: `numeric GLASS_DEV_INSTANCE=${seed}` };
  }

  return {
    offset: ((Hash.string(seed) >>> 0) % MAX_HASH_OFFSET) + 1,
    source: `hashed GLASS_DEV_INSTANCE=${seed}`,
  };
}

function resolveBaseDir(baseDir: string | undefined) {
  return Effect.gen(function* () {
    const path = yield* Path.Path;
    const value = baseDir?.trim();
    if (value) return path.resolve(value);
    return yield* DEFAULT_GLASS_HOME;
  });
}

function createEnv(input: {
  readonly baseEnv: NodeJS.ProcessEnv;
  readonly glassHome: string | undefined;
  readonly port: number | undefined;
  readonly devUrl: URL | undefined;
  readonly webOffset: number;
}) {
  return Effect.gen(function* () {
    const webPort = input.port ?? BASE_WEB_PORT + input.webOffset;
    const home = yield* resolveBaseDir(input.glassHome);
    return {
      ...input.baseEnv,
      PORT: String(webPort),
      ELECTRON_RENDERER_PORT: String(webPort),
      VITE_DEV_SERVER_URL: input.devUrl?.toString() ?? `http://localhost:${webPort}`,
      GLASS_HOME: home,
    } satisfies NodeJS.ProcessEnv;
  });
}

function findOffset(input: { readonly start: number; readonly explicit: boolean }) {
  return Effect.gen(function* () {
    if (input.explicit) return input.start;
    const net = yield* NetService;

    for (let offset = input.start; ; offset += 1) {
      const port = BASE_WEB_PORT + offset;
      if (port > MAX_PORT) break;
      const free = yield* net.isPortAvailableOnLoopback(port);
      if (free) return offset;
    }

    return yield* new DevRunnerError({
      message: `No available web port found from offset ${input.start}.`,
    });
  });
}

function runDevRunnerWithInput(input: {
  readonly mode: keyof typeof MODE_ARGS;
  readonly glassHome: string | undefined;
  readonly port: number | undefined;
  readonly devUrl: URL | undefined;
  readonly dryRun: boolean;
  readonly turboArgs: readonly string[];
}) {
  return Effect.gen(function* () {
    const cfg = yield* OffsetConfig.asEffect().pipe(
      Effect.mapError(
        (cause) =>
          new DevRunnerError({
            message: "Failed to read GLASS_PORT_OFFSET/GLASS_DEV_INSTANCE.",
            cause,
          }),
      ),
    );

    const base = yield* Effect.try({
      try: () => resolveOffset(cfg),
      catch: (cause) =>
        new DevRunnerError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

    const webOffset = yield* findOffset({
      start: base.offset,
      explicit: input.port !== undefined || input.devUrl !== undefined,
    });

    const env = yield* createEnv({
      baseEnv: process.env,
      glassHome: input.glassHome,
      port: input.port,
      devUrl: input.devUrl,
      webOffset,
    });

    const picked = webOffset !== base.offset ? ` selectedOffset=${webOffset}` : "";
    yield* Effect.logInfo(
      `[dev-runner] mode=${input.mode} source=${base.source}${picked} webPort=${String(env.PORT)} baseDir=${String(env.GLASS_HOME)}`,
    );

    if (input.dryRun) return;

    const child = yield* ChildProcess.make(
      "turbo",
      [...MODE_ARGS[input.mode], ...input.turboArgs],
      {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        env,
        extendEnv: false,
        shell: process.platform === "win32",
        detached: false,
        forceKillAfter: "1500 millis",
      },
    );

    const code = yield* child.exitCode;
    if (code !== 0) {
      return yield* new DevRunnerError({ message: `turbo exited with code ${code}` });
    }
  }).pipe(
    Effect.mapError((cause) =>
      cause instanceof DevRunnerError
        ? cause
        : new DevRunnerError({
            message: cause instanceof Error ? cause.message : "dev-runner failed",
            cause,
          }),
    ),
  );
}

const cli = Command.make("dev-runner", {
  mode: Argument.choice("mode", MODES).pipe(Argument.withDescription("Development mode to run.")),
  glassHome: Flag.string("home-dir").pipe(
    Flag.withDescription("Base directory for Glass desktop logs and state."),
    Flag.withFallbackConfig(optionalString("GLASS_HOME")),
  ),
  port: Flag.integer("port").pipe(
    Flag.withSchema(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 65535 }))),
    Flag.withDescription("Web dev server port override."),
    Flag.withFallbackConfig(optionalPort("PORT")),
  ),
  devUrl: Flag.string("dev-url").pipe(
    Flag.withSchema(Schema.URLFromString),
    Flag.withDescription("Explicit renderer dev URL override."),
    Flag.withFallbackConfig(optionalUrl("VITE_DEV_SERVER_URL")),
  ),
  dryRun: Flag.boolean("dry-run").pipe(
    Flag.withDescription("Resolve mode/env and print without spawning turbo."),
    Flag.withDefault(false),
  ),
  turboArgs: Argument.string("turbo-arg").pipe(
    Argument.withDescription("Additional turbo args (pass after `--`)."),
    Argument.variadic(),
  ),
}).pipe(
  Command.withDescription("Run desktop/web development modes with minimal Pi-host env wiring."),
  Command.withHandler((input) => runDevRunnerWithInput(input)),
);

const layer = Layer.mergeAll(
  Logger.layer([Logger.consolePretty()]),
  NodeServices.layer,
  NetService.layer,
);
const program = Command.run(cli, { version: "0.0.0" }).pipe(Effect.scoped, Effect.provide(layer));

if (import.meta.main) {
  NodeRuntime.runMain(program);
}
