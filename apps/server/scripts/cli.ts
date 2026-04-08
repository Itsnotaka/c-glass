#!/usr/bin/env node

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Data, Effect, FileSystem, Layer, Logger, Path } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { BRAND_ASSET_PATHS } from "../../../scripts/lib/brand-assets.ts";

class CliError extends Data.TaggedError("CliError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const RepoRoot = Effect.service(Path.Path).pipe(
  Effect.flatMap((path) => path.fromFileUrl(new URL("../../..", import.meta.url))),
);

const run = Effect.fn("run")(function* (command: ChildProcess.Command) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const child = yield* spawner.spawn(command);
  const code = yield* child.exitCode;
  if (code === 0) return;
  return yield* new CliError({
    message: `Command exited with non-zero exit code (${code})`,
  });
});

const applyDevelopmentIconOverrides = Effect.fn("applyDevelopmentIconOverrides")(function* (
  root: string,
  dir: string,
) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const items = [
    {
      src: BRAND_ASSET_PATHS.developmentWebFaviconIco,
      dst: "dist/client/favicon.ico",
    },
    {
      src: BRAND_ASSET_PATHS.developmentWebFavicon16Png,
      dst: "dist/client/favicon-16x16.png",
    },
    {
      src: BRAND_ASSET_PATHS.developmentWebFavicon32Png,
      dst: "dist/client/favicon-32x32.png",
    },
    {
      src: BRAND_ASSET_PATHS.developmentWebAppleTouchIconPng,
      dst: "dist/client/apple-touch-icon.png",
    },
  ];

  for (const item of items) {
    const src = path.join(root, item.src);
    const dst = path.join(dir, item.dst);
    if (!(yield* fs.exists(src))) {
      return yield* new CliError({ message: `Missing development icon source: ${src}` });
    }
    if (!(yield* fs.exists(dst))) {
      return yield* new CliError({ message: `Missing development icon target: ${dst}` });
    }
    yield* fs.copyFile(src, dst);
  }
});

const buildCmd = Command.make(
  "build",
  {
    verbose: Flag.boolean("verbose").pipe(Flag.withDefault(false)),
    skipWeb: Flag.boolean("skip-web").pipe(Flag.withDefault(false)),
  },
  (cfg) =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const fs = yield* FileSystem.FileSystem;
      const root = yield* RepoRoot;
      const dir = path.join(root, "apps/server");

      if (!cfg.skipWeb) {
        yield* Effect.log("[cli] Building web app...");
        yield* run(
          ChildProcess.make("pnpm", ["--filter", "@glass/web", "build"], {
            cwd: root,
            stdout: cfg.verbose ? "inherit" : "ignore",
            stderr: "inherit",
            shell: process.platform === "win32",
          }),
        );
      }

      yield* Effect.log("[cli] Running tsdown...");
      yield* run(
        ChildProcess.make("pnpm", ["exec", "tsdown"], {
          cwd: dir,
          stdout: cfg.verbose ? "inherit" : "ignore",
          stderr: "inherit",
          shell: process.platform === "win32",
        }),
      );

      const webDist = path.join(root, "apps/web/dist");
      const client = path.join(dir, "dist/client");
      if (!(yield* fs.exists(webDist))) {
        yield* Effect.logWarning("[cli] Web dist not found — skipping client bundle.");
        return;
      }

      yield* fs.remove(client, { recursive: true, force: true });
      yield* fs.copy(webDist, client);
      yield* applyDevelopmentIconOverrides(root, dir);
      yield* Effect.log("[cli] Bundled web app into dist/client");
    }),
).pipe(Command.withDescription("Build the Glass server package and bundle the web client."));

const cli = Command.make("glass-server-cli").pipe(
  Command.withDescription("Glass server build helpers."),
  Command.withSubcommands([buildCmd]),
);

const layer = Logger.layer([Logger.consolePretty()]).pipe(Layer.merge(NodeServices.layer));
const program = Command.run(cli, { version: "0.0.0" }).pipe(Effect.scoped, Effect.provide(layer));

NodeRuntime.runMain(program);
